'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Spin, Button } from '@arco-design/web-react';
import { useAuthStore } from '@/store/auth';

/** 路由前缀到所需权限码的映射 */
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/employees': 'employee:view',
  '/attendance': 'attendance:view',
  '/approval': 'approval:todo:view',
  '/payroll': 'payroll:view',
  '/expense': 'reimbursement:view',
  '/knowledge': 'knowledge:view',
  '/reports': 'reports:view',
  '/system': 'system:user:view',
  '/settings': 'system:setting:view',
};

/** 根据当前路径匹配所需权限码（最长前缀匹配） */
function getRequiredPermission(pathname: string): string | undefined {
  const matchedRoutes = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length);
  return matchedRoutes.length > 0 ? ROUTE_PERMISSIONS[matchedRoutes[0]] : undefined;
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, checkAuth, user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    checkAuth().then((authed) => {
      if (cancelled) return;
      if (!authed) {
        router.replace('/login');
      }
    });
    return () => { cancelled = true; };
  }, [checkAuth, router]);

  const requiredPermission = getRequiredPermission(pathname || '');
  const permissions = user?.permissions ?? [];
  const hasPermission = !requiredPermission || permissions.includes(requiredPermission);

  const loadingScreen = (
    <div className="flex justify-center items-center h-screen gap-2">
      <Spin size={40} />
      <span className="text-text-3 text-sm">加载中...</span>
    </div>
  );

  const forbiddenScreen = (
    <div className="flex flex-col justify-center items-center h-screen gap-4">
      <div className="text-[72px] font-medium text-text-3 leading-none">403</div>
      <div className="text-base text-text-2">抱歉，您没有权限访问此页面</div>
      <div className="text-sm text-text-3 -mt-2">
        如需访问，请联系管理员开通权限
      </div>
      <Button type="primary" onClick={() => router.push('/')} className="mt-4">
        返回首页
      </Button>
    </div>
  );

  if (!isAuthenticated) {
    return loadingScreen;
  }

  if (!hasPermission) {
    return forbiddenScreen;
  }

  return <>{children}</>;
}
