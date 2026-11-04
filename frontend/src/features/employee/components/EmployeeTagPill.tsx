'use client';

import type { EmployeeTagLite } from '@/services/employee';

/** 标签色规范化：容错「# 前缀 / 无 # / 3 位短写」，非法输入回退品牌蓝。
 *  存量数据里可能有人手填过 `4f6ef7` 这类无 # 值，直接透传 Arco Tag 会静默失效。 */
export function normalizeTagColor(color?: string | null): string {
  const FALLBACK = '#2455D9';
  if (!color) return FALLBACK;
  let c = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    c = c
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return FALLBACK;
  return `#${c}`;
}

/**
 * 员工标签 pill。
 *
 * 为什么不用 Arco `<Tag color>`：Tag 的 color 只认预设色名（red/green/…），
 * 传 hex 时 `COLORS.indexOf()` 匹配不上会**静默回退默认灰**——用户在标签管理页
 * 挑的颜色从未生效。故标签色一律自绘：浅色底 + 同色文字 + 半透明描边。
 */
export default function EmployeeTagPill({ tag }: { tag: EmployeeTagLite }) {
  const c = normalizeTagColor(tag.color);
  return (
    <span
      className="lx-emp-tag"
      style={{ background: `${c}14`, color: c, borderColor: `${c}40` }}
    >
      {tag.name}
    </span>
  );
}
