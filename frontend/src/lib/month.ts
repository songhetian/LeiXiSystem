import { todayStr } from './format';

/**
 * 月份（'YYYY-MM'）加减。
 *
 * 两处工资条页此前各写一份，且其中一份缺合法性守卫：传入空值/脏值时
 * `ym.split` 直接抛 TypeError，整页白屏（详情缓存串数据时就踩过）。
 * 非法入参一律原样返回，由调用方按「无月份」处理。
 */
export function shiftMonth(ym: string, delta: number): string {
  if (!ym || typeof ym !== 'string') return ym;
  // 严格校验 YYYY-MM：否则 '2026-13' 会被静默归一成 '2027-01'，
  // 脏值会变成「查到别的月份」而不是降级为「无月份」。
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return ym;
  const [year, month] = ym.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/** 当前月份（'YYYY-MM'），按北京时间（todayStr 内部统一口径） */
export function thisMonth(): string {
  return todayStr().slice(0, 7);
}
