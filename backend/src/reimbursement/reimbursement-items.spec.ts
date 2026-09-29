import { sumReimbursementItems } from './reimbursement-items';

describe('sumReimbursementItems · 报销金额汇总（金额一律 decimal/禁止浮点）', () => {
  it('整数与两位小数求和正确', () => {
    expect(sumReimbursementItems([100, 12.5, 0.25])).toBe(112.75);
  });

  it('多个小数累计不受二进制浮点误差影响', () => {
    // 0.1 + 0.2 = 0.30000000000000004，应被定点规约到 0.3
    expect(sumReimbursementItems([0.1, 0.2])).toBe(0.3);
  });

  it('大量明细累计不漂移（100 笔 0.07 = 7）', () => {
    expect(sumReimbursementItems(Array(100).fill(0.07))).toBe(7);
  });

  it('超两位小数的明细先按分规约再累加', () => {
    // 每笔先转整数分（101）再累加 → 202 分 = 2.02，与逐笔入库的 Decimal 口径一致
    expect(sumReimbursementItems([1.005, 1.005])).toBe(2.02);
    expect(sumReimbursementItems([1.005])).toBe(1.01);
  });

  it('空数组返回 0', () => {
    expect(sumReimbursementItems([])).toBe(0);
  });

  it('负数项参与求和', () => {
    expect(sumReimbursementItems([10, -2.5])).toBe(7.5);
  });
});