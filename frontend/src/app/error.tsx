'use client';

import { useEffect } from 'react';
import { Button } from '@arco-design/web-react';

/**
 * 路由级错误兜底：
 * 运行时渲染异常（含第三方组件抛错）由 ErrorBoundary 捕获后仍有漏网场景，
 * 这里提供「可重试」的出口，而不是让用户停在白屏。
 */
export default function RootRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 服务端只看到 digest，客户端保留完整信息便于排查
    console.error('[route-error]', error);
  }, [error]);

  return (
    <div className="lx-boot-screen min-h-dvh" role="alert" aria-live="assertive">
      <div className="lx-boot-name">页面加载失败</div>
      <p className="lx-boot-hint">{error.message || '请稍后重试'}</p>
      <Button type="primary" onClick={reset}>
        重新加载
      </Button>
    </div>
  );
}
