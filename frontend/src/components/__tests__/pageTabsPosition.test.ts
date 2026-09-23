import { clampMenuPosition } from '../page-tabs-position';

describe('clampMenuPosition - 页签右键菜单视口钳制', () => {
  const viewport = { width: 1280, height: 720 };
  const menuSize = { width: 160, height: 150 };

  it('菜单对于常规位置（右上部）正常锚定在页签下方', () => {
    const pos = clampMenuPosition({ left: 100, bottom: 40 }, viewport, menuSize);
    expect(pos.y).toBe(44); // anchor.bottom + gap(4)
    expect(pos.x).toBe(100);
  });

  it('页签靠近视口底边时菜单上移钳制，避免溢出视口', () => {
    // anchor.bottom + 4 = 700，超出可见范围（720-150-6=564）→ 应钳制到 564
    const pos = clampMenuPosition({ left: 100, bottom: 700 }, viewport, menuSize);
    expect(pos.y).toBe(viewport.height - menuSize.height - 6);
  });

  it('页签靠近视口右边时菜单左移钳制，避免水平溢出', () => {
    const pos = clampMenuPosition({ left: 1200, bottom: 40 }, viewport, menuSize);
    expect(pos.x).toBe(viewport.width - menuSize.width - 6);
  });

  it('负数/越上边界位置时菜单钳制到顶部内边距之上', () => {
    const pos = clampMenuPosition({ left: 50, bottom: -20 }, viewport, menuSize);
    expect(pos.y).toBeGreaterThanOrEqual(6);
    expect(pos.x).toBeGreaterThanOrEqual(6);
  });
});