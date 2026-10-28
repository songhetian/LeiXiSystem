import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';
import { Prisma, $Enums } from '@prisma/client';
import { buildDaily, buildRestDayDaily, type Shift as EngineShift } from './engine/attendance-engine';
import { mergeLeaveMakeupIntoDaily, type MakeupRecordInput } from './engine/daily-status-merger';
import { AttendanceMonthlyService } from './attendance-monthly.service';
import { beijingDateTime, beijingBusinessDate } from '../common/date.util';
import {
  dayTypeFlags,
  resolveDayType,
  splitOvertimeMinutes,
  type HolidayDayType,
} from './engine/workday-calendar';
import { capOvertimeByApproval } from './overtime-cap';
import { loadHolidayCalendar } from './holiday-calendar';

// 考勤业务日以 @db.Date（UTC 午夜）存储；补卡匹配键必须与 workDate 同用 UTC 口径，
// 否则东八区凌晨的日期会错位一天。此处单一来源，避免建 map 与查 map 各写一份。
function makeupMatchKey(employeeId: number, date: Date): string {
  return `${employeeId}:${date.toISOString().slice(0, 10)}`;
}

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

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    const scheduleWhere: Prisma.ScheduleWhereInput = {
      workDate: {
        gte: rangeStart,
        lte: rangeEnd,
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

    // 无排班日到岗（休息日/法定节假日加班）没有 schedule 行可循环，故必须另行按「员工」定位。
    // 一次查出可见范围内的员工，兼作 employeeNo → employeeId 的映射与越权过滤。
    const scopedEmployeeWhere: Prisma.EmployeeWhereInput = {};
    if (employeeId) scopedEmployeeWhere.id = employeeId;
    if (scope.selfEmployeeId) {
      scopedEmployeeWhere.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      scopedEmployeeWhere.departmentId = { in: scope.ids };
    }
    const scopedEmployees = await this.prisma.employee.findMany({
      where: scopedEmployeeWhere,
      select: { id: true, employeeNo: true },
    });

    const employeeIdByNo = new Map<string, number>();
    for (const e of scopedEmployees) employeeIdByNo.set(e.employeeNo, e.id);
    for (const s of schedules) employeeIdByNo.set(s.employee.employeeNo, s.employeeId);

    const employeeIds = [...new Set(employeeIdByNo.values())];
    const employeeNos = [...employeeIdByNo.keys()];

    const leaveRecords = employeeIds.length
      ? await this.prisma.leaveRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: 'approved',
            startDate: { lte: rangeEnd },
            endDate: { gte: rangeStart },
          },
          // 是否有薪假决定「全勤奖是否被取消」，日报需要把该标记落到 unpaidLeaveDays
          include: { vacationType: { select: { isPaid: true } } },
        })
      : [];

    const leaveMap = new Map<string, typeof leaveRecords>();
    for (const leave of leaveRecords) {
      const key = `${leave.employeeId}`;
      if (!leaveMap.has(key)) leaveMap.set(key, []);
      leaveMap.get(key)!.push(leave);
    }

    // 补卡审批只回写考勤日报、不写 punchLog，重算若不把这些已通过的补卡读回来一并归并，
    // 次日 02:00 的全量重算就会把补卡效果覆盖掉（状态退回迟到/缺勤）。
    const approvedMakeups = employeeIds.length
      ? await this.prisma.punchMakeup.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: 'approved',
            punchDate: { gte: rangeStart, lte: rangeEnd },
          },
        })
      : [];

    // punchDate 以 @db.Date（UTC 午夜）存储，键必须与 workDate 同用 UTC 口径对齐
    const makeupMap = new Map<string, typeof approvedMakeups>();
    for (const makeup of approvedMakeups) {
      const key = makeupMatchKey(makeup.employeeId, makeup.punchDate);
      if (!makeupMap.has(key)) makeupMap.set(key, []);
      makeupMap.get(key)!.push(makeup);
    }

    // 已批加班申请（折算为分钟）。加班时长严格取 min(申请, 实际)，故必须先备好申请侧。
    const approvedOvertime = employeeIds.length
      ? await this.prisma.overtimeRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: 'approved',
            overtimeDate: { gte: rangeStart, lte: rangeEnd },
          },
          select: { employeeId: true, overtimeDate: true, hours: true },
        })
      : [];
    const approvedOvertimeMinutes = new Map<string, number>();
    for (const o of approvedOvertime) {
      const key = makeupMatchKey(o.employeeId, o.overtimeDate);
      const minutes = Math.round(Number(o.hours) * 60);
      approvedOvertimeMinutes.set(key, (approvedOvertimeMinutes.get(key) ?? 0) + minutes);
    }

    // 节假日/调休日历：决定「当天算工作日/休息日/法定」——加班倍率与日报状态都依赖它
    const calendar = await loadHolidayCalendar(this.prisma, rangeStart, rangeEnd);

    // 业务日是北京时间的日历日，而 punchTime 是真实时刻，窗口必须按 Asia/Shanghai 换算。
    // 右侧用「结束日 +2 天的 0 点」并配 lt：既覆盖 isNextDay 跨天班次，又避免漏掉 23:59 的打卡。
    const batchStart = beijingDateTime(rangeStart, '00:00');
    const batchEnd = beijingDateTime(rangeEnd, '00:00', 2);

    const allPunches = employeeNos.length
      ? await this.prisma.punchLog.findMany({
          where: {
            employeeNo: { in: employeeNos },
            punchTime: { gte: batchStart, lt: batchEnd },
          },
          orderBy: { punchTime: 'asc' },
        })
      : [];

    const punchMap = new Map<string, typeof allPunches>();
    for (const p of allPunches) {
      if (!punchMap.has(p.employeeNo)) punchMap.set(p.employeeNo, []);
      punchMap.get(p.employeeNo)!.push(p);
    }

    let count = 0;
    const scheduledKeys = new Set<string>();
    for (const sched of schedules) {
      const workDate = sched.workDate;
      scheduledKeys.add(makeupMatchKey(sched.employeeId, workDate));
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
      const dayLeaves = empLeaves
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
          isPaid: !!l.vacationType?.isPaid,
        }));

      // 业务日以 UTC 午夜存储，日类型必须走日历 + UTC 星期几：本地 getDay() 在负时区会读成前一天
      const dayType = resolveDayType(workDate, calendar);
      const { isWeekend, isHoliday } = dayTypeFlags(workDate, calendar);

      const dayMakeups: MakeupRecordInput[] = (
        makeupMap.get(makeupMatchKey(sched.employeeId, workDate)) || []
      ).map((m) => ({
        status: 'approved',
        punchTime: m.makeupTime ? this.formatTime(m.makeupTime) : '',
      }));

      const merged = mergeLeaveMakeupIntoDaily(
        result,
        dayLeaves.map((l) => ({ status: l.status, days: l.days, isFullDay: l.isFullDay })),
        dayMakeups,
        { isWeekend, isHoliday },
      );

      // 严格 min(已批申请, 实际超时)：无已批申请 → 不计薪
      const cappedOvertimeMinutes = capOvertimeByApproval(
        merged.overtimeMinutes,
        approvedOvertimeMinutes.get(makeupMatchKey(sched.employeeId, workDate)) ?? null,
      );
      const overtimeSplit = splitOvertimeMinutes(cappedOvertimeMinutes, dayType);

      // 无薪假天数单独累计：全勤奖只被无薪假取消
      const unpaidLeaveDays = dayLeaves
        .filter((l) => !l.isPaid)
        .reduce((sum, l) => sum + l.days, 0);

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
          overtimeMinutes: cappedOvertimeMinutes,
          overtimeWeekdayMinutes: overtimeSplit.weekday,
          overtimeWeekendMinutes: overtimeSplit.weekend,
          overtimeHolidayMinutes: overtimeSplit.holiday,
          leaveDays: merged.leaveDays,
          unpaidLeaveDays,
          status: merged.status as $Enums.AttendanceDailyStatus,
        },
        update: {
          shiftId: sched.shiftId,
          scheduleId: sched.id,
          firstPunch,
          lastPunch,
          punchCount: merged.punchCount,
          lateMinutes: merged.lateMinutes,
          earlyMinutes: merged.earlyMinutes,
          overtimeMinutes: cappedOvertimeMinutes,
          overtimeWeekdayMinutes: overtimeSplit.weekday,
          overtimeWeekendMinutes: overtimeSplit.weekend,
          overtimeHolidayMinutes: overtimeSplit.holiday,
          leaveDays: merged.leaveDays,
          unpaidLeaveDays,
          status: merged.status as $Enums.AttendanceDailyStatus,
        },
      });
      count++;
    }

    count += await this.generateUnscheduledRestDayDailies({
      allPunches,
      employeeIdByNo,
      scheduledKeys,
      calendar,
      approvedOvertimeMinutes,
    });

    return { count };
  }

  /**
   * 无排班日的到岗记录。
   *
   * 日报原本只按排班循环生成，于是「周末/法定节假日到岗但当天没排班」根本不会产生日报，
   * 加班费也就无从计算（漏发）。这里按 (员工, 业务日) 补出这些日报：
   *  - 只处理日历判定为休息日 / 法定节假日的日子；平日无排班不视作「出勤」；
   *  - 迟到/早退无从判定（没有班次可比对），故恒为 0；
   *  - 加班同样受 min(已批申请, 实际) 封顶。
   */
  private async generateUnscheduledRestDayDailies(params: {
    allPunches: Array<{ employeeNo: string; punchTime: Date }>;
    employeeIdByNo: Map<string, number>;
    scheduledKeys: Set<string>;
    calendar: Map<string, HolidayDayType>;
    approvedOvertimeMinutes: Map<string, number>;
  }): Promise<number> {
    const { allPunches, employeeIdByNo, scheduledKeys, calendar, approvedOvertimeMinutes } = params;

    // 打卡按 (员工 → 业务日 → 打卡) 归集。业务日取北京时间的日历日。
    const byEmployee = new Map<string, Map<string, typeof allPunches>>();
    for (const p of allPunches) {
      const employeeId = employeeIdByNo.get(p.employeeNo);
      if (!employeeId) continue;
      const dateKey = beijingBusinessDate(p.punchTime).toISOString().slice(0, 10);
      if (!byEmployee.has(p.employeeNo)) byEmployee.set(p.employeeNo, new Map());
      const byDate = byEmployee.get(p.employeeNo)!;
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(p);
    }

    let count = 0;
    for (const [employeeNo, byDate] of byEmployee) {
      const employeeId = employeeIdByNo.get(employeeNo)!;
      for (const [dateKey, punches] of byDate) {
        const workDate = new Date(`${dateKey}T00:00:00.000Z`);
        // 已有排班的当天由上面的排班循环负责，避免重复
        if (scheduledKeys.has(makeupMatchKey(employeeId, workDate))) continue;

        const dayType = resolveDayType(workDate, calendar);
        if (dayType === 'weekday') continue;

        const { isWeekend, isHoliday } = dayTypeFlags(workDate, calendar);
        const base = buildRestDayDaily(
          punches.map((p) => ({ time: this.formatTime(p.punchTime) })),
        );
        const merged = mergeLeaveMakeupIntoDaily(base, [], [], { isWeekend, isHoliday });

        const cappedOvertimeMinutes = capOvertimeByApproval(
          base.overtimeMinutes,
          approvedOvertimeMinutes.get(makeupMatchKey(employeeId, workDate)) ?? null,
        );
        const overtimeSplit = splitOvertimeMinutes(cappedOvertimeMinutes, dayType);

        const firstPunch = base.firstPunch ? beijingDateTime(workDate, base.firstPunch) : null;
        const lastPunch = base.lastPunch ? beijingDateTime(workDate, base.lastPunch) : null;

        await this.prisma.attendanceDaily.upsert({
          where: { employeeId_workDate: { employeeId, workDate } },
          create: {
            employeeId,
            workDate,
            shiftId: null,
            scheduleId: null,
            firstPunch,
            lastPunch,
            punchCount: base.punchCount,
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeMinutes: cappedOvertimeMinutes,
            overtimeWeekdayMinutes: overtimeSplit.weekday,
            overtimeWeekendMinutes: overtimeSplit.weekend,
            overtimeHolidayMinutes: overtimeSplit.holiday,
            leaveDays: 0,
            unpaidLeaveDays: 0,
            status: merged.status as $Enums.AttendanceDailyStatus,
          },
          update: {
            firstPunch,
            lastPunch,
            punchCount: base.punchCount,
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeMinutes: cappedOvertimeMinutes,
            overtimeWeekdayMinutes: overtimeSplit.weekday,
            overtimeWeekendMinutes: overtimeSplit.weekend,
            overtimeHolidayMinutes: overtimeSplit.holiday,
            leaveDays: 0,
            unpaidLeaveDays: 0,
            status: merged.status as $Enums.AttendanceDailyStatus,
          },
        });
        count++;
      }
    }

    return count;
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
    if (status) where.status = status as $Enums.AttendanceDailyStatus;

    const [list, total] = await Promise.all([
      this.prisma.attendanceDaily.findMany({
        where,
        include: {
          // 部门名用于日报列表/导出的「部门」列
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              department: { select: { id: true, name: true } },
            },
          },
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
