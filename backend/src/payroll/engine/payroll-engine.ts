// S10 · 算薪引擎（domain 纯函数，零框架依赖）
// 依据：CONTEXT.md 业务规则、spec 2.3、prototypes/engine-demo.mjs 验证结论
// 规则 A1：小时基数 = 基本工资 ÷ 21.75 ÷ 8
// 规则：加班平日1.5/休息日2/法定3倍
// 规则：缺勤扣款 = 基本工资 ÷ 当月应出勤天数 × 缺勤天数
// 规则：全勤奖 = 无迟到/无早退/无缺勤/无请假（有薪假除外）
// 规则：迟到/早退按次扣款
// 规则：餐补按出勤天数；社保固定代扣

export interface EmployeePayrollInput {
  name: string;
  basicSalary: number;
}

export interface OvertimeHours {
  weekday: number;
  weekend: number;
  holiday: number;
}

export interface AttendanceSnapshot {
  workDays: number;
  scheduledDays: number;
  absentDays: number;
  lateCount: number;
  earlyCount: number;
  noLeave: boolean;
  overtimeHours: OvertimeHours;
}

export interface PayrollConfig {
  fullAttendanceBonus: number;
  mealAllowancePerDay: number;
  socialSecurity: number;
  lateDeductionPerTime?: number;
  earlyDeductionPerTime?: number;
}

export interface PayrollItem {
  code: string;
  name: string;
  amount: number;
}

export interface PayrollResult {
  employee: string;
  items: PayrollItem[];
  total: number;
}

export function round2(n: number): number {
  if (!isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  return sign * Number(Math.round(Number(abs + 'e' + 2)) + 'e-' + 2);
}

export function calculatePayroll(
  emp: EmployeePayrollInput,
  snapshot: AttendanceSnapshot,
  cfg: PayrollConfig,
): PayrollResult {
  const items: PayrollItem[] = [];
  const hourly = emp.basicSalary / 21.75 / 8;

  items.push({ code: 'base', name: '基本工资', amount: round2(emp.basicSalary) });

  const ot = snapshot.overtimeHours;
  const otAmount = ot.weekday * hourly * 1.5 + ot.weekend * hourly * 2 + ot.holiday * hourly * 3;
  if (otAmount > 0) {
    items.push({ code: 'overtime', name: '加班费', amount: round2(otAmount) });
  }

  if (snapshot.absentDays > 0) {
    const deduct = (emp.basicSalary / snapshot.scheduledDays) * snapshot.absentDays;
    items.push({ code: 'absent', name: '缺勤扣款', amount: round2(-deduct) });
  }

  if (cfg.lateDeductionPerTime && snapshot.lateCount > 0) {
    const deduct = cfg.lateDeductionPerTime * snapshot.lateCount;
    items.push({ code: 'lateDeduct', name: '迟到扣款', amount: round2(-deduct) });
  }

  if (cfg.earlyDeductionPerTime && snapshot.earlyCount > 0) {
    const deduct = cfg.earlyDeductionPerTime * snapshot.earlyCount;
    items.push({ code: 'earlyDeduct', name: '早退扣款', amount: round2(-deduct) });
  }

  const fullAttendance =
    snapshot.lateCount === 0 &&
    snapshot.earlyCount === 0 &&
    snapshot.absentDays === 0 &&
    snapshot.noLeave;
  if (fullAttendance && cfg.fullAttendanceBonus > 0) {
    items.push({ code: 'bonus', name: '全勤奖', amount: round2(cfg.fullAttendanceBonus) });
  }

  if (cfg.mealAllowancePerDay > 0 && snapshot.workDays > 0) {
    items.push({
      code: 'meal',
      name: '餐补',
      amount: round2(snapshot.workDays * cfg.mealAllowancePerDay),
    });
  }

  if (cfg.socialSecurity > 0) {
    items.push({ code: 'social', name: '社保代扣', amount: round2(-cfg.socialSecurity) });
  }

  const total = round2(items.reduce((s, i) => s + i.amount, 0));
  return { employee: emp.name, items, total };
}
