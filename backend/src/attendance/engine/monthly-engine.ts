// S08 · 考勤月报聚合引擎（domain 纯函数，零框架依赖）
// 依据：CONTEXT.md 业务规则、spec 2.2、new-tables.md 第3节
// 规则：出勤天数 = 非absent的日报数；迟到/早退次数统计；缺勤天数统计；加班小时汇总

export interface DailyRecord {
  workDate: string;
  status: 'normal' | 'late' | 'early' | 'late_early' | 'absent' | 'half_absent' | 'abnormal' | 'makeup' | 'holiday' | 'leave' | 'weekend';
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  leaveMinutes: number;
}

export interface MonthlyResult {
  workDays: number;
  lateCount: number;
  earlyCount: number;
  absentDays: number;
  leaveMinutes: number;
  overtimeHours: number;
}

export function buildMonthly(dailies: DailyRecord[]): MonthlyResult {
  let workDays = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let absentDays = 0;
  let leaveMinutes = 0;
  let totalOvertimeMinutes = 0;

  for (const d of dailies) {
    if (d.status !== 'absent') {
      workDays++;
    } else {
      absentDays++;
    }

    if (d.status === 'late' || d.status === 'late_early') {
      lateCount++;
    }
    if (d.status === 'early' || d.status === 'late_early') {
      earlyCount++;
    }

    leaveMinutes += d.leaveMinutes;
    totalOvertimeMinutes += d.overtimeMinutes;
  }

  return {
    workDays,
    lateCount,
    earlyCount,
    absentDays,
    leaveMinutes,
    overtimeHours: totalOvertimeMinutes / 60,
  };
}
