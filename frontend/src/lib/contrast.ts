/**
 * 背景色 → 可读文字色：按 BT.601 加权亮度判断，浅底用深色文字、深底用白色文字。
 *
 * 统一口径（下班次页三处本地副本合并而来）：
 * - 亮度阈值：0.55（(0.299R + 0.587G + 0.114B) / 255）
 * - 浅色背景返回 `var(--lx-text-1)`（语义 token，随明暗主题自适应）
 * - 深色背景返回 `#ffffff`
 * - 缺失/空/非法输入一律回落 `var(--lx-text-1)`，保证调用点渲染不报错
 */
export function getContrastColor(bg?: string): string {
  if (!bg) return 'var(--lx-text-1)';
  let c = bg.trim().replace('#', '');
  if (c.length === 3) {
    c = c
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return 'var(--lx-text-1)';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? 'var(--lx-text-1)' : '#ffffff';
}
