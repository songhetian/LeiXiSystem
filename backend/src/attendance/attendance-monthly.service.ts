import { Injectable, ConflictException, ForbiddenException, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService, scopeIsEmpty } from '../common/data-scope.service';
import { Prisma, $Enums } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { buildMonthly, type DailyRecord } from './engine/monthly-engine';
import { ERROR_CODES } from '../common/error-codes';
import { monthRangeUtc } from '../common/date.util';
import { DistributedLockService, LockAcquisitionError } from '../common/distributed-lock.service';

const LOCK_TTL_MS = 120_000;

// 日报以「天」记录请假（leaveDays Decimal），月报以「分钟」汇总（leaveMinutes Int）：
// 口径 8 小时 = 1 天（与 S06 调休换算一致）。
const MINUTES_PER_WORK_DAY = 480;

@Injectable()
export class AttendanceMonthlyService {
  private readonly logger = new Logger(AttendanceMonthlyService.name);

  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private eventEmitter: EventEmitter2,
    private lockService: DistributedLockService,
  ) {}

  async generate(params: {
    employeeId?: number;
    month: string;
    userId: number;
  }) {
    const { employeeId, month, userId } = params;
    const lockKey = employeeId
      ? `attendance:monthly:gen:${month}:${employeeId}`
      : `attendance:monthly:gen:${month}`;
    return this.lockService.withLock(lockKey, LOCK_TTL_MS, async () => {
      const scope = await this.dataScope.visibleScope(userId);

      // 业务日（workDate）以 UTC 午夜存储，月区间必须用 Date.UTC 构造
      const { start: startDate, end: endDate } = monthRangeUtc(month);

      const existingConfirmed = await this.prisma.attendanceMonthly.findFirst({
        where: {
          month,
          status: 'confirmed',
          ...(employeeId ? { employeeId } : {}),
          ...(scope.selfEmployeeId
            ? { employeeId: scope.selfEmployeeId }
            : !scope.all
              ? { employee: { departmentId: { in: scope.ids } } }
              : {}),
        },
      });
      if (existingConfirmed) {
        throw new ConflictException({
          code: ERROR_CODES.MONTHLY_ALREADY_CONFIRMED,
          message: '月报已确认，不可重新生成',
        });
      }

      const dailyWhere: Prisma.AttendanceDailyWhereInput = {
        workDate: { gte: startDate, lt: endDate },
      };
      if (employeeId) dailyWhere.employeeId = employeeId;
      if (scope.selfEmployeeId) {
        dailyWhere.employeeId = scope.selfEmployeeId;
      } else if (!scope.all) {
        dailyWhere.employee = { departmentId: { in: scope.ids } };
      }

      const dailies = await this.prisma.attendanceDaily.findMany({
        where: dailyWhere,
        orderBy: [{ employeeId: 'asc' }, { workDate: 'asc' }],
      });

      const grouped = new Map<number, DailyRecord[]>();
      for (const d of dailies) {
        if (!grouped.has(d.employeeId)) {
          grouped.set(d.employeeId, []);
        }
        grouped.get(d.employeeId)!.push({
          workDate: d.workDate.toISOString().slice(0, 10),
          status: d.status as $Enums.AttendanceDailyStatus,
          lateMinutes: d.lateMinutes,
          earlyMinutes: d.earlyMinutes,
          overtimeMinutes: d.overtimeMinutes,
          // 请假天数 → 分钟：此前硬编码 0，导致月报「请假时长」恒 0，
          // 算薪 noLeave 恒为 true，有请假的员工照样拿全勤奖
          leaveMinutes: Math.round(Number(d.leaveDays ?? 0) * MINUTES_PER_WORK_DAY),
        });
      }

      const result = await this.prisma.$transaction(async (tx) => {
        let count = 0;
        for (const [empId, empDailies] of grouped) {
          const monthlyResult = buildMonthly(empDailies);
          await tx.attendanceMonthly.upsert({
            where: { employeeId_month: { employeeId: empId, month } },
            create: {
              employeeId: empId,
              month,
              workDays: monthlyResult.workDays,
              lateCount: monthlyResult.lateCount,
              earlyCount: monthlyResult.earlyCount,
              totalLateMinutes: monthlyResult.totalLateMinutes,
              totalEarlyMinutes: monthlyResult.totalEarlyMinutes,
              absentDays: monthlyResult.absentDays,
              leaveMinutes: monthlyResult.leaveMinutes,
              overtimeHours: monthlyResult.overtimeHours,
              status: 'draft',
            },
            update: {
              workDays: monthlyResult.workDays,
              lateCount: monthlyResult.lateCount,
              earlyCount: monthlyResult.earlyCount,
              totalLateMinutes: monthlyResult.totalLateMinutes,
              totalEarlyMinutes: monthlyResult.totalEarlyMinutes,
              absentDays: monthlyResult.absentDays,
              leaveMinutes: monthlyResult.leaveMinutes,
              overtimeHours: monthlyResult.overtimeHours,
              status: 'draft',
            },
          });
          count++;
        }
        return { count };
      });

      return result;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
    });
  }

  async list(params: {
    employeeId?: number;
    departmentId?: number;
    month?: string;
    status?: string;
    userId: number;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, departmentId, month, status, userId, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.AttendanceMonthlyWhereInput = {};
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({
          code: ERROR_CODES.DATA_NO_PERMISSION,
          message: '无权查看其他员工的记录',
        });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }
    // 部门维度过滤（报表按部门查看/导出）：叠加在数据权限之上，交集即不越权
    if (departmentId && !scope.selfEmployeeId) {
      if (!scope.all) {
        where.AND = [{ employee: { departmentId } }];
      } else {
        where.employee = { departmentId };
      }
    }
    if (month) where.month = month;
    if (status) where.status = status as $Enums.AttendanceMonthlyStatus;

    const [list, total] = await Promise.all([
      this.prisma.attendanceMonthly.findMany({
        where,
        include: {
          employee: { select: { id: true, employeeNo: true, name: true, department: { select: { id: true, name: true } } } },
        },
        orderBy: [{ month: 'desc' }, { employeeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attendanceMonthly.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async confirm(id: number, userId: number) {
    return this.lockService.withLock(`attendance:monthly:confirm:${id}`, LOCK_TTL_MS, async () => {
      const scope = await this.dataScope.visibleScope(userId);
      const existing = await this.prisma.attendanceMonthly.findUnique({ where: { id } });
      if (!existing) {
        throw new ConflictException({
          code: ERROR_CODES.MONTHLY_NOT_FOUND,
          message: '月报不存在',
        });
      }

      if (scope.selfEmployeeId && scope.selfEmployeeId !== existing.employeeId) {
        throw new ForbiddenException({
          code: ERROR_CODES.DATA_NO_PERMISSION,
          message: '无权操作其他员工的记录',
        });
      }
      if (!scope.all && scope.ids.length > 0) {
        const emp = await this.prisma.employee.findUnique({ where: { id: existing.employeeId } });
        if (!emp || !scope.ids.includes(emp.departmentId)) {
          throw new ForbiddenException({
            code: ERROR_CODES.DATA_NO_PERMISSION,
            message: '无权操作其他员工的记录',
          });
        }
      }
      // 既无全量权限、又无部门范围、又未关联员工 → 无任何数据可见范围，
      // 不得静默放行为任意员工确认月报（否则构成横向越权）。
      if (scopeIsEmpty(scope)) {
        throw new ForbiddenException({
          code: ERROR_CODES.DATA_NO_PERMISSION,
          message: '无权操作其他员工的记录',
        });
      }

      const updated = await this.prisma.attendanceMonthly.updateMany({
        where: { id, status: 'draft' },
        data: {
          status: 'confirmed',
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        const current = await this.prisma.attendanceMonthly.findUnique({ where: { id } });
        if (!current) {
          throw new ConflictException({
            code: ERROR_CODES.MONTHLY_NOT_FOUND,
            message: '月报不存在',
          });
        }
        if (current.status === 'confirmed') {
          throw new ConflictException({
            code: ERROR_CODES.MONTHLY_ALREADY_CONFIRMED,
            message: '月报已确认',
          });
        }
        throw new ConflictException({
          code: ERROR_CODES.MONTHLY_NOT_FOUND,
          message: '当前状态不可确认',
        });
      }

      const result = await this.prisma.attendanceMonthly.findUnique({ where: { id } });
      if (!result) {
        throw new ConflictException({
          code: ERROR_CODES.MONTHLY_NOT_FOUND,
          message: '月报不存在',
        });
      }

      const allMonthly = await this.prisma.attendanceMonthly.findMany({
        where: { month: result.month, status: 'confirmed' },
        select: { id: true, employeeId: true, workDays: true, lateCount: true, earlyCount: true, absentDays: true, overtimeHours: true },
      });

      try {
        this.eventEmitter.emit('attendance.monthly.confirmed', {
          monthlyId: result.id,
          month: result.month,
          confirmedBy: userId,
          confirmedAt: result.confirmedAt,
          employeeCount: allMonthly.length,
          totalWorkDays: allMonthly.reduce((sum, m) => sum + Number(m.workDays), 0),
          records: allMonthly,
        });
      } catch (err) {
        this.logger.error(
          `发送月报确认事件失败 [id=${id}]: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return result;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
    });
  }

  async unconfirm(id: number, userId: number) {
    return this.lockService.withLock(`attendance:monthly:unconfirm:${id}`, LOCK_TTL_MS, async () => {
      const scope = await this.dataScope.visibleScope(userId);
      const existing = await this.prisma.attendanceMonthly.findUnique({ where: { id } });
      if (!existing) {
        throw new ConflictException({
          code: ERROR_CODES.MONTHLY_NOT_FOUND,
          message: '月报不存在',
        });
      }

      if (scope.selfEmployeeId && scope.selfEmployeeId !== existing.employeeId) {
        throw new ForbiddenException({
          code: ERROR_CODES.DATA_NO_PERMISSION,
          message: '无权操作其他员工的记录',
        });
      }
      if (!scope.all && scope.ids.length > 0) {
        const emp = await this.prisma.employee.findUnique({ where: { id: existing.employeeId } });
        if (!emp || !scope.ids.includes(emp.departmentId)) {
          throw new ForbiddenException({
            code: ERROR_CODES.DATA_NO_PERMISSION,
            message: '无权操作其他员工的记录',
          });
        }
      }
      // 同 confirm：无任何数据可见范围时不得放行（横向越权）。
      if (scopeIsEmpty(scope)) {
        throw new ForbiddenException({
          code: ERROR_CODES.DATA_NO_PERMISSION,
          message: '无权操作其他员工的记录',
        });
      }

      const updated = await this.prisma.attendanceMonthly.updateMany({
        where: { id, status: 'confirmed' },
        data: {
          status: 'draft',
          confirmedBy: null,
          confirmedAt: null,
        },
      });
      if (updated.count === 0) {
        const current = await this.prisma.attendanceMonthly.findUnique({ where: { id } });
        if (!current) {
          throw new ConflictException({
            code: ERROR_CODES.MONTHLY_NOT_FOUND,
            message: '月报不存在',
          });
        }
        throw new BadRequestException({
          code: ERROR_CODES.MONTHLY_NOT_CONFIRMED,
          message: '月报未确认，不可取消确认',
        });
      }

      const result = await this.prisma.attendanceMonthly.findUnique({ where: { id } });
      if (!result) {
        throw new ConflictException({
          code: ERROR_CODES.MONTHLY_NOT_FOUND,
          message: '月报不存在',
        });
      }

      try {
        this.eventEmitter.emit('attendance.monthly.unconfirmed', {
          monthlyId: result.id,
          month: result.month,
          unconfirmedBy: userId,
          employeeId: result.employeeId,
        });
      } catch (err) {
        this.logger.error(
          `发送月报取消确认事件失败 [id=${id}]: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return result;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
    });
  }

  async checkMonthlyConfirmed(employeeId: number, workDate: Date): Promise<boolean> {
    // 业务日以 UTC 午夜存储，取年月必须用 getUTC*：本地 getter 在负时区会退回前一天/上一月
    const year = workDate.getUTCFullYear();
    const month = String(workDate.getUTCMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;

    const monthly = await this.prisma.attendanceMonthly.findUnique({
      where: {
        employeeId_month: {
          employeeId,
          month: monthStr,
        },
      },
      select: { status: true },
    });

    return monthly?.status === 'confirmed';
  }

  async checkDateRangeHasConfirmedMonthly(params: {
    employeeId?: number;
    startDate: string;
    endDate: string;
    userId: number;
  }): Promise<void> {
    const { employeeId, startDate, endDate, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // startDate/endDate 为 'YYYY-MM-DD'（UTC 午夜），月份区间必须用 getUTC*
    const startYear = start.getUTCFullYear();
    const startMonth = start.getUTCMonth();
    const endYear = end.getUTCFullYear();
    const endMonth = end.getUTCMonth();

    const months: string[] = [];
    let curYear = startYear;
    let curMonth = startMonth;
    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      months.push(`${curYear}-${String(curMonth + 1).padStart(2, '0')}`);
      curMonth++;
      if (curMonth > 11) {
        curMonth = 0;
        curYear++;
      }
    }

    const where: Prisma.AttendanceMonthlyWhereInput = {
      month: { in: months },
      status: 'confirmed',
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }

    const confirmedCount = await this.prisma.attendanceMonthly.count({ where });
    if (confirmedCount > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.DAILY_LOCKED_BY_MONTHLY,
        message: '所选日期范围内存在已确认的月报，不可编辑考勤日报',
      });
    }
  }
}
