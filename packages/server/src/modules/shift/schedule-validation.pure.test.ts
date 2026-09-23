import { describe, it, expect } from 'vitest';
import {
  isValidDate,
  validateScheduleRows,
  type ScheduleValidationRow,
} from './schedule-validation.pure';

function row(overrides: Partial<ScheduleValidationRow> = {}): ScheduleValidationRow {
  return {
    userId: 1,
    shiftId: 9,
    scheduleDate: '2026-09-22',
    isRestDay: false,
    departmentId: 3,
    ...overrides,
  };
}

describe('isValidDate', () => {
  it('接受合法日期与闰年日', () => {
    expect(isValidDate('2026-09-22')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // 闰年
  });

  it('拒绝非法日期', () => {
    expect(isValidDate('2026-02-29')).toBe(false); // 非闰年 2 月 29
    expect(isValidDate('2026-13-01')).toBe(false); // 月份越界
    expect(isValidDate('2026-00-10')).toBe(false); // 月份为 0
    expect(isValidDate('2026-09-31')).toBe(false); // 9 月只有 30 天
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('2026-9-1')).toBe(false); // 未补零
  });
});

describe('validateScheduleRows', () => {
  it('全部合法 → valid true 且无 issues', () => {
    const res = validateScheduleRows(
      [
        row({ userId: 1, scheduleDate: '2026-09-22' }),
        row({ userId: 2, shiftId: 9, scheduleDate: '2026-09-22' }),
      ],
      [9],
    );
    expect(res.valid).toBe(true);
    expect(res.issues).toHaveLength(0);
  });

  it('日期非法 → 报 scheduleDate 问题（含行下标）', () => {
    const rows = [row({ scheduleDate: '2026-02-30' })];
    const res = validateScheduleRows(rows, [9]);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.field === 'scheduleDate' && i.index === 0)).toBe(true);
  });

  it('非休息日引用不存在的班次 → 报 shiftId 问题', () => {
    // knownShiftIds = [9]，使用 99
    const res = validateScheduleRows([row({ shiftId: 99 })], [9]);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.field === 'shiftId')).toBe(true);
  });

  it('休息日带任意 shiftId 不校验班次存在性', () => {
    const res = validateScheduleRows([row({ shiftId: 999, isRestDay: true })], [9]);
    expect(res.issues.some((i) => i.field === 'shiftId')).toBe(false);
  });

  it('同一员工同一天重复 → 报 duplicateUserDate 冲突', () => {
    const res = validateScheduleRows(
      [row({ userId: 1, scheduleDate: '2026-09-22' }), row({ userId: 1, scheduleDate: '2026-09-22' })],
      [9],
    );
    expect(res.valid).toBe(false);
    const dup = res.issues.find((i) => i.field === 'duplicateUserDate');
    expect(dup).toBeDefined();
    // 第二次出现的那条被标记（index === 1）
    expect(dup?.index).toBe(1);
  });

  it('不同员工同日不构成冲突', () => {
    const res = validateScheduleRows(
      [row({ userId: 1 }), row({ userId: 2, scheduleDate: '2026-09-22' })],
      [9],
    );
    expect(res.issues.filter((i) => i.field === 'duplicateUserDate')).toHaveLength(0);
  });
});