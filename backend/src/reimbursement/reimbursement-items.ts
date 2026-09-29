// 报销金额汇总（金额一律禁止浮点，复用 common/money.util 的定点规约）
import { fromCents, sumCents } from '../common/money.util';

/**
 * 汇总报销明细金额。
 * 直接 reduce 求和会引入二进制浮点误差（如 0.1+0.2=0.30000000000000004，
 * 100 笔 0.07 累加会漂移），此处先把每笔转成整数分累加、再还原为元，
 * 保证与数据库 Decimal 列写入一致。
 */
export function sumReimbursementItems(items: number[]): number {
  return fromCents(sumCents(items));
}