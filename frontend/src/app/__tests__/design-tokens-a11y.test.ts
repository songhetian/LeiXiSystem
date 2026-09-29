/**
 * 设计 token 无障碍闸门（WCAG 2.2 AA 对比度 SC 1.4.3）
 *
 * 目的：把"暗色主题只覆盖 token、不覆盖主题化样式"与"var() 未解析导致焦点环消失"
 * 这类回归变成仓库内的客观门槛。直接解析 globals.css 真值（而非硬编码取证值），
 * 递归展开 var() 引用，对明暗双主题分别计算关键表面的对比度。
 *
 * 选取的断言面：
 *  - 状态标签：语义文字色 vs（底色基色按 alpha 合成到卡片底）≥ 4.5:1
 *  - 文字层级 text-1/2/3 vs 卡片底 ≥ 4.5:1（正文，须达 AA 正常文本）
 *  - 焦点轮廓 --lx-focus-outline 在明暗双主题都必须解析为合法颜色（守护浅色失效 bug）
 *  - 外壳 --lx-header-bg / --lx-tabs-bg 在明暗双主题都必须解析为合法颜色
 *
 * 不属于本闸门（设计上有意豁免）：text-4 为禁用/占位提示色，按 WCAG 1.4.3  inactive
 * 组件豁免，不强制 4.5:1。
 */
import fs from 'fs';
import path from 'path';

const CSS_PATH = path.join(__dirname, '..', 'globals.css');
const css = fs.readFileSync(CSS_PATH, 'utf-8');

type TokenMap = Record<string, string>;

function extractBlock(re: RegExp): TokenMap {
  const m = css.match(re);
  if (!m) throw new Error(`未找到 CSS 块: ${re}`);
  const body = m[1];
  const map: TokenMap = {};
  for (const line of body.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).replace(/;.*$/, '').trim();
    if (name.startsWith('--') && value) map[name.slice(2)] = value;
  }
  return map;
}

const rootMap = extractBlock(/:root\s*\{([^}]*)\}/);
const darkMap = extractBlock(/\[data-theme="dark"\]\s*\{([^}]*)\}/);

/** 递归展开 var(--x)，dark 优先、缺失回落 :root；无法解析返回 undefined。 */
function resolve(name: string, theme: TokenMap = darkMap, depth = 0): string | undefined {
  if (depth > 12) return undefined;
  const raw = theme[name] ?? rootMap[name];
  if (raw === undefined) return undefined;
  const re = /var\((--[\w-]+)\)/g;
  let out = raw;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const sub = resolve(m[1].slice(2), theme, depth + 1);
    if (sub === undefined) return undefined;
    out = out.replace(m[0], sub);
  }
  return out;
}

type RGBA = [number, number, number, number];

function parseColor(s: string | undefined): RGBA | null {
  if (!s) return null;
  const v = s.trim();
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        1,
      ];
    }
    return null;
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  }
  return null;
}

/** 把带 alpha 的前景合成到不透明底色上。 */
function composite(fg: RGBA, base: RGBA): RGBA {
  const a = fg[3];
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + base[i] * (1 - a))) as RGBA;
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(rgb: RGBA): number {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
function ratio(a: RGBA, b: RGBA): number {
  const la = lum(a);
  const lb = lum(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;

function tagContrast(theme: TokenMap, key: string): number {
  const text = parseColor(resolve(`lx-${key}-text`, theme));
  const bg = parseColor(resolve(`lx-${key}-bg`, theme));
  const card = parseColor(resolve('lx-bg-card', theme));
  if (!text || !bg || !card) throw new Error(`状态标签 ${key} 颜色解析失败`);
  return ratio(text, composite(bg, card));
}

describe('设计 token 对比度闸门（WCAG 2.2 AA）', () => {
  const statusKeys = ['success', 'warning', 'danger', 'info', 'purple'];

  describe('浅色主题 :root', () => {
    it.each(statusKeys)('状态标签 %s 文字 vs 合成底色 ≥ %s:1', (key) => {
      expect(tagContrast(rootMap, key)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('中性标签文字 vs 底色 ≥ 4.5:1', () => {
      const text = parseColor(resolve('lx-neutral-text', rootMap))!;
      const bg = parseColor(resolve('lx-neutral-tag-bg', rootMap))!;
      expect(ratio(text, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each([1, 2, 3])('正文层级 text-%i vs 卡片底 ≥ 4.5:1', (t) => {
      const text = parseColor(resolve(`lx-text-${t}`, rootMap))!;
      const card = parseColor(resolve('lx-bg-card', rootMap))!;
      expect(ratio(text, card)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('焦点轮廓 --lx-focus-outline 解析为合法颜色（守护浅色失效）', () => {
      const c = parseColor(resolve('lx-focus-outline', rootMap));
      expect(c).not.toBeNull();
    });

    it('外壳 --lx-header-bg / --lx-tabs-bg 解析为合法颜色', () => {
      expect(parseColor(resolve('lx-header-bg', rootMap))).not.toBeNull();
      expect(parseColor(resolve('lx-tabs-bg', rootMap))).not.toBeNull();
    });
  });

  describe('暗色主题 [data-theme="dark"]', () => {
    it.each(statusKeys)('状态标签 %s 文字 vs 合成底色 ≥ %s:1', (key) => {
      expect(tagContrast(darkMap, key)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('中性标签文字 vs 底色 ≥ 4.5:1', () => {
      const text = parseColor(resolve('lx-neutral-text', darkMap))!;
      const bg = parseColor(resolve('lx-neutral-tag-bg', darkMap))!;
      expect(ratio(text, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each([1, 2, 3])('正文层级 text-%i vs 卡片底 ≥ 4.5:1', (t) => {
      const text = parseColor(resolve(`lx-text-${t}`, darkMap))!;
      const card = parseColor(resolve('lx-bg-card', darkMap))!;
      expect(ratio(text, card)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('焦点轮廓 --lx-focus-outline 解析为合法颜色（守护暗色失效）', () => {
      const c = parseColor(resolve('lx-focus-outline', darkMap));
      expect(c).not.toBeNull();
    });

    it('外壳 --lx-header-bg / --lx-tabs-bg 解析为合法颜色', () => {
      expect(parseColor(resolve('lx-header-bg', darkMap))).not.toBeNull();
      expect(parseColor(resolve('lx-tabs-bg', darkMap))).not.toBeNull();
    });
  });
});
