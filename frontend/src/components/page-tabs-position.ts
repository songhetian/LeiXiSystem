export interface MenuAnchor {
  /** 页签左边缘（视口坐标） */
  left: number;
  /** 页签底边缘（视口坐标） */
  bottom: number;
}

export interface MenuViewport {
  width: number;
  height: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

/**
 * 页签右键 /「更多」菜单的视口内钳制定位。
 * 菜单锚定在页签正下方（距底边 4px），并在视口内上下/左右钳制，
 * 避免底部或右侧超长时菜单被截断或推出屏幕。
 */
export function clampMenuPosition(
  anchor: MenuAnchor,
  viewport: MenuViewport,
  menuSize: MenuSize,
  gap = 4,
  margin = 6,
): { x: number; y: number } {
  const x = Math.max(margin, Math.min(anchor.left, viewport.width - menuSize.width - margin));
  const y = Math.max(margin, Math.min(anchor.bottom + gap, viewport.height - menuSize.height - margin));
  return { x, y };
}