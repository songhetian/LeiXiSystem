'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    const authed = checkAuth();
    if (!authed) {
      router.replace('/login');
    }
  }, [checkAuth, router]);

  if (!isAuthenticated) {
    return <div>加载中...</div>;
  }

  return <>{children}</>;
}
