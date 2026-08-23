// S10 · 算薪引擎 单元测试（TDD RED 先行，移植 prototypes/engine-demo.mjs 3人对账样例）
// 引擎是纯函数、零框架依赖，可独立跑单测
import { describe, it, expect } from '@jest/globals';
import { calculatePayroll, type EmployeePayrollInput, type AttendanceSnapshot, type PayrollConfig } from '../src/payroll/engine/payroll-engine';

describe('S10 · 算薪引擎（纯函数）— 3人对账样例回归基线', () => {
  const cfg: PayrollConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
  };

  describe('员工A：满勤 + 平日加班10h', () => {
    const emp: EmployeePayrollInput = { name: '员工A', basicSalary: 5000 };
    const snapshot: AttendanceSnapshot = {
      workDays: 22,
      scheduledDays: 22,
      absentDays: 0,
      lateCount: 0,
      earlyCount: 0,
      noLeave: true,
      overtimeHours: { weekday: 10, weekend: 0, holiday: 0 },
    };

    it('基本工资 = 5000', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const base = r.items.find((i) => i.code === 'base');
      expect(base?.amount).toBe(5000);
    });

    it('加班费 = 431.03（5000/21.75/8*10*1.5）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const ot = r.items.find((i) => i.code === 'overtime');
      expect(ot?.amount).toBe(431.03);
    });

    it('全勤奖 = 200', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const bonus = r.items.find((i) => i.code === 'bonus');
      expect(bonus?.amount).toBe(200);
    });

    it('合计 = 5351.03（5000+431.03+200+220-500）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      expect(r.total).toBe(5351.03);
    });
  });

  describe('员工B：缺勤2天 + 迟到3次 + 休息日加班8h（无全勤）', () => {
    const emp: EmployeePayrollInput = { name: '员工B', basicSalary: 6000 };
    const snapshot: AttendanceSnapshot = {
      workDays: 20,
      scheduledDays: 22,
      absentDays: 2,
      lateCount: 3,
      earlyCount: 0,
      noLeave: true,
      overtimeHours: { weekday: 0, weekend: 8, holiday: 0 },
    };

    it('加班费 = 551.72（6000/21.75/8*8*2）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const ot = r.items.find((i) => i.code === 'overtime');
      expect(ot?.amount).toBe(551.72);
    });

    it('缺勤扣款 = -545.45（6000/22*2）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const absent = r.items.find((i) => i.code === 'absent');
      expect(absent?.amount).toBe(-545.45);
    });

    it('无全勤奖（迟到次数>0）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const bonus = r.items.find((i) => i.code === 'bonus');
      expect(bonus).toBeUndefined();
    });

    it('合计 = 5706.27（6000+551.72-545.45+200-500）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      expect(r.total).toBe(5706.27);
    });
  });

  describe('员工C：月中入职（出勤11天）+ 请假3天（noLeave=false）', () => {
    const emp: EmployeePayrollInput = { name: '员工C', basicSalary: 4000 };
    const snapshot: AttendanceSnapshot = {
      workDays: 11,
      scheduledDays: 14,
      absentDays: 3,
      lateCount: 0,
      earlyCount: 0,
      noLeave: false,
      overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
    };

    it('缺勤扣款 = -857.14（4000/14*3）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const absent = r.items.find((i) => i.code === 'absent');
      expect(absent?.amount).toBe(-857.14);
    });

    it('无全勤奖（有请假）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const bonus = r.items.find((i) => i.code === 'bonus');
      expect(bonus).toBeUndefined();
    });

    it('餐补 = 110（11天×10元）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const meal = r.items.find((i) => i.code === 'meal');
      expect(meal?.amount).toBe(110);
    });

    it('合计 = 2752.86（4000-857.14+110-500）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      expect(r.total).toBe(2752.86);
    });
  });
});

