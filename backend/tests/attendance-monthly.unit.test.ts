// S08 · 考勤月报聚合引擎 单元测试（TDD RED 先行）
// 引擎是纯函数、零框架依赖，可独立跑单测
import { describe, it, expect } from '@jest/globals';
import { buildMonthly, type DailyRecord } from '../src/attendance/engine/monthly-engine';

describe('S08 · 考勤月报聚合引擎（纯函数）', () => {
  const baseDaily = (overrides: Partial<DailyRecord> = {}): DailyRecord => ({
    workDate: '2026-08-01',
    status: 'normal',
    lateMinutes: 0,
    earlyMinutes: 0,
    overtimeMinutes: 0,
    leaveMinutes: 0,
    ...overrides,
  });

  it('全月正常出勤 → workDays=22, lateCount=0, absentDays=0', () => {
    const dailies: DailyRecord[] = [];
    for (let i = 1; i <= 22; i++) {
      dailies.push(baseDaily({ workDate: `2026-08-${String(i).padStart(2, '0')}` }));
    }
    const r = buildMonthly(dailies);
    expect(r.workDays).toBe(22);
    expect(r.lateCount).toBe(0);
    expect(r.earlyCount).toBe(0);
    expect(r.absentDays).toBe(0);
    expect(r.overtimeHours).toBe(0);
    expect(r.leaveMinutes).toBe(0);
  });

  it('迟到3次 → lateCount=3', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', status: 'late', lateMinutes: 10 }),
      baseDaily({ workDate: '2026-08-02', status: 'normal' }),
      baseDaily({ workDate: '2026-08-03', status: 'late', lateMinutes: 5 }),
      baseDaily({ workDate: '2026-08-04', status: 'normal' }),
      baseDaily({ workDate: '2026-08-05', status: 'late', lateMinutes: 30 }),
    ];
    const r = buildMonthly(dailies);
    expect(r.lateCount).toBe(3);
    expect(r.workDays).toBe(5);
  });

  it('早退2次 → earlyCount=2', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', status: 'early', earlyMinutes: 15 }),
      baseDaily({ workDate: '2026-08-02', status: 'normal' }),
      baseDaily({ workDate: '2026-08-03', status: 'early', earlyMinutes: 10 }),
    ];
    const r = buildMonthly(dailies);
    expect(r.earlyCount).toBe(2);
  });

  it('迟到+早退 → 同时计入lateCount和earlyCount', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', status: 'late_early', lateMinutes: 5, earlyMinutes: 10 }),
    ];
    const r = buildMonthly(dailies);
    expect(r.lateCount).toBe(1);
    expect(r.earlyCount).toBe(1);
    expect(r.workDays).toBe(1);
  });

  it('缺勤2天 → absentDays=2', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', status: 'normal' }),
      baseDaily({ workDate: '2026-08-02', status: 'absent' }),
      baseDaily({ workDate: '2026-08-03', status: 'normal' }),
      baseDaily({ workDate: '2026-08-04', status: 'absent' }),
    ];
    const r = buildMonthly(dailies);
    expect(r.absentDays).toBe(2);
    expect(r.workDays).toBe(2);
  });

  it('加班合计150分钟 → overtimeHours=2.5', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', overtimeMinutes: 60 }),
      baseDaily({ workDate: '2026-08-02', overtimeMinutes: 90 }),
    ];
    const r = buildMonthly(dailies);
    expect(r.overtimeHours).toBe(2.5);
  });

  it('请假合计240分钟 → leaveMinutes=240', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', status: 'leave', leaveMinutes: 120 }),
      baseDaily({ workDate: '2026-08-02', status: 'leave', leaveMinutes: 120 }),
    ];
    const r = buildMonthly(dailies);
    expect(r.leaveMinutes).toBe(240);
  });

  it('月中入职（15号入职）→ 只统计入职后的日报', () => {
    const dailies: DailyRecord[] = [];
    for (let i = 1; i <= 14; i++) {
      dailies.push(baseDaily({ workDate: `2026-08-${String(i).padStart(2, '0')}`, status: 'absent' }));
    }
    for (let i = 15; i <= 31; i++) {
      dailies.push(baseDaily({ workDate: `2026-08-${String(i).padStart(2, '0')}` }));
    }
    const r = buildMonthly(dailies);
    expect(r.workDays).toBe(17);
    expect(r.absentDays).toBe(14);
  });

  it('异常状态(abnormal) → 计入出勤天数', () => {
    const dailies = [
      baseDaily({ workDate: '2026-08-01', status: 'abnormal' }),
      baseDaily({ workDate: '2026-08-02', status: 'normal' }),
    ];
    const r = buildMonthly(dailies);
    expect(r.workDays).toBe(2);
  });

  it('空日报列表 → 全零', () => {
    const r = buildMonthly([]);
    expect(r.workDays).toBe(0);
    expect(r.lateCount).toBe(0);
    expect(r.earlyCount).toBe(0);
    expect(r.absentDays).toBe(0);
    expect(r.overtimeHours).toBe(0);
    expect(r.leaveMinutes).toBe(0);
  });
});
