import {
  calculatePayroll,
  assertPayrollBalanced,
  PayrollItem,
  AttendanceSnapshot,
  PayrollConfig,
} from './payroll-engine';
// 金额定点工具已下沉到 common，本文件只验证算薪规则本身
import { round2, toCents, sumCents } from '../../common/money.util';

describe('assertPayrollBalanced — 明细定点累加对账', () => {
  it('明细定点累加等于批次总额时通过（含浮点漂移场景）', () => {
    expect(() => assertPayrollBalanced([0.1, 0.2], 0.3)).not.toThrow();
    expect(() => assertPayrollBalanced([], 0)).not.toThrow();
    expect(() => assertPayrollBalanced([5000, -100.005], 4899.99)).not.toThrow();
  });

  it('明细定点累加与批次总额不等时抛错（漏项或漂移未收敛）', () => {
    expect(() => assertPayrollBalanced([1.005], 1)).toThrow(/算薪对账失败/);
    expect(() => assertPayrollBalanced([100, 200], 400)).toThrow(/算薪对账失败/);
  });
});

describe('calculatePayroll — 精度验证', () => {
  const defaultConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
  };

  it('全勤时薪资计算正确', () => {
    const result = calculatePayroll(
      { name: '张三', basicSalary: 5000 },
      {
        workDays: 22,
        scheduledDays: 22,
        absentDays: 0,
        lateCount: 0,
        earlyCount: 0,
        noLeave: true,
        overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
      },
      defaultConfig,
    );
    expect(result.total).toBe(4920);
  });

  it('total 恒等于明细的定点累加（不因浮点漂移而偏离）', () => {
    const result = calculatePayroll(
      { name: '张三', basicSalary: 8333.33 },
      {
        workDays: 21,
        scheduledDays: 23,
        absentDays: 2,
        lateCount: 3,
        earlyCount: 2,
        noLeave: false,
        overtimeHours: { weekday: 7, weekend: 2, holiday: 1 },
      },
      { ...defaultConfig, lateDeductionPerTime: 33.33, earlyDeductionPerTime: 16.67 },
    );
    const itemsCents = sumCents(result.items.map((i) => i.amount));
    expect(toCents(result.total)).toBe(itemsCents);
    expect(round2(result.total)).toBe(result.total);
    expect(() => assertPayrollBalanced(result.items.map((i) => i.amount), result.total)).not.toThrow();
  });

  it('缺勤时基本工资不变，缺勤扣款单独列出', () => {
    const result = calculatePayroll(
      { name: '李四', basicSalary: 3000 },
      {
        workDays: 15,
        scheduledDays: 22,
        absentDays: 7,
        lateCount: 0,
        earlyCount: 0,
        noLeave: false,
        overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
      },
      defaultConfig,
    );
    const baseItem = result.items.find((i: PayrollItem) => i.code === 'base');
    expect(baseItem!.amount).toBe(3000);
    const absentItem = result.items.find((i: PayrollItem) => i.code === 'absent');
    expect(absentItem).toBeDefined();
    expect(absentItem!.amount).toBeLessThan(0);
  });
});

describe('calculatePayroll — 早退扣款逻辑', () => {
  const configWithDeduction: PayrollConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
    lateDeductionPerTime: 50,
    earlyDeductionPerTime: 50,
  };

  const baseSnapshot: AttendanceSnapshot = {
    workDays: 22,
    scheduledDays: 22,
    absentDays: 0,
    lateCount: 0,
    earlyCount: 0,
    noLeave: true,
    overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
  };

  it('有早退则无全勤奖', () => {
    const result = calculatePayroll(
      { name: '王五', basicSalary: 5000 },
      { ...baseSnapshot, earlyCount: 1 },
      configWithDeduction,
    );
    const bonusItem = result.items.find((i: PayrollItem) => i.code === 'bonus');
    expect(bonusItem).toBeUndefined();
  });

  it('早退扣款计算正确', () => {
    const result = calculatePayroll(
      { name: '赵六', basicSalary: 5000 },
      { ...baseSnapshot, earlyCount: 2 },
      configWithDeduction,
    );
    const earlyDeductItem = result.items.find((i: PayrollItem) => i.code === 'earlyDeduct');
    expect(earlyDeductItem).toBeDefined();
    expect(earlyDeductItem!.amount).toBe(-100);
  });

  it('同时有迟到和早退时叠加扣款', () => {
    const result = calculatePayroll(
      { name: '孙七', basicSalary: 5000 },
      { ...baseSnapshot, lateCount: 2, earlyCount: 3 },
      configWithDeduction,
    );
    const lateDeductItem = result.items.find((i: PayrollItem) => i.code === 'lateDeduct');
    const earlyDeductItem = result.items.find((i: PayrollItem) => i.code === 'earlyDeduct');
    const bonusItem = result.items.find((i: PayrollItem) => i.code === 'bonus');
    expect(lateDeductItem!.amount).toBe(-100);
    expect(earlyDeductItem!.amount).toBe(-150);
    expect(bonusItem).toBeUndefined();
  });

  it('未配置扣款时不产生扣款项目', () => {
    const configWithoutDeduction: PayrollConfig = {
      fullAttendanceBonus: 200,
      mealAllowancePerDay: 10,
      socialSecurity: 500,
    };
    const result = calculatePayroll(
      { name: '周八', basicSalary: 5000 },
      { ...baseSnapshot, earlyCount: 2, lateCount: 1 },
      configWithoutDeduction,
    );
    const lateDeductItem = result.items.find((i: PayrollItem) => i.code === 'lateDeduct');
    const earlyDeductItem = result.items.find((i: PayrollItem) => i.code === 'earlyDeduct');
    expect(lateDeductItem).toBeUndefined();
    expect(earlyDeductItem).toBeUndefined();
    const bonusItem = result.items.find((i: PayrollItem) => i.code === 'bonus');
    expect(bonusItem).toBeUndefined();
  });

  it('早退次数为0时不产生早退扣款', () => {
    const result = calculatePayroll(
      { name: '吴九', basicSalary: 5000 },
      { ...baseSnapshot, earlyCount: 0 },
      configWithDeduction,
    );
    const earlyDeductItem = result.items.find((i: PayrollItem) => i.code === 'earlyDeduct');
    expect(earlyDeductItem).toBeUndefined();
  });
});
