/**
 * 定点金额工具（以「分」为单位的整数运算）。
 *
 * 金额一律先转整数分再参与累加与写库，避免 IEEE754 浮点漂移
 * （如 0.1 + 0.2 = 0.30000000000000004、100 笔 0.07 累加 != 7）。
 * 算薪、报销等所有跨模块金额口径统一从这里取，禁止各自实现。
 */

/** 金额转整数分（四舍五入到分，负数按绝对值取整后回填符号，非有限值按 0 处理）。 */
export function toCents(amount: number): number {
  if (!isFinite(amount)) return 0;
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  // 字符串指数技巧：绕开 1.005 * 100 = 100.49999999999999 这类二进制表示误差
  return sign * Math.round(Number(Math.round(Number(abs + 'e' + 2)) + 'e-' + 2) * 100);
}

/** 整数分还原为元（保留两位小数的数值）。 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** 定点累加：先把每一项转成整数分再相加，返回合计分。 */
export function sumCents(amounts: number[]): number {
  return amounts.reduce((acc, a) => acc + toCents(a), 0);
}

/** 金额四舍五入到两位小数（由定点工具派生）。 */
export function round2(n: number): number {
  return fromCents(toCents(n));
}