import type { AttendanceStatsRow, AttendanceStatsOptions, AttendanceView } from '@leixi/shared';

/** 把 "HH:mm" 转成当天分钟数，便于比较与求工时差 */
function toMinutes(hm: string): number {
  const [h = '0', m = '0'] = hm.split(':');
  return Number(h) * 60 + Number(m);
}

const DEFAULT_LATE = '09:00';
const DEFAULT_EARLY = '18:00';

/**
 * 纯函数考勤统计聚合：把某个作用域内的打卡记录按「员工 × 月份」聚合出行级指标。
 * 不影响副作用，可独立单测。判定逻辑：
 *  - presentDays：当天有签到或签退即算已打卡
 *  - 迟到：当天有 checkIn 且晚于 lateThreshold
 *  - 早退：当天有 checkOut 且早于 earlyThreshold
 *  - normalDays：当天同时有签到签退、且不迟到不早退
 *  - 工时：有签到签退时用 (checkOut-checkIn) 分钟换算小时，保留 1 位小数
 */
export function buildAttendanceStats(
  rows: AttendanceView[],
  opts: AttendanceStatsOptions,
): AttendanceStatsRow[] {
  const lateMin = toMinutes(opts.lateThreshold ?? DEFAULT_LATE);
  const earlyMin = toMinutes(opts.earlyThreshold ?? DEFAULT_EARLY);
  const month = opts.month;

  // 按 userId 分组累加
  const agg = new Map<
    number,
    {
      userName: string;
      departmentName: string;
      presentDays: number;
      normalDays: number;
      lateCount: number;
      earlyLeaveCount: number;
      totalMinutes: number;
    }
  >();

  for (const r of rows) {
    if (!r.date.startsWith(month)) continue;

    const a = agg.get(r.userId) ?? {
      userName: r.applicantName,
      departmentName: r.departmentName,
      presentDays: 0,
      normalDays: 0,
      lateCount: 0,
      earlyLeaveCount: 0,
      totalMinutes: 0,
    };

    const hasIn = r.checkIn != null && r.checkIn.length > 0;
    const hasOut = r.checkOut != null && r.checkOut.length > 0;
    if (hasIn || hasOut) a.presentDays += 1;

    const checkInMin = hasIn ? toMinutes(r.checkIn!) : null;
    const checkOutMin = hasOut ? toMinutes(r.checkOut!) : null;
    const late = checkInMin != null && checkInMin > lateMin;
    const early = checkOutMin != null && checkOutMin < earlyMin;
    if (late) a.lateCount += 1;
    if (early) a.earlyLeaveCount += 1;
    if (hasIn && hasOut && !late && !early) a.normalDays += 1;

    if (hasIn && hasOut && checkInMin != null && checkOutMin != null) {
      a.totalMinutes += Math.max(0, checkOutMin - checkInMin);
    }
    agg.set(r.userId, a);
  }

  return [...agg.entries()].map(([userId, a]) => {
    const totalWorkHours = Math.round((a.totalMinutes / 60) * 10) / 10;
    const avgWorkHours =
      a.presentDays > 0 ? Math.round((a.totalMinutes / a.presentDays / 60) * 10) / 10 : 0;
    return {
      userId,
      userName: a.userName,
      departmentName: a.departmentName,
      presentDays: a.presentDays,
      normalDays: a.normalDays,
      lateCount: a.lateCount,
      earlyLeaveCount: a.earlyLeaveCount,
      avgWorkHours,
      totalWorkHours,
      month,
    };
  });
}