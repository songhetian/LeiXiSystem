'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopTimer: ReturnType<typeof setTimeout>;
    let raf: number;
    // 到达即停：原先这条链没有任何终止条件，进度条隐藏后仍会每 200ms 触发一次
    // setState，一直空转到下一次路由切换 —— 属于常驻主线程开销。
    let stopped = false;
    let current = 0;

    setVisible(true);
    setProgress(0);

    const animate = () => {
      if (stopped) return;
      current += Math.random() * 15 + 5;
      if (current >= 90) current = 90;
      setProgress(current);
      timer = setTimeout(() => {
        raf = requestAnimationFrame(animate);
      }, 200);
    };

    raf = requestAnimationFrame(animate);
    // 下方 effect 会在 100ms 时补到 100%、300ms 内隐藏，这里留出余量后停链
    stopTimer = setTimeout(() => {
      stopped = true;
    }, 600);

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(stopTimer);
      cancelAnimationFrame(raf);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setVisible(false), 200);
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--lx-primary, #2455D9)',
          transition: 'width 0.2s ease, opacity 0.2s ease',
          opacity: visible ? 1 : 0,
          boxShadow: '0 0 6px var(--lx-primary-weak)',
        }}
      />
    </div>
  );
}

export default function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  );
}
