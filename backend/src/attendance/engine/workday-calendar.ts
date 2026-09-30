// S07b · 考勤日历（domain 纯函数，零框架依赖）
//
// 依据：CONTEXT.md「加班费：平日 1.5 / 休息日 2 / 法定节假日 3 倍」、
//      spec §2.2「加班分钟 = min(加班申请时长, 实际超出班次下班后的打卡时长)」。
//
// 为什么需要独立的日历数据：仅凭星期几判不出「当天算什么日」——
// 法定节假日逐年由国务院公布，且存在调休上班的周六（原工作日被挪走）、
// 假期内被挪出来休息的周一。没有日历表，「休息日 2 倍 / 法定 3 倍」只能形同虚设。

/** 算薪口径的日类型（决定加班倍率） */
export type DayType = 'weekday' | 'weekend' | 'holiday';

/** 日历中登记的类型：holiday=法定（3 倍）/ rest=休息日（2 倍）/ workday=调休上班（1.5 倍） */
export type HolidayDayType = 'holiday' | 'rest' | 'workday';

/** 业务日以 UTC 午夜存储，日历键一律用 UTC 日期 */
export function holidayKey(workDate: Date): string {
  return workDate.toISOString().slice(0, 10);
}

export interface OvertimeMinutesByDayType {
  weekday: number;
  weekend: number;
  holiday: number;
}

/**
 * 判定某业务日属于哪种日类型 —— **全仓唯一口径**。
 * 日报状态、月报聚合、算薪倍率都必须走这里，避免各写一份导致口径漂移。
 */
export function resolveDayType(
  workDate: Date,
  calendar: ReadonlyMap<string, HolidayDayType>,
): DayType {
  const declared = calendar.get(holidayKey(workDate));
  if (declared === 'holiday') return 'holiday';
  if (declared === 'rest') return 'weekend';
  if (declared === 'workday') return 'weekday';
  const dow = workDate.getUTCDay();
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday';
}

/**
 * 由日类型导出日报所需的「休息日/法定节假日」标记。
 * 日报状态与重算路径都必须走这里，避免两处各写一份 `getDay()` 判断而漂移。
 */
export function dayTypeFlags(
  workDate: Date,
  calendar: ReadonlyMap<string, HolidayDayType>,
): { isWeekend: boolean; isHoliday: boolean } {
  const t = resolveDayType(workDate, calendar);
  return { isWeekend: t === 'weekend', isHoliday: t === 'holiday' };
}

/** 把某日的加班分钟归入唯一桶（三桶之和恒等于入参，不重复计入） */
export function splitOvertimeMinutes(
  totalMinutes: number,
  dayType: DayType,
): OvertimeMinutesByDayType {
  return {
    weekday: dayType === 'weekday' ? totalMinutes : 0,
    weekend: dayType === 'weekend' ? totalMinutes : 0,
    holiday: dayType === 'holiday' ? totalMinutes : 0,
  };
}
