// 考勤日历：日类型判定 + 加班归桶（缺陷 P0-2 的基础）
// 引擎里「平日 1.5 / 休息日 2 / 法定 3 倍」要真正生效，前提是能判定「当天算什么日」。
// 仅凭星期几不够：法定节假日逐年公布，且存在调休上班的周六，必须有日历数据兜底。
import { describe, it, expect } from '@jest/globals';
import {
  resolveDayType,
  splitOvertimeMinutes,
  holidayKey,
  type HolidayDayType,
} from '../src/attendance/engine/workday-calendar';

describe('考勤日历 · 日类型判定（P0-2）', () => {
  const calendar = new Map<string, HolidayDayType>([
    ['2026-10-01', 'holiday'], // 国庆法定节假日（周四）
    ['2026-10-05', 'rest'], // 国庆假期内的休息日（周一，不登记会被误判为工作日）
    ['2026-10-10', 'workday'], // 调休上班的周六
  ]);

  it('未登记日期：周一~周五为平日，周六周日为休息日', () => {
    expect(resolveDayType(new Date('2026-09-30T00:00:00Z'), calendar)).toBe('weekday');
    expect(resolveDayType(new Date('2026-10-03T00:00:00Z'), calendar)).toBe('weekend');
    expect(resolveDayType(new Date('2026-10-04T00:00:00Z'), calendar)).toBe('weekend');
  });

  it('登记为法定节假日 → holiday（加班 3 倍）', () => {
    expect(resolveDayType(new Date('2026-10-01T00:00:00Z'), calendar)).toBe('holiday');
  });

  it('登记为休息日 → weekend（加班 2 倍），即使当天是周一', () => {
    expect(resolveDayType(new Date('2026-10-05T00:00:00Z'), calendar)).toBe('weekend');
  });

  it('登记为调休上班日 → weekday（加班 1.5 倍），即使当天是周六', () => {
    expect(resolveDayType(new Date('2026-10-10T00:00:00Z'), calendar)).toBe('weekday');
  });

  it('日历键按 UTC 日期取（业务日以 UTC 午夜存储）', () => {
    expect(holidayKey(new Date('2026-09-30T00:00:00Z'))).toBe('2026-09-30');
    expect(holidayKey(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10-01');
  });

  it('加班分钟按日类型归入唯一桶（不得重复计入）', () => {
    expect(splitOvertimeMinutes(120, 'weekday')).toEqual({ weekday: 120, weekend: 0, holiday: 0 });
    expect(splitOvertimeMinutes(120, 'weekend')).toEqual({ weekday: 0, weekend: 120, holiday: 0 });
    expect(splitOvertimeMinutes(120, 'holiday')).toEqual({ weekday: 0, weekend: 0, holiday: 120 });
    expect(splitOvertimeMinutes(0, 'weekend')).toEqual({ weekday: 0, weekend: 0, holiday: 0 });
  });
});
