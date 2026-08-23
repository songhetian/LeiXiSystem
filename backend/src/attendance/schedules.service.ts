import { Injectable, ConflictException, UnprocessableEntityException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';

// 排班聚合（S04）：员工×日期×班次，uk(employee, workDate)；重复 → 2002（含批量原子性）
@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async create(dto: { employeeId: number; shiftId: number; workDate: string }, userId: number) {
    // 数据隔离：经理只能给本部门员工排班（ADR-0010）
    await this.assertInScope(dto.employeeId, userId);
    try {
      const workDate = new Date(dto.workDate);
      // upsert：同一员工同一天已有排班则覆盖为本次班次，而非抛出“排班重复”
      return await this.prisma.schedule.upsert({
        where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
        create: { employeeId: dto.employeeId, shiftId: dto.shiftId, workDate },
        update: { shiftId: dto.shiftId },
      });
    } catch (e: any) {
      if (e.code === 'P2003') {
        throw new UnprocessableEntityException({ code: 1002, message: '员工或班次不存在' });
      }
      throw e;
    }
  }

  // 批量排班：事务内逐条 upsert，冲突覆盖而非报错（幂等）
  async batch(items: { employeeId: number; shiftId: number; workDate: string }[], userId: number) {
    for (const item of items) {
      await this.assertInScope(item.employeeId, userId);
    }
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
      return { count };
    } catch (e: any) {
      if (e.code === 'P2003') {
        throw new UnprocessableEntityException({ code: 1002, message: '员工或班次不存在' });
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
        throw new ForbiddenException({ code: 4030, message: '无权查看其他员工的记录' });
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
      throw new NotFoundException({ code: 2002, message: '排班不存在' });
    }

    const targetEmployeeId = dto.employeeId ?? schedule.employeeId;
    await this.assertInScope(targetEmployeeId, userId);

    const data: any = {};
    if (dto.employeeId !== undefined) data.employeeId = dto.employeeId;
    if (dto.shiftId !== undefined) data.shiftId = dto.shiftId;
    if (dto.workDate !== undefined) data.workDate = new Date(dto.workDate);

    try {
      return await this.prisma.schedule.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2002, message: '该员工当日已排班' });
      }
      if (e.code === 'P2003') {
        throw new UnprocessableEntityException({ code: 1002, message: '员工或班次不存在' });
      }
      throw e;
    }
  }

  async remove(id: number, userId: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException({ code: 2002, message: '排班不存在' });
    }
    await this.assertInScope(schedule.employeeId, userId);

    await this.prisma.schedule.delete({ where: { id } });
    return { success: true };
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
}
