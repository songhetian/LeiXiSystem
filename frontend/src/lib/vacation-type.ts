/**
 * 月假额度口径（前端唯一来源），与后端 `backend/src/attendance/vacation-monthly.ts` 同口径。
 *
 * 月假类型的月度数配置为「12 个元素，依次对应 1~12 月的每日额度」，
 * 因此 monthlyDays 存在且长度恰为 12 即视为月假类型；否则按年额度展示。
 */

/** 是否为月假类型 */
export function isMonthlyDays(monthlyDays?: unknown): boolean {
  return Array.isArray(monthlyDays) && monthlyDays.length === 12;
}