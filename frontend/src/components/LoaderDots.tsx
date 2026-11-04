'use client';

import { useEffect, useState } from 'react';

/**
 * 波点加载指示器 —— 全站统一加载态。
 *
 * 与 DataState 的 loading 分支同款视觉（.lx-loader-dots），用于不适合套
 * DataState 容器的局部加载（下拉面板、路由切换、抽屉内嵌等），替代 Arco Spin。
 *
 * 无障碍：
 * - 视觉文案 aria-hidden，真正的播报由延迟 400ms 才挂载的 sr-only 文案承担：
 *   快速请求（<400ms）不会反复打断读屏用户，慢请求仍满足 WCAG SC 4.1.3。
 * - aria-busy 标记当前区域仍在加载。
 */
export default function LoaderDots({ text = '加载中' }: { text?: string }) {
  // 延迟播报：翻页/切页签时列表会连续出现加载态，立即播报会变成噪音
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnnounce(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" aria-busy="true" className="data-state-loading">
      <div className="lx-loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="data-state-loading-text" aria-hidden="true">
        {text}
      </span>
      {announce ? <span className="sr-only">{text}</span> : null}
    </div>
  );
}
