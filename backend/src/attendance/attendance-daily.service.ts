import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { buildDaily, type Shift as EngineShift } from './engine/attendance-engine';
import { mergeLeaveMakeupIntoDaily, type LeaveRecordInput } from './engine/daily-status-merger';

@Injectable()
export class AttendanceDailyService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
  ) {}

  async recalculate(params: {
    employeeId?: number;
    startDate: string;
    endDate: string;
    userId: number;
  }) {
    const { employeeId, startDate, endDate, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const scheduleWhere: Prisma.ScheduleWhereInput = {
      workDate: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (employeeId) scheduleWhere.employeeId = employeeId;
    if (!scope.all) {
      scheduleWhere.employee = { departmentId: { in: scope.ids } };
    }

    const schedules = await this.prisma.schedule.findMany({
      where: scheduleWhere,
      include: {
        employee: { select: { id: true, employeeNo: true } },
        shift: true,
      },
      orderBy: [{ workDate: 'asc' }, { employeeId: 'asc' }],
    });

    const employeeIds = [...new Set(schedules.map(s => s.employeeId))];
    const leaveRecords = await this.prisma.leaveRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'approved',
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
    });

    const leaveMap = new Map<string, typeof leaveRecords>();
    for (const leave of leaveRecords) {
      const key = `${leave.employeeId}`;
      if (!leaveMap.has(key)) leaveMap.set(key, []);
      leaveMap.get(key)!.push(leave);
    }

    let count = 0;
    for (const sched of schedules) {
      const workDate = sched.workDate;
      const shiftEngine: EngineShift = {
        start: sched.shift.startTime,
        end: sched.shift.endTime,
        isNextDay: sched.shift.isNextDay,
      };

      let punchStart = new Date(workDate);
      punchStart.setHours(0, 0, 0, 0);
      let punchEnd = new Date(workDate);
      punchEnd.setHours(23, 59, 59, 999);
      if (sched.shift.isNextDay) {
        punchEnd = new Date(punchEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const punches = await this.prisma.punchLog.findMany({
        where: {
          employeeNo: sched.employee.employeeNo,
          punchTime: { gte: punchStart, lte: punchEnd },
        },
        orderBy: { punchTime: 'asc' },
      });

      const punchTimes = punches.map((p) => ({
        time: this.formatTime(p.punchTime),
      }));

      const result = buildDaily(punchTimes, shiftEngine);

      const empLeaves = leaveMap.get(`${sched.employeeId}`) || [];
      const dayLeaves: LeaveRecordInput[] = empLeaves
        .filter((l) => {
          const lStart = new Date(l.startDate);
          const lEnd = new Date(l.endDate);
          const wd = new Date(workDate);
          return wd >= lStart && wd <= lEnd;
        })
        .map((l) => ({
          status: l.status as 'approved',
          days: this.calcDailyLeaveDays(l, workDate),
          isFullDay: this.isFullDayLeave(l, workDate),
        }));

      const isWeekend = workDate.getDay() === 0 || workDate.getDay() === 6;
      const merged = mergeLeaveMakeupIntoDaily(result, dayLeaves, [], { isWeekend });

      const firstPunch = merged.firstPunch
        ? this.combineDateTime(workDate, merged.firstPunch, sched.shift.isNextDay, false)
        : null;
      const lastPunch = merged.lastPunch
        ? this.combineDateTime(workDate, merged.lastPunch, sched.shift.isNextDay, true)
        : null;

      await this.prisma.attendanceDaily.upsert({
        where: {
          employeeId_workDate: { employeeId: sched.employeeId, workDate },
        },
        create: {
          employeeId: sched.employeeId,
          workDate,
          shiftId: sched.shiftId,
          scheduleId: sched.id,
          firstPunch,
          lastPunch,
          punchCount: merged.punchCount,
          lateMinutes: merged.lateMinutes,
          earlyMinutes: merged.earlyMinutes,
          overtimeMinutes: merged.overtimeMinutes,
          leaveDays: merged.leaveDays,
          status: merged.status as any,
        },
        update: {
          shiftId: sched.shiftId,
          scheduleId: sched.id,
          firstPunch,
          lastPunch,
          punchCount: merged.punchCount,
          lateMinutes: merged.lateMinutes,
          earlyMinutes: merged.earlyMinutes,
          overtimeMinutes: merged.overtimeMinutes,
          leaveDays: merged.leaveDays,
          status: merged.status as any,
        },
      });
      count++;
    }

    return { count };
  }

  async list(params: {
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    userId: number;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, startDate, endDate, status, userId, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.AttendanceDailyWhereInput = {};
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) where.employeeId = employeeId;
    if (startDate && endDate) {
      where.workDate = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    if (status) where.status = status as any;

    const [list, total] = await Promise.all([
      this.prisma.attendanceDaily.findMany({
        where,
        include: {
          employee: { select: { id: true, employeeNo: true, name: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        },
        orderBy: [{ workDate: 'desc' }, { employeeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attendanceDaily.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  private formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private combineDateTime(workDate: Date, timeStr: string, isNextDay: boolean, isLast: boolean): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(workDate);
    if (isNextDay && isLast && h < 12) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(h, m, 0, 0);
    return d;
  }

  private calcDailyLeaveDays(leave: any, workDate: Date): number {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const wd = new Date(workDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    wd.setHours(0, 0, 0, 0);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (totalDays <= 1) return Number(leave.days) || 1;
    return Math.min(1, Number(leave.days) / totalDays || 1);
  }

  private isFullDayLeave(leave: any, workDate: Date): boolean {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const wd = new Date(workDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    wd.setHours(0, 0, 0, 0);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (totalDays <= 1) return true;
    const daily = Number(leave.days) / totalDays;
    return daily >= 1;
  }
}
