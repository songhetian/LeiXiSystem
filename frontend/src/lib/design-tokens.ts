'use client';

/**
 * 设计 token 的 JS 侧唯一读取口。
 *
 * 背景：设计 token 的唯一真值是 `src/app/globals.css` 的 `--lx-*` 变量，但 Arco 的
 * `ConfigProvider theme` 只能吃 JS 值。此前在 `providers.tsx` 里把
 * `primaryColor: '#2455D9'` 等 5 个色值再写一份字面量，导致「改 globals.css 的 token，
 * Arco 组件不跟着变」的双源问题。
 *
 * 这里在运行时从 `:root` 把值读回来，Arco 与 CSS 永远同源；SSR 阶段（读不到
 * computedStyle）以及 jsdom 测试环境（返回空串）回退到 `LIGHT_FALLBACK`。
 *
 * 主题切换（`data-theme` 变化）会触发重新读取，避免深色模式下 Arco 仍用浅色主色。
 */

import { useEffect, useState } from 'react';

export interface ArcoThemeTokens {
  primaryColor: string;
  successColor: string;
  dangerColor: string;
  warningColor: string;
  infoColor: string;
  borderRadius: number;
  borderRadiusSM: number;
  borderRadiusXS: number;
  borderRadiusLG: number;
  fontSize: number;
  fontSizeSM: number;
  fontSizeHeading3: number;
}

/** 仅用于 SSR / 测试环境的回退值（值取自 globals.css 的浅色主题 token，不构成第二真值来源） */
const LIGHT_FALLBACK: ArcoThemeTokens = {
  primaryColor: '#2455D9',
  successColor: '#22c55e',
  dangerColor: '#ef4444',
  warningColor: '#f59e0b',
  infoColor: '#2455D9',
  borderRadius: 10,
  borderRadiusSM: 8,
  borderRadiusXS: 6,
  borderRadiusLG: 12,
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeHeading3: 18,
};

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readPx(name: string, fallback: number): number {
  const raw = readVar(name, `${fallback}px`);
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readTheme(): ArcoThemeTokens {
  return {
    primaryColor: readVar('--lx-primary', LIGHT_FALLBACK.primaryColor),
    successColor: readVar('--lx-success', LIGHT_FALLBACK.successColor),
    dangerColor: readVar('--lx-danger', LIGHT_FALLBACK.dangerColor),
    warningColor: readVar('--lx-warning', LIGHT_FALLBACK.warningColor),
    infoColor: readVar('--lx-info', LIGHT_FALLBACK.infoColor),
    // Arco 的圆角阶与 --lx-radius-* 并非一一对应，取最接近的语义档
    borderRadius: readPx('--lx-radius-lg', LIGHT_FALLBACK.borderRadius),
    borderRadiusSM: readPx('--lx-radius-md', LIGHT_FALLBACK.borderRadiusSM),
    borderRadiusXS: readPx('--lx-radius-sm', LIGHT_FALLBACK.borderRadiusXS),
    borderRadiusLG: readPx('--lx-radius-xl', LIGHT_FALLBACK.borderRadiusLG),
    fontSize: readPx('--lx-font-md', LIGHT_FALLBACK.fontSize),
    fontSizeSM: readPx('--lx-font-xs', LIGHT_FALLBACK.fontSizeSM),
    fontSizeHeading3: readPx('--lx-font-lg', LIGHT_FALLBACK.fontSizeHeading3),
  };
}

/** 读取当前生效的 Arco 主题，并在 `data-theme` 变化时自动刷新 */
export function useArcoThemeTokens(): ArcoThemeTokens {
  const [tokens, setTokens] = useState<ArcoThemeTokens>(LIGHT_FALLBACK);

  useEffect(() => {
    setTokens(readTheme());
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => setTokens(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
