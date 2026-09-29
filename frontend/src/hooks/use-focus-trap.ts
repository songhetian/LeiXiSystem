'use client';

import { useEffect, useRef } from 'react';

/** 可聚焦元素选择器（与浏览器 Tab 顺序基本一致；不做可见性过滤，jsdom 下 offsetParent 恒为 null） */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * 给「手写浮层」用的焦点陷阱。
 *
 * Arco 的 Modal / Drawer 自带这套行为，但 CommandPalette 这类自绘弹层没有：
 * - 打开后 Tab 会跑到浮层背后的页面上，键盘用户直接"走丢"（WCAG 2.4.3 焦点顺序）；
 * - 关闭后焦点停在被移除的节点上，回不到触发按钮（WCAG 2.4.3 / 2.1.2 无键盘陷阱）。
 *
 * 用法：把返回的 ref 挂到浮层容器上，`active` 传浮层的开关状态。
 * 容器内没有任何可聚焦元素时，退回把焦点给容器本身（自动补 tabindex="-1"）。
 */
export default function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // 记下打开前的焦点位置，关闭时还回去
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initial = getFocusable(container)[0];
    if (initial) {
      initial.focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = getFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      // 焦点已不在容器内（刚打开、或被外部抢走）→ 拉回首个元素
      if (!current || !container.contains(current)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      const restore = restoreRef.current;
      restoreRef.current = null;
      // 目标可能已随重渲染移除，先确认仍在文档内
      if (restore && document.contains(restore)) {
        restore.focus();
      }
    };
  }, [active]);

  return containerRef;
}
