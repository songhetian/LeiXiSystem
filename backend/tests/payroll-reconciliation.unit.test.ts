// S10 · 算薪人工对账 单元测试（TDD RED 先行）
// 依据：step-4 §4.3「对账验收：抽 3 名员工人工对账一致后方可上线」
// 对账语义：按 code 匹配机算明细与人算明细，逐项比金额（整数分）；
//          单侧缺项、员工缺失、合计不一致都算差异；全部为零才算「对账通过」。
import { describe, it, expect } from '@jest/globals';
import {
  reconcilePayroll,
  formatReconciliationReport,
  type ManualExpectation,
} from '../src/payroll/engine/payroll-reconciliation';
import {
  calculatePayroll,
  type EmployeePayrollInput,
  type AttendanceSnapshot,
  type PayrollConfig,
  type PayrollResult,
} from '../src/payroll/engine/payroll-engine';

const machine = (employee: string, items: [string, string, number][], total: number): PayrollResult => ({
  employee,
  items: items.map(([code, name, amount]) => ({ code, name, amount })),
  total,
});

const manual = (employee: string, items: [string, string, number][], total: number): ManualExpectation => ({
  employee,
  items: items.map(([code, name, amount]) => ({ code, name, amount })),
  total,
});

describe('算薪人工对账 — 比对语义', () => {
  it('机算与人算完全一致 → 对账通过、无差异行', () => {
    const m = machine('员工A', [['base', '基本工资', 5000], ['bonus', '全勤奖', 200]], 5200);
    const e = manual('员工A', [['base', '基本工资', 5000], ['bonus', '全勤奖', 200]], 5200);

    const report = reconcilePayroll([m], [e]);

    expect(report.passed).toBe(true);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].diffs).toHaveLength(0);
    expect(report.rows[0].totalDiffCents).toBe(0);
    expect(report.rows[0].passed).toBe(true);
  });

  it('某项金额不一致 → 该项出现在差异行、员工与整体均不通过', () => {
    const m = machine('员工B', [['base', '基本工资', 6000], ['overtime', '加班费', 551.72]], 6551.72);
    // 人算加班费 550（与机算差 1.72）
    const e = manual('员工B', [['base', '基本工资', 6000], ['overtime', '加班费', 550]], 6550);

    const report = reconcilePayroll([m], [e]);

    expect(report.passed).toBe(false);
    expect(report.rows[0].passed).toBe(false);
    expect(report.rows[0].diffs).toHaveLength(1);
    const diff = report.rows[0].diffs[0];
    expect(diff.code).toBe('overtime');
    expect(diff.machineAmount).toBe(551.72);
    expect(diff.manualAmount).toBe(550);
    expect(diff.diffCents).toBe(172);
    expect(report.rows[0].totalDiffCents).toBe(172);
  });

  it('机算有该项、人算漏项 → 差异行 manualAmount 为 null', () => {
    const m = machine('员工C', [['base', '基本工资', 4000], ['meal', '餐补', 110]], 4110);
    const e = manual('员工C', [['base', '基本工资', 4000]], 4000);

    const report = reconcilePayroll([m], [e]);

    expect(report.passed).toBe(false);
    expect(report.rows[0].diffs).toHaveLength(1);
    expect(report.rows[0].diffs[0]).toMatchObject({
      code: 'meal',
      name: '餐补',
      machineAmount: 110,
      manualAmount: null,
      diffCents: 11000,
    });
  });

  it('人算有该项、机算漏项 → 差异行 machineAmount 为 null', () => {
    const m = machine('员工C', [['base', '基本工资', 4000]], 4000);
    const e = manual('员工C', [['base', '基本工资', 4000], ['social', '社保代扣', -500]], 3500);

    const report = reconcilePayroll([m], [e]);

    expect(report.passed).toBe(false);
    expect(report.rows[0].diffs).toHaveLength(1);
    expect(report.rows[0].diffs[0]).toMatchObject({
      code: 'social',
      machineAmount: null,
      manualAmount: -500,
      diffCents: 50000,
    });
  });

  it('机算结果缺员工（或人算期望缺员工）→ 整行不通过', () => {
    const m = machine('员工A', [['base', '基本工资', 5000]], 5000);
    const eA = manual('员工A', [['base', '基本工资', 5000]], 5000);
    const eB = manual('员工B', [['base', '基本工资', 6000]], 6000);

    const report = reconcilePayroll([m], [eA, eB]);

    expect(report.passed).toBe(false);
    const rowB = report.rows.find((r) => r.employee === '员工B');
    expect(rowB).toBeDefined();
    expect(rowB!.passed).toBe(false);
    expect(rowB!.diffs).toHaveLength(1);
    expect(rowB!.diffs[0]).toMatchObject({ code: 'base', machineAmount: null, manualAmount: 6000 });
  });

  it('明细逐项一致、但人算合计加错 → 仍判不通过（合计差异单列）', () => {
    // 明细完全一致，人算合计 5200 写成了 5300（手算笔误）
    const m = machine('员工A', [['base', '基本工资', 5000], ['bonus', '全勤奖', 200]], 5200);
    const e = manual('员工A', [['base', '基本工资', 5000], ['bonus', '全勤奖', 200]], 5300);

    const report = reconcilePayroll([m], [e]);

    expect(report.passed).toBe(false);
    expect(report.rows[0].diffs).toHaveLength(0); // 明细无差异
    expect(report.rows[0].totalDiffCents).toBe(-10000); // 机算 5200 - 人算 5300
    expect(report.rows[0].passed).toBe(false);
  });
});

