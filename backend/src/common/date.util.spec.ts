/**
 * 以 UTC（=生产容器时区）运行：开发机 GMT+8 下 `new Date('YYYY-MM-DD HH:mm')`
 * 会"碰巧"得到正确结果，只有非北京时区才能暴露墙钟串解析偏移。
 *
 * @jest-environment ./jest-utc-environment
 */
import {
  calculateDateDiff,
  calculateTenure,
  formatTenure,
  formatAvgTenure,
  isValidDate,
  isStartBeforeEnd,
  isDateNotTooFarFuture,
  isDateNotBeforeHireDate,
  calculateLeaveDays,
  beijingNow,
  beijingBusinessDate,
  beijingDateTime,
  parseBeijingDateTime,
  monthRangeUtc,
  beijingDateTimeStr,
  beijingDateRangeFilter,
  addMonthsUtc,
} from './date.util';

describe('DateUtil', () => {
  describe('calculateDateDiff', () => {
    it('应该正确计算同一天的日期差', () => {
      const start = new Date('2025-03-20');
      const end = new Date('2025-03-20');
      const diff = calculateDateDiff(start, end);
      expect(diff.years).toBe(0);
      expect(diff.months).toBe(0);
      expect(diff.days).toBe(0);
      expect(diff.totalDays).toBe(0);
      expect(diff.totalMonths).toBe(0);
    });

    it('应该正确计算整1年的日期差', () => {
      const start = new Date('2024-03-20');
      const end = new Date('2025-03-20');
      const diff = calculateDateDiff(start, end);
      expect(diff.years).toBe(1);
      expect(diff.months).toBe(0);
      expect(diff.days).toBe(0);
      expect(diff.totalMonths).toBe(12);
    });

    it('应该正确计算1年10个月5天的日期差', () => {
      const start = new Date('2020-05-15');
      const end = new Date('2025-03-20');
      const diff = calculateDateDiff(start, end);
      expect(diff.years).toBe(4);
      expect(diff.months).toBe(10);
      expect(diff.days).toBe(5);
    });

    it('应该正确计算不足1个月的日期差', () => {
      const start = new Date('2025-03-01');
      const end = new Date('2025-03-15');
      const diff = calculateDateDiff(start, end);
      expect(diff.years).toBe(0);
      expect(diff.months).toBe(0);
      expect(diff.days).toBe(14);
      expect(diff.totalDays).toBe(14);
    });

    it('应该正确处理日期天数不足的情况（借位）', () => {
      const start = new Date('2025-03-31');
      const end = new Date('2025-04-15');
      const diff = calculateDateDiff(start, end);
      expect(diff.months).toBe(0);
      expect(diff.days).toBe(15);
    });

    it('应该正确计算总月数', () => {
      const start = new Date('2023-01-15');
      const end = new Date('2025-06-20');
      const diff = calculateDateDiff(start, end);
      expect(diff.years).toBe(2);
      expect(diff.months).toBe(5);
      expect(diff.totalMonths).toBe(29);
    });
  });

  describe('formatTenure', () => {
    it('应该格式化0天', () => {
      expect(formatTenure({ years: 0, months: 0, days: 0 })).toBe('0天');
    });

    it('应该格式化只有天数的司龄', () => {
      expect(formatTenure({ years: 0, months: 0, days: 15 })).toBe('15天');
    });

    it('应该格式化只有月数的司龄', () => {
      expect(formatTenure({ years: 0, months: 6, days: 0 })).toBe('6个月');
    });

    it('应该格式化只有年数的司龄', () => {
      expect(formatTenure({ years: 3, months: 0, days: 0 })).toBe('3年');
    });

    it('应该格式化年月组合的司龄', () => {
      expect(formatTenure({ years: 4, months: 10, days: 5 })).toBe('4年10个月');
    });
  });

  describe('calculateTenure', () => {
    it('应该返回完整的司龄信息', () => {
      const hireDate = new Date('2020-05-15');
      const now = new Date('2025-03-20');
      const tenure = calculateTenure(hireDate, now);
      expect(tenure.years).toBe(4);
      expect(tenure.months).toBe(10);
      expect(tenure.days).toBe(5);
      expect(tenure.formatted).toBe('4年10个月');
      expect(tenure.totalMonths).toBe(58);
      expect(tenure.totalYears).toBeGreaterThan(4.8);
      expect(tenure.totalYears).toBeLessThan(4.9);
    });
  });

  describe('formatAvgTenure', () => {
    it('应该格式化平均司龄（整数年）', () => {
      expect(formatAvgTenure(3)).toBe('3年');
    });

    it('应该格式化平均司龄（年+月）', () => {
      expect(formatAvgTenure(2.5)).toBe('2年6个月');
    });

    it('应该格式化平均司龄（只有月）', () => {
      expect(formatAvgTenure(0.25)).toBe('3个月');
    });

    it('应该格式化0年的平均司龄', () => {
      expect(formatAvgTenure(0)).toBe('0个月');
    });
  });

  describe('isValidDate', () => {
    it('应该正确识别有效日期', () => {
      expect(isValidDate('2025-01-15')).toBe(true);
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate('2025-12-31')).toBe(true);
    });

    it('应该正确识别无效日期', () => {
      expect(isValidDate('invalid-date')).toBe(false);
      expect(isValidDate('')).toBe(false);
      expect(isValidDate('2025-13-01')).toBe(false);
    });
  });

  describe('isStartBeforeEnd', () => {
    it('开始日期早于结束日期时返回true', () => {
      expect(isStartBeforeEnd('2025-01-15', '2025-01-20')).toBe(true);
    });

    it('开始日期等于结束日期时返回true', () => {
      expect(isStartBeforeEnd('2025-01-15', '2025-01-15')).toBe(true);
    });

    it('开始日期晚于结束日期时返回false', () => {
      expect(isStartBeforeEnd('2025-01-20', '2025-01-15')).toBe(false);
    });
  });

  describe('isDateNotTooFarFuture', () => {
    it('当前日期应该返回true', () => {
      expect(isDateNotTooFarFuture(new Date(), 1)).toBe(true);
    });

    it('半年后的日期应该返回true', () => {
      const date = new Date();
      date.setMonth(date.getMonth() + 6);
      expect(isDateNotTooFarFuture(date, 1)).toBe(true);
    });

    it('2年后的日期应该返回false', () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() + 2);
      expect(isDateNotTooFarFuture(date, 1)).toBe(false);
    });

    it('过去的日期应该返回true', () => {
      expect(isDateNotTooFarFuture('2020-01-01', 1)).toBe(true);
    });
  });

  describe('isDateNotBeforeHireDate', () => {
    it('日期晚于入职日期时返回true', () => {
      expect(isDateNotBeforeHireDate('2025-01-15', '2020-01-01')).toBe(true);
    });

    it('日期等于入职日期时返回true', () => {
      expect(isDateNotBeforeHireDate('2020-01-01', '2020-01-01')).toBe(true);
    });

    it('日期早于入职日期时返回false', () => {
      expect(isDateNotBeforeHireDate('2019-01-01', '2020-01-01')).toBe(false);
    });
  });

  describe('calculateLeaveDays', () => {
    it('同一天请假应该返回1天', () => {
      expect(calculateLeaveDays('2025-01-15', '2025-01-15')).toBe(1);
    });

    it('5天请假应该正确计算', () => {
      expect(calculateLeaveDays('2025-01-15', '2025-01-19')).toBe(5);
    });

    it('跨月请假应该正确计算', () => {
      expect(calculateLeaveDays('2025-01-30', '2025-02-03')).toBe(5);
    });
  });

  // -----------------------------------------------------------------
  // 北京时间口径：断言全部基于「真实时刻(UTC)」，与运行机器时区无关，
  // 因此能在 TZ=Asia/Shanghai 的宿主机与 TZ=UTC 的容器中给出一致结论。
  // -----------------------------------------------------------------
  describe('beijingNow', () => {
    it('按北京时间取年月日（UTC 容器下不退回前一天）', () => {
      // 北京 2026-08-15 01:00 === UTC 2026-08-14 17:00
      expect(beijingNow(new Date('2026-08-14T17:00:00Z'))).toEqual({
        year: 2026,
        month: 8,
        day: 15,
      });
    });

    it('北京 23:59 仍取当天', () => {
      // 北京 2026-08-15 23:59 === UTC 2026-08-15 15:59
      expect(beijingNow(new Date('2026-08-15T15:59:00Z'))).toEqual({
        year: 2026,
        month: 8,
        day: 15,
      });
    });
  });

  describe('beijingBusinessDate', () => {
    it('北京 01:00 的业务日是当天，而非服务器本地日期的前一天', () => {
      // 北京 2026-08-15 01:00 === UTC 2026-08-14 17:00
      expect(beijingBusinessDate(new Date('2026-08-14T17:00:00Z')).toISOString()).toBe(
        '2026-08-15T00:00:00.000Z',
      );
    });

    it('北京 23:59 的业务日仍是当天', () => {
      expect(beijingBusinessDate(new Date('2026-08-15T15:59:00Z')).toISOString()).toBe(
        '2026-08-15T00:00:00.000Z',
      );
    });

    it('跨年边界：北京 2027-01-01 00:30 归入新年度', () => {
      // 北京 2027-01-01 00:30 === UTC 2026-12-31 16:30
      expect(beijingBusinessDate(new Date('2026-12-31T16:30:00Z')).toISOString()).toBe(
        '2027-01-01T00:00:00.000Z',
      );
    });
  });

  describe('beijingDateTime', () => {
    const workDate = new Date('2026-08-15T00:00:00.000Z');

    it('班次 09:00 → 北京 09:00（UTC 01:00），不受服务器时区影响', () => {
      expect(beijingDateTime(workDate, '09:00').toISOString()).toBe('2026-08-15T01:00:00.000Z');
    });

    it('班次 22:00 → 北京 22:00（UTC 14:00）', () => {
      expect(beijingDateTime(workDate, '22:00').toISOString()).toBe('2026-08-15T14:00:00.000Z');
    });

    it('跨天班次的结束 06:00 → 次日北京 06:00（UTC 当日 22:00）', () => {
      expect(beijingDateTime(workDate, '06:00', 1).toISOString()).toBe(
        '2026-08-15T22:00:00.000Z',
      );
    });

    it('00:30 → 北京 00:30（UTC 前一日 16:30）', () => {
      expect(beijingDateTime(workDate, '00:30').toISOString()).toBe('2026-08-14T16:30:00.000Z');
    });
  });

  // 前端 RangePicker(format="YYYY-MM-DD HH:mm") 回传的是**无时区墙钟串**，
  // 直接 new Date(str) 会按服务器本地时区解析；UTC 容器下整体偏 8 小时且可能跨日。
  describe('parseBeijingDateTime', () => {
    it('无时区墙钟串按北京时间解析：18:00 → UTC 10:00', () => {
      expect(parseBeijingDateTime('2026-09-28 18:00')!.toISOString()).toBe(
        '2026-09-28T10:00:00.000Z',
      );
    });

    it('兼容 T 分隔与秒', () => {
      expect(parseBeijingDateTime('2026-09-28T18:00:30')!.toISOString()).toBe(
        '2026-09-28T10:00:30.000Z',
      );
    });

    it('北京 00:30 落到 UTC 前一日 16:30，不跨错日', () => {
      expect(parseBeijingDateTime('2026-09-28 00:30')!.toISOString()).toBe(
        '2026-09-27T16:30:00.000Z',
      );
    });

    it('带显式时区（Z / ±HH:mm）的串按原生语义解析，不做二次换算', () => {
      expect(parseBeijingDateTime('2026-09-28T10:00:00Z')!.toISOString()).toBe(
        '2026-09-28T10:00:00.000Z',
      );
      expect(parseBeijingDateTime('2026-09-28T18:00:00+08:00')!.toISOString()).toBe(
        '2026-09-28T10:00:00.000Z',
      );
    });

    it('非法或溢出输入返回 null', () => {
      expect(parseBeijingDateTime('not-a-date')).toBeNull();
      expect(parseBeijingDateTime('')).toBeNull();
      expect(parseBeijingDateTime('2026-13-01 10:00')).toBeNull();
      expect(parseBeijingDateTime('2026-02-30 10:00')).toBeNull();
      expect(parseBeijingDateTime('2026-09-28 25:00')).toBeNull();
    });
  });

  // 库中业务日一律以 UTC 午夜存储（由 new Date('YYYY-MM-DD') 写入），
  // 因此月度区间必须用 Date.UTC 构造；`new Date(y, m-1, 1)` 会按宿主机本地时区
  // 构造，在 GMT+8 开发机上区间整体前移 8 小时，`lte` 会漏掉当月最后一天。
  describe('monthRangeUtc', () => {
    it('YYYY-MM → 左闭右开的 UTC 区间，与宿主机时区无关', () => {
      const { start, end } = monthRangeUtc('2026-09');
      expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('12 月区间末端顺延到次年 1-01', () => {
      const { start, end } = monthRangeUtc('2026-12');
      expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('闰年 2 月区间覆盖 2-29（末端为 3-01）', () => {
      const { end } = monthRangeUtc('2028-02');
      expect(end.toISOString()).toBe('2028-03-01T00:00:00.000Z');
      // 2-29 落在区间内
      const feb29 = new Date('2028-02-29T00:00:00.000Z');
      expect(feb29.getTime()).toBeGreaterThanOrEqual(monthRangeUtc('2028-02').start.getTime());
      expect(feb29.getTime()).toBeLessThan(monthRangeUtc('2028-02').end.getTime());
    });
  });

  describe('beijingDateTimeStr', () => {
    it('按北京时间格式化，不会比真实时间少 8 小时', () => {
      expect(beijingDateTimeStr(new Date('2026-09-28T10:36:44.000Z'))).toBe('2026-09-28 18:36:44');
    });

    it('北京时间凌晨的记录格式化为当天，不落到前一天', () => {
      expect(beijingDateTimeStr(new Date('2026-09-30T17:30:00.000Z'))).toBe('2026-10-01 01:30:00');
    });

    it('空值返回空串，非法值不抛错', () => {
      expect(beijingDateTimeStr(null)).toBe('');
      expect(beijingDateTimeStr(undefined)).toBe('');
      expect(beijingDateTimeStr('')).toBe('');
      expect(beijingDateTimeStr('not-a-date')).toBe('');
    });
  });

  describe('beijingDateRangeFilter', () => {
    it('单日区间 = 北京时间当天 [00:00, 次日 00:00)', () => {
      const range = beijingDateRangeFilter('2026-09-30', '2026-09-30');
      expect(range!.gte!.toISOString()).toBe('2026-09-29T16:00:00.000Z');
      expect(range!.lt!.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    });

    it('支持单边传参；两边都不传返回 undefined', () => {
      expect(beijingDateRangeFilter('2026-09-30', undefined)!.gte!.toISOString())
        .toBe('2026-09-29T16:00:00.000Z');
      expect(beijingDateRangeFilter(undefined, '2026-09-30')!.lt!.toISOString())
        .toBe('2026-09-30T16:00:00.000Z');
      expect(beijingDateRangeFilter(undefined, undefined)).toBeUndefined();
    });

    it('串里带了时间部分时仍按整天计算（不因时分秒缩小范围）', () => {
      const range = beijingDateRangeFilter('2026-09-30 15:20:00', '2026-09-30 15:20:00');
      expect(range!.gte!.toISOString()).toBe('2026-09-29T16:00:00.000Z');
      expect(range!.lt!.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    });
  });

  // 月末加月必须收敛到目标月最后一天，不能溢出到下下月（1/31 + 1 月 ≠ 3/3）
  describe('addMonthsUtc', () => {
    it('一月末 + 1 个月收敛到 2 月末', () => {
      expect(addMonthsUtc(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
        '2026-02-28T00:00:00.000Z',
      );
    });

    it('闰年 1/31 + 1 个月收敛到 2-29', () => {
      expect(addMonthsUtc(new Date('2024-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
        '2024-02-29T00:00:00.000Z',
      );
    });

    it('普通日期精确加月，跨年正确', () => {
      expect(addMonthsUtc(new Date('2026-09-15T00:00:00.000Z'), 3).toISOString()).toBe(
        '2026-12-15T00:00:00.000Z',
      );
      expect(addMonthsUtc(new Date('2026-11-15T00:00:00.000Z'), 3).toISOString()).toBe(
        '2027-02-15T00:00:00.000Z',
      );
    });

    it('八月末 + 6 个月收敛到次年 2 月末', () => {
      expect(addMonthsUtc(new Date('2026-08-31T00:00:00.000Z'), 6).toISOString()).toBe(
        '2027-02-28T00:00:00.000Z',
      );
    });
  });
});
