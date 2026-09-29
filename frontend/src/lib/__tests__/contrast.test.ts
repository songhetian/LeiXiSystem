import { getContrastColor } from '@/lib/contrast';

describe('getContrastColor 背景色对比文字色', () => {
  it('无输入/空串返回深色文字 token', () => {
    expect(getContrastColor()).toBe('var(--lx-text-1)');
    expect(getContrastColor('')).toBe('var(--lx-text-1)');
  });

  it('浅色背景返回深色文字 token', () => {
    expect(getContrastColor('#ffffff')).toBe('var(--lx-text-1)');
    expect(getContrastColor('#F8B739')).toBe('var(--lx-text-1)');
    expect(getContrastColor('#F0E8CE')).toBe('var(--lx-text-1)');
  });

  it('深色背景返回白色文字', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
    expect(getContrastColor('#2455D9')).toBe('#ffffff');
    expect(getContrastColor('#7c3aed')).toBe('#ffffff');
  });

  it('支持 3 位 hex 缩写', () => {
    expect(getContrastColor('#fff')).toBe('var(--lx-text-1)');
    expect(getContrastColor('#000')).toBe('#ffffff');
  });

  it('非法字符串/非 hex 输入回落为深色文字 token', () => {
    expect(getContrastColor('not-a-color')).toBe('var(--lx-text-1)');
    expect(getContrastColor('var(--lx-primary-weak)')).toBe('var(--lx-text-1)');
    expect(getContrastColor('#12')).toBe('var(--lx-text-1)');
  });
});
