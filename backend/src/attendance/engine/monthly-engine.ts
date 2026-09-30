// S08 · 考勤月报聚合引擎（domain 纯函数，零框架依赖）
// 依据：CONTEXT.md 业务规则、spec 2.2、new-tables.md 第3节
//
// 规则：
//  - 出勤天数 = **真正出勤**的日报数（请假 / 周末 / 法定节假日不计），餐补以此为准
//  - 迟到/早退次数统计；缺勤天数统计；请假时长统计（并单独汇总无薪假部分）
//  - 加班按日类型分桶：平日 / 休息日 / 法定节假日（算薪分别取 1.5 / 2 / 3 倍）

export interface DailyRecord {
  workDate: string;
  status: 'normal' | 'late' | 'early' | 'late_early' | 'absent' | 'half_absent' | 'abnormal' | 'makeup' | 'holiday' | 'leave' | 'weekend';
  lateMinutes: number;
  earlyMinutes: number;
  overtimeWeekdayMinutes: number;
  overtimeWeekendMinutes: number;
  overtimeHolidayMinutes: number;
  leaveMinutes: number;
  unpaidLeaveMinutes: number;
}

export interface MonthlyResult {
  workDays: number;
  lateCount: number;
  earlyCount: number;
  totalLateMinutes: number;
  totalEarlyMinutes: number;
  absentDays: number;
  leaveMinutes: number;
  unpaidLeaveMinutes: number;
  overtimeHours: number;
  overtimeWeekdayHours: number;
  overtimeWeekendHours: number;
  overtimeHolidayHours: number;
}

/**
 * 计入「出勤天数」的状态。
 * 请假（leave）与周末/法定（weekend/holiday）都不是出勤：
 * 前者不发餐补、后者若有实际工作则走加班费，避免既发餐补又计加班。
 */
const ATTENDED_STATUSES = new Set<DailyRecord['status']>([
  'normal',
  'late',
  'early',
  'late_early',
  'abnormal',
  'half_absent',
  'makeup',
]);

export function buildMonthly(dailies: DailyRecord[]): MonthlyResult {
  let workDays = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let totalLateMinutes = 0;
  let totalEarlyMinutes = 0;
  let absentDays = 0;
  let leaveMinutes = 0;
  let unpaidLeaveMinutes = 0;
  let weekdayMinutes = 0;
  let weekendMinutes = 0;
  let holidayMinutes = 0;

  for (const d of dailies) {
    if (ATTENDED_STATUSES.has(d.status)) {
      workDays++;
    }
    if (d.status === 'absent') {
      absentDays++;
    }

    if (d.status === 'late' || d.status === 'late_early') {
      lateCount++;
    }
    if (d.status === 'early' || d.status === 'late_early') {
      earlyCount++;
    }

    totalLateMinutes += d.lateMinutes;
    totalEarlyMinutes += d.earlyMinutes;
    leaveMinutes += d.leaveMinutes;
    unpaidLeaveMinutes += d.unpaidLeaveMinutes;
    weekdayMinutes += d.overtimeWeekdayMinutes;
    weekendMinutes += d.overtimeWeekendMinutes;
    holidayMinutes += d.overtimeHolidayMinutes;
  }

  return {
    workDays,
    lateCount,
    earlyCount,
    totalLateMinutes,
    totalEarlyMinutes,
    absentDays,
    leaveMinutes,
    unpaidLeaveMinutes,
    // 总加班小时由三桶定点相加得出，保证「总 = 分项之和」
    overtimeHours: (weekdayMinutes + weekendMinutes + holidayMinutes) / 60,
    overtimeWeekdayHours: weekdayMinutes / 60,
    overtimeWeekendHours: weekendMinutes / 60,
    overtimeHolidayHours: holidayMinutes / 60,
  };
}
