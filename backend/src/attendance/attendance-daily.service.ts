import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';
import { Prisma } from '@prisma/client';
import { buildDaily, type Shift as EngineShift } from './engine/attendance-engine';
import { mergeLeaveMakeupIntoDaily, type LeaveRecordInput, type MakeupRecordInput } from './engine/daily-status-merger';
import { AttendanceMonthlyService } from './attendance-monthly.service';
import { beijingDateTime } from '../common/date.util';

@Injectable()
export class AttendanceDailyService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private monthlyService: AttendanceMonthlyService,
  ) {}

  async recalculate(params: {
    employeeId?: number;
    startDate: string;
    endDate: string;
    userId: number;
  }) {
    const { employeeId, startDate, endDate, userId } = params;

    await this.monthlyService.checkDateRangeHasConfirmedMonthly({
      employeeId,
      startDate,
      endDate,
      userId,
    });

    const scope = await this.dataScope.visibleScope(userId);

    const scheduleWhere: Prisma.ScheduleWhereInput = {
      workDate: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (employeeId) scheduleWhere.employeeId = employeeId;
    if (scope.selfEmployeeId) {
      scheduleWhere.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
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

    // 补卡审批只回写考勤日报、不写 punchLog，重算若不把这些已通过的补卡读回来一并归并，
    // 次日 02:00 的全量重算就会把补卡效果覆盖掉（状态退回迟到/缺勤）。
    const approvedMakeups = await this.prisma.punchMakeup.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'approved',
        punchDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
    });

    // punchDate 以 @db.Date（UTC 午夜）存储，键必须与 workDate 同用 UTC 口径对齐
    const makeupMap = new Map<string, typeof approvedMakeups>();
    for (const makeup of approvedMakeups) {
      const key = `${makeup.employeeId}:${makeup.punchDate.toISOString().slice(0, 10)}`;
      if (!makeupMap.has(key)) makeupMap.set(key, []);
      makeupMap.get(key)!.push(makeup);
    }

    // 批量查询所有打卡记录，避免 N+1（原先在循环内逐条查询）
    const employeeNos = [...new Set(schedules.map((s) => s.employee.employeeNo))];
    // 业务日是北京时间的日历日，而 punchTime 是真实时刻，窗口必须按 Asia/Shanghai 换算。
    // 右侧用「结束日 +2 天的 0 点」并配 lt：既覆盖 isNextDay 跨天班次，又避免漏掉 23:59 的打卡。
    const batchStart = beijingDateTime(new Date(startDate), '00:00');
    const batchEnd = beijingDateTime(new Date(endDate), '00:00', 2);

    const allPunches = await this.prisma.punchLog.findMany({
      where: {
        employeeNo: { in: employeeNos },
        punchTime: { gte: batchStart, lt: batchEnd },
      },
      orderBy: { punchTime: 'asc' },
    });

    const punchMap = new Map<string, typeof allPunches>();
    for (const p of allPunches) {
      if (!punchMap.has(p.employeeNo)) punchMap.set(p.employeeNo, []);
      punchMap.get(p.employeeNo)!.push(p);
    }

    let count = 0;
    for (const sched of schedules) {
      const workDate = sched.workDate;
      const shiftEngine: EngineShift = {
        start: sched.shift.startTime,
        end: sched.shift.endTime,
        isNextDay: sched.shift.isNextDay,
      };

      // 与该业务日的北京时间窗口对齐；跨天班次顺延一整天，右侧用 lt 排他
      const punchStart = beijingDateTime(workDate, '00:00');
      const punchEnd = beijingDateTime(workDate, '00:00', sched.shift.isNextDay ? 2 : 1);

      const punches = (punchMap.get(sched.employee.employeeNo) || []).filter(
        (p) => p.punchTime >= punchStart && p.punchTime < punchEnd,
      );

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

      // 业务日以 UTC 午夜存储，判周末必须用 getUTCDay()：本地 getDay() 在负时区会读成前一天
      const isWeekend = workDate.getUTCDay() === 0 || workDate.getUTCDay() === 6;
      const dayMakeups: MakeupRecordInput[] = (
        makeupMap.get(`${sched.employeeId}:${workDate.toISOString().slice(0, 10)}`) || []
      ).map((m) => ({
        status: 'approved',
        punchTime: m.makeupTime ? this.formatTime(m.makeupTime) : '',
      }));
      const merged = mergeLeaveMakeupIntoDaily(result, dayLeaves, dayMakeups, { isWeekend });

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
    departmentId?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    userId: number;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, departmentId, startDate, endDate, status, userId, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.AttendanceDailyWhereInput = {};
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
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

  /** 格式化真实时刻为北京时间的 "HH:mm"（班次时刻同样按北京时间定义） */
  private formatTime(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${pick('hour')}:${pick('minute')}`;
  }

  private combineDateTime(workDate: Date, timeStr: string, isNextDay: boolean, isLast: boolean): Date {
    const [h] = timeStr.split(':').map(Number);
    const addDays = isNextDay && isLast && h < 12 ? 1 : 0;
    return beijingDateTime(workDate, timeStr, addDays);
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
