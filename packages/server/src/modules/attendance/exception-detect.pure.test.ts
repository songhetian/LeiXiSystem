import { describe, it, expect } from 'vitest';
import { detectDayExceptions, type DayDetectionInput } from './exception-detect.pure';

/** 构造某日判定入参（省略号后覆盖默认） */
function day(over: Partial<DayDetectionInput> = {}): DayDetectionInput {
  return {
    date: '2026-09-22',
    userId: 3,
    departmentId: 3,
    userName: '张三',
    departmentName: '前端组',
    startTime: '09:00', // 排班预期上班
    endTime: '18:00', // 排班预期下班
    isRestDay: false,
    checkIn: '09:00',
    checkOut: '18:00',
    lateMinutes: 0, // 迟到判定阈值（分钟）
    earlyLeaveMinutes: 0, // 早退判定阈值（分钟）
    ...over,
  };
}

const L = (o: Partial<DayDetectionInput> = {}) => day(o);

describe('考勤异常判定纯函数 detectDayExceptions', () => {
  it('正常打卡（准点/不迟到不早退）→ 无异常', () => {
    expect(detectDayExceptions(L())).toEqual([]);
  });

  it('无排班（startTime/endTime 为 null）→ 不判定，返回空', () => {
    expect(detectDayExceptions(L({ startTime: null, endTime: null }))).toEqual([]);
  });

  it('休息日 → 不判定，返回空', () => {
    expect(detectDayExceptions(L({ isRestDay: true }))).toEqual([]);
  });

  it('有排班但完全无打卡 → 缺勤 absent', () => {
    expect(detectDayExceptions(L({ checkIn: null, checkOut: null }))).toEqual([
      { type: 'absent', date: '2026-09-22', userId: 3, departmentId: 3, userName: '张三', departmentName: '前端组', minutes: null },
    ]);
  });

  it('打卡晚于 上班+阈值 → 迟到 late（分钟差）', () => {
    expect(detectDayExceptions(L({ checkIn: '09:30', checkOut: '18:00' }))).toEqual([
      expect.objectContaining({ type: 'late', minutes: 30 }),
    ]);
  });

  it('迟到阈值放宽后不再判迟到：08:5X? no——09:05 且阈值5分钟 → 不迟到', () => {
    // 早于 上班+阈值5 = 09:05，故 09:05 不算迟到
    expect(detectDayExceptions(L({ checkIn: '09:05', lateMinutes: 5, checkOut: '18:00' }))).toEqual([]);
    // 09:06 才算迟到，分钟差 = 1
    expect(detectDayExceptions(L({ checkIn: '09:06', lateMinutes: 5, checkOut: '18:00' }))).toEqual([
      expect.objectContaining({ type: 'late', minutes: 1 }),
    ]);
  });

  it('签退早于 下班-阈值 → 早退 early_leave（分钟差）', () => {
    expect(detectDayExceptions(L({ checkIn: '09:00', checkOut: '17:00' }))).toEqual([
      expect.objectContaining({ type: 'early_leave', minutes: 60 }),
    ]);
  });

  it('早退阈值放宽后不判早退：cutoff=18:00-5=17:55，17:57 不早退', () => {
    // 早于 cutoff 才算早退：17:57 → 不算
    expect(detectDayExceptions(L({ checkIn: '09:00', checkOut: '17:57', earlyLeaveMinutes: 5 }))).toEqual([]);
    // 17:54 → cutoff-17:54 = 1 分钟早退
    expect(detectDayExceptions(L({ checkIn: '09:00', checkOut: '17:54', earlyLeaveMinutes: 5 }))).toEqual([
      expect.objectContaining({ type: 'early_leave', minutes: 1 }),
    ]);
  });

  it('当日到岗却缺下班卡 → 缺卡 missing_punch', () => {
    expect(detectDayExceptions(L({ checkIn: '09:00', checkOut: null }))).toEqual([
      expect.objectContaining({ type: 'missing_punch' }),
    ]);
  });

  it('当日到岗却缺上班卡 → 缺卡 missing_punch', () => {
    expect(detectDayExceptions(L({ checkIn: null, checkOut: '18:00' }))).toEqual([
      expect.objectContaining({ type: 'missing_punch' }),
    ]);
  });

  it('迟到且缺下班卡 → 同时产生 late 与 missing_punch 两条', () => {
    const res = detectDayExceptions(L({ checkIn: '09:20', checkOut: null }));
    expect(res).toEqual([
      expect.objectContaining({ type: 'late', minutes: 20 }),
      expect.objectContaining({ type: 'missing_punch' }),
    ]);
  });

  it('至少有一条打卡即不算缺勤（缺卡优先于缺勤）', () => {
    // 有 checkIn 无 checkOut → missing_punch，而非 absent
    const res = detectDayExceptions(L({ checkIn: '09:00', checkOut: null }));
    expect(res.some((e) => e.type === 'absent')).toBe(false);
    expect(res.some((e) => e.type === 'missing_punch')).toBe(true);
  });

  it('迟到与早退可能并存', () => {
    const res = detectDayExceptions(L({ checkIn: '10:00', checkOut: '16:00' }));
    expect(res).toEqual([
      expect.objectContaining({ type: 'late', minutes: 60 }),
      expect.objectContaining({ type: 'early_leave', minutes: 120 }),
    ]);
  });
});