describe('算薪人工对账 — 对账单格式化（签字载体）', () => {
  it('对账通过的对账单：含员工/逐项机算人算/结论与签字栏', () => {
    const m = machine('员工A', [['base', '基本工资', 5000], ['bonus', '全勤奖', 200]], 5200);
    const e: ManualExpectation = {
      ...manual('员工A', [['base', '基本工资', 5000], ['bonus', '全勤奖', 200]], 5200),
      note: '全勤奖 200；基本工资 5000',
    };

    const text = formatReconciliationReport(reconcilePayroll([m], [e]));

    expect(text).toContain('员工A');
    expect(text).toContain('基本工资');
    expect(text).toContain('5000.00');
    expect(text).toContain('200.00');
    expect(text).toContain('对账通过');
    expect(text).toContain('复核签字'); // 签字栏
    expect(text).toContain('全勤奖 200；基本工资 5000'); // 人算口径备注留痕
  });

  it('对账不通过的对账单：差异项带机算/人算/差异金额，结论为不通过', () => {
    const m = machine('员工B', [['base', '基本工资', 6000], ['overtime', '加班费', 551.72]], 6551.72);
    const e = manual('员工B', [['base', '基本工资', 6000], ['overtime', '加班费', 550]], 6550);

    const text = formatReconciliationReport(reconcilePayroll([m], [e]));

    expect(text).toContain('对账不通过');
    expect(text).toContain('加班费');
    expect(text).toContain('551.72'); // 机算
    expect(text).toContain('550.00'); // 人算
    expect(text).toContain('+1.72'); // 差异（机算 - 人算）
  });
});

