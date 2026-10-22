'use client';

import { PayrollDetailItem, PayrollAdjustmentItem } from '@/services/payroll';

interface SalaryCompositionProps {
  items: PayrollDetailItem[];
  adjustments: PayrollAdjustmentItem[];
  total: number;
}

/** 金额格式化：千分位 + 两位小数。
 *  不用 toLocaleString，避免 Node/jest 与浏览器 ICU 差异导致展示不一致。 */
function formatAmount(n: number): string {
  const fixed = Math.abs(n).toFixed(2);
  const [int, dec] = fixed.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/**
 * 工资构成明细卡（薪资批次明细展开行）。
 *
 * 原实现用通用 Descriptions 表格，视觉上只是一排「标签: 数值」，
 * 且会被 Arco 的 `.arco-table-layout-fixed table` 后代选择器误伤。
 * 这里改为语义化的明细卡：收入项 / 调整项分组、金额等宽右对齐、
 * 增减用符号 + 颜色区分、底部合计强调。
 */
export default function SalaryComposition({ items, adjustments, total }: SalaryCompositionProps) {
  const hasAdjust = adjustments.length > 0;

  return (
    <section className="lx-salary" data-testid="salary-composition">
      <header className="lx-salary-head">
        <h4 className="lx-salary-title">工资构成</h4>
        <div className="lx-salary-badges">
          <span className="lx-salary-badge lx-salary-badge--income">收入 {items.length} 项</span>
          {hasAdjust && (
            <span className="lx-salary-badge lx-salary-badge--adjust">调整 {adjustments.length} 项</span>
          )}
        </div>
      </header>

      <div className="lx-salary-grid">
        {items.map((it) => (
          <div className="lx-salary-item" key={it.code}>
            <span className="lx-salary-label">{it.name}</span>
            <span className="lx-salary-amount">{formatAmount(it.amount)}</span>
          </div>
        ))}
        {adjustments.map((a) => (
          <div className="lx-salary-item lx-salary-item--adjust" key={`adj-${a.id}`}>
            <span className="lx-salary-label" title={a.reason}>
              {a.reason}
            </span>
            <span
              className={`lx-salary-amount ${
                a.amount < 0 ? 'is-minus' : a.amount > 0 ? 'is-plus' : ''
              }`}
            >
              {a.amount < 0 ? '−' : a.amount > 0 ? '+' : ''}
              {formatAmount(a.amount)}
            </span>
          </div>
        ))}
      </div>

      <footer className="lx-salary-total">
        <span className="lx-salary-total-label">合计</span>
        <span className="lx-salary-total-value">{formatAmount(total)}</span>
      </footer>
    </section>
  );
}
