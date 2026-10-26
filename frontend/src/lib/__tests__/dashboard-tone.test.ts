import { brandTone, BRAND_PALETTE, BRAND_PRIMARY } from '@/lib/dashboard-tone';

// 把 #rrggbb 解析为 [r,g,b]
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 计算色调 hue（0-360）
function hueOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return 0;
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(h * 60);
}

describe('dashboard-tone 工作台品牌色', () => {
  it('BRAND_PALETTE 每一项都是品牌蓝系（hue 210-245），不留紫/绿/红/青杂色', () => {
    const foreignHues = [86, 38, 175, 162, 0, 235 + 6]; // 绿/琥珀/紫罗兰/青
    for (const hex of BRAND_PALETTE) {
      const h = hueOf(hex);
      expect(h).toBeGreaterThanOrEqual(210);
      expect(h).toBeLessThanOrEqual(245);
    }
    expect(foreignHues.some((h) => BRAND_PALETTE.some((hex) => Math.abs(hueOf(hex) - h) < 8))).toBe(
      false
    );
  });

  it('brandTone 同 index 结果确定（同一蓝调）', () => {
    expect(brandTone(0)).toEqual(brandTone(0));
    expect(brandTone(3)).toEqual(brandTone(3));
  });

  it('覆盖 9 个快捷入口 index，至少生成 5 种不同的蓝调（同系有层次）', () => {
    const colors = new Set(Array.from({ length: 9 }, (_, i) => brandTone(i).color));
    expect(colors.size).toBeGreaterThanOrEqual(5);
  });

  it('bgColor 是品牌蓝的半透明 linear-gradient，与 color 同源', () => {
    const tone = brandTone(2);
    expect(tone.bgColor).toMatch(/^linear-gradient\(135deg, rgba\(/);
    // bgColor 内嵌与 icon color 相同的 rgb 主色
    const [r, g, b] = hexToRgb(tone.color);
    expect(tone.bgColor).toContain(`${r},${g},${b}`);
  });

  it('BRAND_PRIMARY 为品牌主蓝 #2455D9', () => {
    expect(BRAND_PRIMARY).toBe('#2455D9');
    expect(Math.abs(hueOf(BRAND_PRIMARY) - 227)).toBeLessThanOrEqual(40);
  });
});