/**
 * 报表分组键（月 / 季度 / 年）。
 *
 * 入参是**以 UTC 午夜存储**的业务日期（schema 中 hireDate / resignDate /
 * probationEndDate 均为 `@db.Date`），因此取年月一律用 `getUTC*`：
 * 本地 getter 在负时区会把 UTC 午夜的日期退回前一天/上一月，
 * 导致「9 月末入职」被统计进 10 月的人力成本报表。
 */
export type GroupByPeriod = 'month' | 'quarter' | 'year';

export function getPeriodKey(date: Date, groupBy: GroupByPeriod): string {
  const year = date.getUTCFullYear();
  if (groupBy === 'year') {
    return String(year);
  }
  if (groupBy === 'quarter') {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
