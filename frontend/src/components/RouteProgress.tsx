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
    let raf: number;
    let current = 0;

    setVisible(true);
    setProgress(0);

    const animate = () => {
      current += Math.random() * 15 + 5;
      if (current >= 90) current = 90;
      setProgress(current);
      timer = setTimeout(() => {
        raf = requestAnimationFrame(animate);
      }, 200);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      clearTimeout(timer);
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
          boxShadow: '0 0 6px rgba(36, 85, 217, 0.5)',
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
