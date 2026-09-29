import { toCents, fromCents, sumCents, round2 } from './money.util';

describe('MoneyUtil · 定点金额工具（以「分」为单位的整数运算）', () => {
  describe('toCents', () => {
    it('整数金额转为整数分', () => {
      expect(toCents(100)).toBe(10000);
      expect(toCents(0)).toBe(0);
    });

    it('经典浮点值转为精确整数分', () => {
      expect(toCents(0.1 + 0.2)).toBe(30);
    });

    it('半进位按四舍五入处理（1.005 → 101）', () => {
      expect(toCents(1.005)).toBe(101);
    });

    it('负数保留符号（-2.675 → -268）', () => {
      expect(toCents(-2.675)).toBe(-268);
    });

    it('非有限值按 0 处理，不污染后续累加', () => {
      expect(toCents(NaN)).toBe(0);
      expect(toCents(Infinity)).toBe(0);
      expect(toCents(-Infinity)).toBe(0);
    });
  });

  describe('fromCents', () => {
    it('整数分还原为元', () => {
      expect(fromCents(11275)).toBe(112.75);
    });

    it('与 toCents 往返一致', () => {
      expect(fromCents(toCents(1.005))).toBe(1.01);
      expect(fromCents(toCents(-1.235))).toBe(-1.24);
      expect(fromCents(0)).toBe(0);
    });
  });

  describe('sumCents', () => {
    it('先把每项转整数分再累加', () => {
      expect(sumCents([100, 12.5, 0.25])).toBe(11275);
    });

    it('多项小数累加不受二进制浮点误差影响', () => {
      // 100 笔 0.07 直接浮点累加会漂移，定点累加应恒为 700 分
      expect(sumCents(Array(100).fill(0.07))).toBe(700);
    });

    it('空数组返回 0', () => {
      expect(sumCents([])).toBe(0);
    });

    it('负数项参与累加', () => {
      expect(sumCents([10, -2.5])).toBe(750);
    });
  });

  describe('round2', () => {
    it('整数不变', () => {
      expect(round2(100)).toBe(100);
    });

    it('三位小数按分四舍五入', () => {
      expect(round2(1.234)).toBe(1.23);
      expect(round2(1.235)).toBe(1.24);
      expect(round2(1.236)).toBe(1.24);
    });

    it('零返回零', () => {
      expect(round2(0)).toBe(0);
    });

    it('半进位不受二进制表示误差影响（1.005 → 1.01）', () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(0.015)).toBe(0.02);
    });

    it('浮点漂移值被规约（0.1 + 0.2 → 0.3）', () => {
      expect(round2(0.1 + 0.2)).toBe(0.3);
    });

    it('负数保留符号', () => {
      expect(round2(-1.235)).toBe(-1.24);
    });

    it('由定点工具派生，两者结果一致', () => {
      expect(round2(1.005)).toBe(fromCents(toCents(1.005)));
      expect(round2(-1.235)).toBe(fromCents(toCents(-1.235)));
    });
  });
});