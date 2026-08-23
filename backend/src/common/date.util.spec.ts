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
});
