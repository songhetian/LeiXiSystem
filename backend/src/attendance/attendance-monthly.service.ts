import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { buildMonthly, type DailyRecord } from './engine/monthly-engine';

@Injectable()
export class AttendanceMonthlyService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private eventEmitter: EventEmitter2,
  ) {}

  async generate(params: {
    employeeId?: number;
    month: string;
    userId: number;
  }) {
    const { employeeId, month, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    const existingConfirmed = await this.prisma.attendanceMonthly.findFirst({
      where: {
        month,
        status: 'confirmed',
        ...(employeeId ? { employeeId } : {}),
        ...(!scope.all ? { employee: { departmentId: { in: scope.ids } } } : {}),
      },
    });
    if (existingConfirmed) {
      throw new ConflictException({ code: 2004, message: '月报已确认，不可重新生成' });
    }

    const dailyWhere: Prisma.AttendanceDailyWhereInput = {
      workDate: { gte: startDate, lte: endDate },
    };
    if (employeeId) dailyWhere.employeeId = employeeId;
    if (!scope.all) {
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

    let count = 0;
    for (const [empId, empDailies] of grouped) {
      const result = buildMonthly(empDailies);
      await this.prisma.attendanceMonthly.upsert({
        where: { employeeId_month: { employeeId: empId, month } },
        create: {
          employeeId: empId,
          month,
          workDays: result.workDays,
          lateCount: result.lateCount,
          earlyCount: result.earlyCount,
          absentDays: result.absentDays,
          leaveMinutes: result.leaveMinutes,
          overtimeHours: result.overtimeHours,
          status: 'draft',
        },
        update: {
          workDays: result.workDays,
          lateCount: result.lateCount,
          earlyCount: result.earlyCount,
          absentDays: result.absentDays,
          leaveMinutes: result.leaveMinutes,
          overtimeHours: result.overtimeHours,
          status: 'draft',
        },
      });
      count++;
    }

    return { count };
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
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) where.employeeId = employeeId;
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
    const monthly = await this.prisma.attendanceMonthly.findUnique({
      where: { id },
    });
    if (!monthly) {
      throw new ConflictException({ code: 2005, message: '月报不存在' });
    }
    if (monthly.status === 'confirmed') {
      throw new ConflictException({ code: 2004, message: '月报已确认' });
    }

    const result = await this.prisma.attendanceMonthly.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    });

    const allMonthly = await this.prisma.attendanceMonthly.findMany({
      where: { month: result.month, status: 'confirmed' },
      select: { id: true, employeeId: true, workDays: true, lateCount: true, earlyCount: true, absentDays: true, overtimeHours: true },
    });

    this.eventEmitter.emit('attendance.monthly.confirmed', {
      monthlyId: result.id,
      month: result.month,
      confirmedBy: userId,
      confirmedAt: result.confirmedAt,
      employeeCount: allMonthly.length,
      totalWorkDays: allMonthly.reduce((sum, m) => sum + Number(m.workDays), 0),
      records: allMonthly,
    });

    return result;
  }
}
