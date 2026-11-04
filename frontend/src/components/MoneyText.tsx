'use client';

import { formatMoney } from '@/lib/format';

interface MoneyTextProps {
  /** 金额原值：number / 字符串数字 / null 等，非法值走 fallback */
  value: unknown;
  /** 非法值占位文案，默认 '--'（与 formatMoney 一致） */
  fallback?: string;
  className?: string;
}

/**
 * 金额文本公共组件（REFACTOR_PLAN 11.6-6：负数红色标注）。
 *
 * - 格式化统一走 lib/format.formatMoney（千分位 + 两位小数，ICU 无关）；
 * - 负数时文字标红：色值取全局设计 token `--lx-danger`（明暗主题自动切换），
 *   并追加语义 class `lx-money-negative` 供测试与样式钩子定位。
 * 接入约定：只替换负数可能为负的渲染点；恒为正数的展示继续直接用 formatMoney。
 */
export function MoneyText({ value, fallback, className }: MoneyTextProps) {
  // 与 formatMoney 相同的解析口径：字符串转数字后再判断，非法值不标红
  const n = typeof value === 'string' ? Number(value) : value;
  const isNegative = typeof n === 'number' && Number.isFinite(n) && n < 0;
  return (
    <span
      className={isNegative ? `lx-money-negative${className ? ` ${className}` : ''}` : className}
      style={isNegative ? { color: 'var(--lx-danger)' } : undefined}
    >
      {formatMoney(value, fallback)}
    </span>
  );
}

export default MoneyText;
