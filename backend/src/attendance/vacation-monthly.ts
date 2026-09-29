/**
 * 月假额度口径（全后端唯一来源）。
 *
 * 月假类型的月度数配置为「12 个元素，依次对应 1~12 月的每日额度」，
 * 因此 monthlyDays 存在且长度恰为 12 即视为月假类型；否则按年额度（month=0）处理。
 * 前端同口径实现见 frontend/src/lib/vacation-type.ts。
 */

/** 取月假额度数组；非月假（未配置或长度不为 12）返回 null */
export function getMonthlyDays(monthlyDays?: unknown): number[] | null {
  return Array.isArray(monthlyDays) && monthlyDays.length === 12
    ? (monthlyDays as number[])
    : null;
}

/** 是否为月假类型 */
export function isMonthlyDays(monthlyDays?: unknown): boolean {
  return getMonthlyDays(monthlyDays) !== null;
}