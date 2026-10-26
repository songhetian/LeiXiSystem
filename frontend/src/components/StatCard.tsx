'use client';

import { memo, useEffect, useState } from 'react';

/** 解析字符串中的数值段（保留前后缀与小数位），如 '¥12.5万' → {prefix:'¥', num:'12.5', suffix:'万'} */
function parseNumberPart(text: string): { prefix: string; num: string; suffix: string; decimals: number } | null {
  const m = text.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  return { prefix: m[1], num: m[2], suffix: m[3], decimals: (m[2].split('.')[1] ?? '').length };
}

/**
 * 数字滚动（KPI 卡专用）：
 * - prefers-reduced-motion 时不滚动，直接显示目标值；
 * - 目标值不变不重播（依赖数值而非整串文本，'¥12.5万' → '¥12.6万' 也不重播）；
 * - 非数字（如 '—'）原样渲染。
 */
export function Ticker({ text }: { text: string }) {
  const part = parseNumberPart(text);
  const target = part ? parseFloat(part.num) : null;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const ms = 650;
    const tick = (t: number) => {
      const k = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (!part) return <>{text}</>;
  return (
    <>
      {part.prefix}
      {value.toFixed(part.decimals)}
      {part.suffix}
    </>
  );
}

export interface StatCardProps {
  label: string;
  value: string;
  /** 数值单位（人/项/小时），以小字缀在数值后 */
  suffix?: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  /** 卡片右上角的说明小字（如「实时统计」） */
  hint?: string;
  /** 传入则整卡为可点按钮（键盘可达），点击跳转 */
  onClick?: () => void;
}

/**
 * KPI 指标卡：统一品牌蓝图标 + 数值 + 标签。
 * 可点（onClick）时渲染为 <button> 保证键盘可达（WCAG SC 2.1.1）。
 */
function StatCard({ label, value, suffix, icon, hint, onClick }: StatCardProps) {
  const Icon = icon;
  const body = (
    <>
      <div className="dsh-stat-top">
        <span className="dsh-stat-ic">
          <Icon style={{ fontSize: 18 }} />
        </span>
        {hint && (
          <span className="dsh-stat-hint">{hint}</span>
        )}
      </div>
      <div className="dsh-stat-value">
        <Ticker text={value} />
        {suffix && <span className="u">{suffix}</span>}
      </div>
      <div className="dsh-stat-label">{label}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="dsh-stat is-clickable" onClick={onClick} aria-label={`${label}，点击前往处理`}>
        {body}
      </button>
    );
  }
  return <div className="dsh-stat">{body}</div>;
}

export default memo(StatCard);
