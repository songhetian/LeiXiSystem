import { Injectable, ConflictException, Logger, UnprocessableEntityException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';
import { ACTIVE_EMPLOYEE_STATUSES } from '../common/employee-status';
import { errorCode } from '../common/error.util';
import { beijingBusinessDate } from '../common/date.util';
import { AttendanceDailyService } from './attendance-daily.service';

// 排班聚合（S04）：员工×日期×班次，uk(employee, workDate)；重复 → 2002（含批量原子性）
@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly dailyService: AttendanceDailyService,
  ) {}

  async create(dto: { employeeId: number; shiftId: number; workDate: string }, userId: number) {
    // 数据隔离：经理只能给本部门员工排班（ADR-0010）
    await this.assertInScope(dto.employeeId, userId);
    try {
      const workDate = new Date(dto.workDate);
      // upsert：同一员工同一天已有排班则覆盖为本次班次，而非抛出“排班重复”
      const saved = await this.prisma.schedule.upsert({
        where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
        create: { employeeId: dto.employeeId, shiftId: dto.shiftId, workDate },
        update: { shiftId: dto.shiftId },
      });
      await this.recalcAffected([{ employeeId: dto.employeeId, workDate }], userId);
      return saved;
    } catch (e) {
      if (errorCode(e) === 'P2003') {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.SCHEDULE_TARGET_NOT_FOUND,
          message: '员工或班次不存在',
        });
      }
      throw e;
    }
  }

  // 批量排班：事务内逐条 upsert，冲突覆盖而非报错（幂等）
  async batch(items: { employeeId: number; shiftId: number; workDate: string }[], userId: number) {
    // 权限校验一次查全：逐条 assertInScope 会按人数放大成 N 次 employee 查询
    await this.assertManyInScope(items.map((item) => item.employeeId), userId);
    try {
      const count = await this.prisma.$transaction(async (tx) => {
        let n = 0;
        for (const item of items) {
          const workDate = new Date(item.workDate);
          await tx.schedule.upsert({
            where: { employeeId_workDate: { employeeId: item.employeeId, workDate } },
            create: { employeeId: item.employeeId, shiftId: item.shiftId, workDate },
            update: { shiftId: item.shiftId },
          });
          n++;
        }
        return n;
      });
      await this.recalcAffected(
        items.map((item) => ({ employeeId: item.employeeId, workDate: new Date(item.workDate) })),
        userId,
      );
      return { count };
    } catch (e) {
      if (errorCode(e) === 'P2003') {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.SCHEDULE_TARGET_NOT_FOUND,
          message: '员工或班次不存在',
        });
      }
      throw e;
    }
  }

  async list(
    userId: number,
    query: { employeeId?: number; startDate?: string; endDate?: string; page: number; pageSize: number },
  ) {
    const scope = await this.dataScope.visibleScope(userId);
    const where: any = {};
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (query.employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== Number(query.employeeId)) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = Number(query.employeeId);
      }
    }
    if (query.startDate || query.endDate) {
      where.workDate = {};
      if (query.startDate) where.workDate.gte = new Date(query.startDate);
      if (query.endDate) where.workDate.lte = new Date(query.endDate);
    }
    const [list, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: { employee: { select: { id: true, employeeNo: true, name: true } }, shift: true },
        orderBy: { workDate: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.schedule.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  /** 部门×月份排班矩阵：返回指定部门在职员工 + 范围内排班（含班次），用于矩阵视图 */
  async matrix(userId: number, query: { departmentId?: number; startDate?: string; endDate?: string }) {
    const scope = await this.dataScope.visibleScope(userId);
    const selfEmployeeId = scope.selfEmployeeId;

    // 非管理员仅可查看其可见部门的排班
    if (!scope.all && !selfEmployeeId && query.departmentId && !scope.ids.includes(query.departmentId)) {
      throw new ForbiddenException({ code: 5003, message: '无权查看该部门排班' });
    }

    const employeeWhere: any = { status: { in: ACTIVE_EMPLOYEE_STATUSES } };
    if (selfEmployeeId) {
      // 本人：仅返回本人矩阵
      employeeWhere.id = selfEmployeeId;
    } else if (query.departmentId) {
      employeeWhere.departmentId = query.departmentId;
    } else if (!scope.all) {
      employeeWhere.departmentId = { in: scope.ids };
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, employeeNo: true, name: true, departmentId: true },
      orderBy: { id: 'asc' },
    });

    const empIds = employees.map((e: any) => e.id);
    let schedules: any[] = [];
    if (empIds.length) {
      const where: any = { employeeId: { in: empIds } };
      if (query.startDate || query.endDate) {
        where.workDate = {};
        if (query.startDate) where.workDate.gte = new Date(query.startDate);
        if (query.endDate) where.workDate.lte = new Date(query.endDate);
      }
      schedules = await this.prisma.schedule.findMany({
        where,
        include: { shift: true },
        orderBy: { workDate: 'asc' },
      });
    }

    return { employees, schedules };
  }

  /** 我的排班：仅返回当前登录用户本人（其绑定员工）在时间范围内的排班，含班次信息 */
  async mySchedule(userId: number, range: { startDate?: string; endDate?: string; page: number; pageSize: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employees: { select: { id: true } } },
    });
    const myEmployeeId = user?.employees?.[0]?.id;
    if (!myEmployeeId) {
      return { list: [], total: 0, page: range.page, pageSize: range.pageSize };
    }
    const where: any = { employeeId: myEmployeeId };
    if (range.startDate || range.endDate) {
      where.workDate = {};
      if (range.startDate) where.workDate.gte = new Date(range.startDate);
      if (range.endDate) where.workDate.lte = new Date(range.endDate);
    }
    const [list, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: { shift: true },
        orderBy: { workDate: 'asc' },
        skip: (range.page - 1) * range.pageSize,
        take: range.pageSize,
      }),
      this.prisma.schedule.count({ where }),
    ]);
    return { list, total, page: range.page, pageSize: range.pageSize };
  }

  async update(id: number, dto: { employeeId?: number; shiftId?: number; workDate?: string }, userId: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException({ code: ERROR_CODES.SCHEDULE_NOT_FOUND, message: '排班不存在' });
    }

    const targetEmployeeId = dto.employeeId ?? schedule.employeeId;
    await this.assertInScope(targetEmployeeId, userId);

    const data: any = {};
    if (dto.employeeId !== undefined) data.employeeId = dto.employeeId;
    if (dto.shiftId !== undefined) data.shiftId = dto.shiftId;
    if (dto.workDate !== undefined) data.workDate = new Date(dto.workDate);

    try {
      const saved = await this.prisma.schedule.update({ where: { id }, data });
      // 原日期与新日期都要重算：把排班挪走后，原日期可能变成缺勤/休息
      await this.recalcAffected(
        [
          { employeeId: schedule.employeeId, workDate: schedule.workDate },
          { employeeId: targetEmployeeId, workDate: saved.workDate },
        ],
        userId,
      );
      return saved;
    } catch (e) {
      if (errorCode(e) === 'P2002') {
        throw new ConflictException({ code: 2002, message: '该员工当日已排班' });
      }
      if (errorCode(e) === 'P2003') {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.SCHEDULE_TARGET_NOT_FOUND,
          message: '员工或班次不存在',
        });
      }
      throw e;
    }
  }

  async remove(id: number, userId: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException({ code: ERROR_CODES.SCHEDULE_NOT_FOUND, message: '排班不存在' });
    }
    await this.assertInScope(schedule.employeeId, userId);

    await this.prisma.schedule.delete({ where: { id } });
    await this.recalcAffected(
      [{ employeeId: schedule.employeeId, workDate: schedule.workDate }],
      userId,
    );
    return { success: true };
  }

  /**
   * 批量清除：一次查存在性/越权 + 一次 deleteMany。
   * 前端「清除当日」可能一次删几十上百条，逐条 remove 就是 N 次查询 + N 次删除。
   * 整体校验：任一记录不存在或越权即整体拒绝（不半删），保持与 batch 写一样的原子语义。
   */
  async batchRemove(ids: number[], userId: number) {
    // 去重：重复 id 会让「查到的行数 ≠ 传入条数」误判成记录不存在
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return { count: 0 };
    const rows = await this.prisma.schedule.findMany({ where: { id: { in: uniqueIds } } });
    if (rows.length !== uniqueIds.length) {
      throw new NotFoundException({ code: ERROR_CODES.SCHEDULE_NOT_FOUND, message: '排班不存在' });
    }
    await this.assertManyInScope(
      rows.map((r) => r.employeeId),
      userId,
    );
    const { count } = await this.prisma.schedule.deleteMany({ where: { id: { in: uniqueIds } } });
    await this.recalcAffected(
      rows.map((r) => ({ employeeId: r.employeeId, workDate: r.workDate })),
      userId,
    );
    return { count };
  }

  /**
   * 排班变更后重算受影响的日报（仅「过去」的业务日）。
   *
   * 日报行的 shiftId / 迟到早退分钟数是生成那一刻的排班快照：改完排班若不重算，
   * 历史日报仍是旧班次口径（比如把缺勤改成休息，日报里仍记缺勤）——而且过去日期
   * 不会有定时任务再碰（每日 02:00 的重算只覆盖「昨天」一天），只能靠管理员手动
   * 「重新计算」修复，极易遗漏。
   *
   * 打卡侧不受此影响：PunchService 每次打卡都实时查排班，迟到/早退/准入立即
   * 按新班次判定。
   *
   * 只重算 workDate < 今天的日期：当天的日报行可能只有一张上班卡，引擎按首末卡
   * 推算会把「还在上班中」重写成 early/absent 之类的瞬时值；当天的口径以打卡路径
   * 为准（打卡实时查排班），次日凌晨的定时重算会兜底修正。
   *
   * 每个 (员工, 日期) 独立 try/catch：某天月报已确认（重算被拒）不应阻断排班写入
   * 本身 —— 排班是主操作，重算是尽力而为的同步。
   */
  private async recalcAffected(
    pairs: { employeeId: number; workDate: Date }[],
    userId: number,
  ): Promise<void> {
    const today = beijingBusinessDate();
    const seen = new Set<string>();
    for (const p of pairs) {
      if (p.workDate.getTime() >= today.getTime()) continue;
      const dateStr = p.workDate.toISOString().slice(0, 10);
      const key = `${p.employeeId}:${dateStr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await this.dailyService.recalculate({
          employeeId: p.employeeId,
          startDate: dateStr,
          endDate: dateStr,
          userId,
        });
      } catch (e) {
        this.logger.warn(
          `排班变更后重算日报失败（employeeId=${p.employeeId}, date=${dateStr}）: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  private async assertInScope(employeeId: number, userId: number) {
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId) {
      if (employeeId !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: 5003, message: '无权限为该员工排班' });
      }
      return;
    }
    if (scope.all) return;
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: 5003, message: '无权限为该员工排班' });
    }
  }

  /**
   * 批量权限校验：一次 visibleScope + 一次 employee.findMany。
   * 与 assertInScope 语义一致（自助用户只能排自己、主管只能排负责部门），但不按人数放大查询。
   */
  private async assertManyInScope(employeeIds: number[], userId: number) {
    const unique = Array.from(new Set(employeeIds));
    if (unique.length === 0) return;
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId) {
      if (unique.some((id) => id !== scope.selfEmployeeId)) {
        throw new ForbiddenException({ code: 5003, message: '无权限为该员工排班' });
      }
      return;
    }
    if (scope.all) return;
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: unique } },
      select: { id: true, departmentId: true },
    });
    const allowed = new Set(
      employees.filter((e) => scope.ids.includes(e.departmentId)).map((e) => e.id),
    );
    if (unique.some((id) => !allowed.has(id))) {
      throw new ForbiddenException({ code: 5003, message: '无权限为该员工排班' });
    }
  }
}
