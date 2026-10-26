// 工作台品牌色工具：统一为品牌蓝系（#2455D9 同系深浅），去除历史杂色，形成单色系层级
export const BRAND_PALETTE = [
  '#1f3f8f',
  '#2547a8',
  '#2b52c4',
  '#2455D9',
  '#315fe3',
  '#3e6cec',
  '#4d7bf3',
  '#5e8bf5',
  '#719bf7',
];

export interface BrandTone {
  color: string;
  bgColor: string;
}

/** 品牌主蓝（工作台柱状图/强调色统一走此 token，禁止四处散落硬编码色值） */
export const BRAND_PRIMARY = '#2455D9';

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function brandTone(index: number): BrandTone {
  const color = BRAND_PALETTE[(Math.abs(index) % BRAND_PALETTE.length + BRAND_PALETTE.length) % BRAND_PALETTE.length];
  return {
    color,
    bgColor: `linear-gradient(135deg, ${hexToRgba(color, 0.12)}, ${hexToRgba(color, 0.04)})`,
  };
}