describe('3 人对账样例回归基线（step-4 §4.3 上线验收门槛）', () => {
  // 与引擎单测同一套配置，另开迟到/早退按次扣款，保证 8 个工资项 code 全覆盖：
  // base / overtime / absent / lateDeduct / earlyDeduct / bonus / meal / social
  const cfg: PayrollConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
    lateDeductionPerTime: 50,
    earlyDeductionPerTime: 50,
  };

  // ===== 机算：走真实算薪引擎 =====
  const empA: EmployeePayrollInput = { name: '员工A', basicSalary: 5000 };
  const snapA: AttendanceSnapshot = {
    workDays: 22, scheduledDays: 22, absentDays: 0, lateCount: 0, earlyCount: 0,
    noLeave: true, overtimeHours: { weekday: 10, weekend: 0, holiday: 0 },
  };

  const empB: EmployeePayrollInput = { name: '员工B', basicSalary: 6000 };
  const snapB: AttendanceSnapshot = {
    workDays: 20, scheduledDays: 22, absentDays: 2, lateCount: 3, earlyCount: 0,
    noLeave: true, overtimeHours: { weekday: 0, weekend: 8, holiday: 0 },
  };

  const empC: EmployeePayrollInput = { name: '员工C', basicSalary: 4000 };
  const snapC: AttendanceSnapshot = {
    workDays: 11, scheduledDays: 14, absentDays: 3, lateCount: 0, earlyCount: 1,
    noLeave: false, overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
  };

  const machineResults: PayrollResult[] = [
    calculatePayroll(empA, snapA, cfg),
    calculatePayroll(empB, snapB, cfg),
    calculatePayroll(empC, snapC, cfg),
  ];

  // ===== 人算：独立手算期望值（公式留痕，禁止从引擎结果反抄）=====
  // 小时基数 = 基本工资 ÷ 21.75 ÷ 8；缺勤扣款 = 基本工资 ÷ 应出勤天数 × 缺勤天数
  const expectations: ManualExpectation[] = [
    {
      employee: '员工A',
      items: [
        { code: 'base', name: '基本工资', amount: 5000 },
        { code: 'overtime', name: '加班费', amount: 431.03 },   // 5000/21.75/8×10×1.5
        { code: 'bonus', name: '全勤奖', amount: 200 },          // 无迟到/早退/缺勤/请假
        { code: 'meal', name: '餐补', amount: 220 },             // 22 天 × 10 元
        { code: 'social', name: '社保代扣', amount: -500 },
      ],
      total: 5351.03, // 5000 + 431.03 + 200 + 220 - 500
      note: '小时基数 5000/21.75/8≈28.7356；平日加班 10h×1.5 倍；餐补按出勤 22 天',
    },
    {
      employee: '员工B',
      items: [
        { code: 'base', name: '基本工资', amount: 6000 },
        { code: 'overtime', name: '加班费', amount: 551.72 },    // 6000/21.75/8×8×2
        { code: 'absent', name: '缺勤扣款', amount: -545.45 },   // 6000/22×2
        { code: 'lateDeduct', name: '迟到扣款', amount: -150 },  // 3 次 × 50 元
        { code: 'meal', name: '餐补', amount: 200 },             // 20 天 × 10 元
        { code: 'social', name: '社保代扣', amount: -500 },
      ],
      total: 5556.27, // 6000 + 551.72 - 545.45 - 150 + 200 - 500
      note: '休息日加班 8h×2 倍；缺勤按应出勤 22 天折算；迟到 3 次取消全勤',
    },
    {
      employee: '员工C',
      items: [
        { code: 'base', name: '基本工资', amount: 4000 },
        { code: 'absent', name: '缺勤扣款', amount: -857.14 },   // 4000/14×3（请假计入缺勤口径）
        { code: 'earlyDeduct', name: '早退扣款', amount: -50 },  // 1 次 × 50 元
        { code: 'meal', name: '餐补', amount: 110 },             // 11 天 × 10 元
        { code: 'social', name: '社保代扣', amount: -500 },
      ],
      total: 2702.86, // 4000 - 857.14 - 50 + 110 - 500
      note: '月中入职应出勤 14 天；请假 3 天无全勤；早退 1 次',
    },
  ];

  it('机算 vs 人算逐项一致 → 对账通过', () => {
    const report = reconcilePayroll(machineResults, expectations);

    expect(report.passed).toBe(true);
    for (const row of report.rows) {
      expect(row.diffs).toHaveLength(0);
      expect(row.totalDiffCents).toBe(0);
    }
  });

  it('8 个工资项 code 全部被 3 人样例覆盖（防新项漏对账）', () => {
    const codes = new Set(machineResults.flatMap((r) => r.items.map((i) => i.code)));
    expect([...codes].sort()).toEqual(
      ['absent', 'base', 'bonus', 'earlyDeduct', 'lateDeduct', 'meal', 'overtime', 'social'],
    );
  });

  it('对账单可读且结论为通过（签字载体）', () => {
    const text = formatReconciliationReport(reconcilePayroll(machineResults, expectations));

    expect(text).toContain('对账通过（3 名员工逐项一致）');
    expect(text).toContain('复核签字');
  });
});
