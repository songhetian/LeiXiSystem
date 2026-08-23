import { Injectable, ConflictException, ForbiddenException, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { buildMonthly, type DailyRecord } from './engine/monthly-engine';
import { ERROR_CODES } from '../common/error-codes';
import { DistributedLockService, LockAcquisitionError } from '../common/distributed-lock.service';

const LOCK_TTL_MS = 120_000;

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

      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);

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
        workDate: { gte: startDate, lte: endDate },
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
          status: d.status as any,
          lateMinutes: d.lateMinutes,
          earlyMinutes: d.earlyMinutes,
          overtimeMinutes: d.overtimeMinutes,
          leaveMinutes: 0,
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
              absentDays: monthlyResult.absentDays,
              leaveMinutes: monthlyResult.leaveMinutes,
              overtimeHours: monthlyResult.overtimeHours,
              status: 'draft',
            },
            update: {
              workDays: monthlyResult.workDays,
              lateCount: monthlyResult.lateCount,
              earlyCount: monthlyResult.earlyCount,
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
    month?: string;
    status?: string;
    userId: number;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, month, status, userId, page, pageSize } = params;
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
    if (month) where.month = month;
    if (status) where.status = status as any;

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
    const year = workDate.getFullYear();
    const month = String(workDate.getMonth() + 1).padStart(2, '0');
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

    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

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