describe('S10 · 算薪引擎 — 迟到/早退按次扣款', () => {
  const cfg: PayrollConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
    lateDeductionPerTime: 50,
    earlyDeductionPerTime: 50,
  };

  describe('迟到2次扣款', () => {
    const emp: EmployeePayrollInput = { name: '员工D', basicSalary: 4800 };
    const snapshot: AttendanceSnapshot = {
      workDays: 22,
      scheduledDays: 22,
      absentDays: 0,
      lateCount: 2,
      earlyCount: 0,
      noLeave: true,
      overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
    };

    it('迟到扣款 = 2次 × 50元/次 = -100', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const lateDeduct = r.items.find((i) => i.code === 'lateDeduct');
      expect(lateDeduct?.amount).toBe(-100);
    });

    it('无全勤奖（有迟到）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const bonus = r.items.find((i) => i.code === 'bonus');
      expect(bonus).toBeUndefined();
    });
  });

  describe('迟到3次扣款', () => {
    const emp: EmployeePayrollInput = { name: '员工E', basicSalary: 4800 };
    const snapshot: AttendanceSnapshot = {
      workDays: 21,
      scheduledDays: 22,
      absentDays: 0,
      lateCount: 3,
      earlyCount: 0,
      noLeave: true,
      overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
    };

    it('迟到扣款 = 3次 × 50元/次 = -150', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const lateDeduct = r.items.find((i) => i.code === 'lateDeduct');
      expect(lateDeduct?.amount).toBe(-150);
    });
  });

  describe('早退按次扣款', () => {
    const emp: EmployeePayrollInput = { name: '员工F', basicSalary: 4800 };
    const snapshot: AttendanceSnapshot = {
      workDays: 22,
      scheduledDays: 22,
      absentDays: 0,
      lateCount: 0,
      earlyCount: 3,
      noLeave: true,
      overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
    };

    it('早退扣款 = 3次 × 50元/次 = -150', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const earlyDeduct = r.items.find((i) => i.code === 'earlyDeduct');
      expect(earlyDeduct?.amount).toBe(-150);
    });

    it('无全勤奖（有早退）', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const bonus = r.items.find((i) => i.code === 'bonus');
      expect(bonus).toBeUndefined();
    });
  });

  describe('同时有迟到和早退', () => {
    const emp: EmployeePayrollInput = { name: '员工G', basicSalary: 4800 };
    const snapshot: AttendanceSnapshot = {
      workDays: 21,
      scheduledDays: 22,
      absentDays: 0,
      lateCount: 1,
      earlyCount: 1,
      noLeave: true,
      overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
    };

    it('迟到扣款 + 早退扣款', () => {
      const r = calculatePayroll(emp, snapshot, cfg);
      const lateDeduct = r.items.find((i) => i.code === 'lateDeduct');
      const earlyDeduct = r.items.find((i) => i.code === 'earlyDeduct');
      expect(lateDeduct?.amount).toBe(-50);
      expect(earlyDeduct?.amount).toBe(-50);
    });
  });

  describe('未配置迟到早退扣款时不扣款', () => {
    const cfgDisabled: PayrollConfig = {
      fullAttendanceBonus: 200,
      mealAllowancePerDay: 10,
      socialSecurity: 500,
    };
    const emp: EmployeePayrollInput = { name: '员工H', basicSalary: 4800 };
    const snapshot: AttendanceSnapshot = {
      workDays: 22,
      scheduledDays: 22,
      absentDays: 0,
      lateCount: 2,
      earlyCount: 0,
      noLeave: true,
      overtimeHours: { weekday: 0, weekend: 0, holiday: 0 },
    };

    it('无迟到扣款项目', () => {
      const r = calculatePayroll(emp, snapshot, cfgDisabled);
      const lateDeduct = r.items.find((i) => i.code === 'lateDeduct');
      expect(lateDeduct).toBeUndefined();
    });

    it('无全勤奖（有迟到次数）', () => {
      const r = calculatePayroll(emp, snapshot, cfgDisabled);
      const bonus = r.items.find((i) => i.code === 'bonus');
      expect(bonus).toBeUndefined();
    });
  });
});
