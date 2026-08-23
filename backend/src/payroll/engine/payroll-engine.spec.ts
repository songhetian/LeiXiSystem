import { calculatePayroll, round2, PayrollItem, AttendanceSnapshot, PayrollConfig } from './payroll-engine';

describe('round2', () => {
  it('整数不变', () => {
    expect(round2(100)).toBe(100);
  });

  it('正常四舍五入', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(1.236)).toBe(1.24);
  });

  it('经典浮点边界：1.005 应四舍五入为 1.01', () => {
    expect(round2(1.005)).toBe(1.01);
  });

  it('经典浮点边界：0.1 + 0.2 = 0.30 应正确舍入', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('经典浮点边界：0.015 应四舍五入为 0.02', () => {
    expect(round2(0.015)).toBe(0.02);
  });

  it('负数也正确舍入', () => {
    expect(round2(-1.235)).toBe(-1.24);
  });

  it('零返回零', () => {
    expect(round2(0)).toBe(0);
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
