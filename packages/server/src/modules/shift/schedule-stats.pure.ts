import type { ScheduleStatsRow, ScheduleStatsOptions, ScheduleView } from '@leixi/shared';

/**
 * 排班统计报表纯函数聚合：把某作用域内一段日期的排班按「员工 × 月份」聚合成行级指标。
 * 不触碰副作用，可独立单测。口径：
 *  - shiftDays：出勤班次天数（非休息日）
 *  - restDays：休息天数（isRestDay）
 *  - totalWorkHours：把非休息日的当日班次工时累加，精确到 1 位小数
 *  - avgWorkHours：累计工时 / 出勤天数，0 出勤时为 0
 */
export function buildScheduleStats(
  rows: ScheduleView[],
  opts: ScheduleStatsOptions,
): ScheduleStatsRow[] {
  const month = opts.month;
  const agg = new Map<
    number,
    {
      userName: string;
      departmentName: string;
      shiftDays: number;
      restDays: number;
      totalHours: number;
    }
  >();

  for (const r of rows) {
    // 仅聚合目标月份
    if (!r.scheduleDate.startsWith(month)) continue;

    const a = agg.get(r.userId) ?? {
      userName: r.userName,
      departmentName: r.departmentName,
      shiftDays: 0,
      restDays: 0,
      totalHours: 0,
    };

    if (r.isRestDay) {
      a.restDays += 1;
    } else {
      a.shiftDays += 1;
      a.totalHours += r.workHours ?? 0;
    }
    agg.set(r.userId, a);
  }

  return [...agg.entries()].map(([userId, a]) => ({
    userId,
    userName: a.userName,
    departmentName: a.departmentName,
    shiftDays: a.shiftDays,
    restDays: a.restDays,
    totalWorkHours: Math.round(a.totalHours * 10) / 10,
    avgWorkHours:
      a.shiftDays > 0 ? Math.round((a.totalHours / a.shiftDays) * 10) / 10 : 0,
    month,
  }));
}