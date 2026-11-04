'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@arco-design/web-react';
import { useAuthStore } from '@/store/auth';
import { useSystemInfo } from '@/hooks/use-system-info';
import LoaderDots from '@/components/LoaderDots';

/** 路由前缀到所需权限码的映射 */
const ROUTE_PERMISSIONS: Record<string, string> = {
  // 一级模块：只需「查看」权限
  '/employees': 'employee:view',
  '/attendance': 'attendance:view',
  '/approval': 'approval:todo:view',
  '/payroll': 'payroll:view',
  '/expense': 'reimbursement:view',
  '/knowledge': 'knowledge:view',
  '/reports': 'reports:view',
  '/system': 'system:user:view',
  '/settings': 'system:setting:view',
  // 深层管理页：需要各自的「管理」权限，避免仅持父级 view 权限即可越权进入
  '/employees/timeline': 'transfer:view',
  '/attendance/vacation/settings': 'vacation:manage',
  '/attendance/devices': 'attendance:manage',
  '/attendance/settings': 'attendance:manage',
  '/attendance/exception-rules': 'attendance:exception:view',
  '/attendance/deduction-rules': 'attendance:deduction:view',
  '/attendance/locations': 'employee:view',
  '/approval/settings': 'approval:workflow:manage',
  '/approval/role-workflow': 'approval:workflow:manage',
  '/approval/approvers': 'approval:manage',
  '/expense/settings': 'reimbursement:manage',
  '/expense/approval': 'reimbursement:approve',
  '/knowledge/admin': 'knowledge:manage',
  '/system/roles': 'system:role:manage',
  // 权限管理为纯只读页，与 GET /system/permissions 的 system:role:view 同锁
  '/system/permissions': 'system:role:view',
  '/system/departments': 'department:manage',
  '/system/positions': 'position:manage',
  '/system/broadcasts': 'system:broadcast:manage',
  '/system/logs': 'system:log:view',
  '/notifications/settings': 'system:notification:settings',
  '/okr': 'okr:view',
  '/helpdesk': 'helpdesk:view',
  '/performance/cycles': 'performance:view',
  '/finance/budgets': 'finance:budget:view',
  '/finance/expense-standards': 'finance:expense-standard:view',
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
  // 启动态先取系统品牌信息：既让过渡画面不是一块空白，也顺便把公开信息预热进共享缓存
  const { info: systemInfo } = useSystemInfo();

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
    // min-h-dvh（动态视口高度）而非 h-screen(=100vh)：移动端地址栏会占用 100vh 高度，
    // 导致内容被推出视口（WCAG SC 1.4.10 Reflow）
    // 品牌化启动态：认证校验期间保留系统名称/标识，避免「白屏 → 布局突现」的跳变
    <div className="lx-boot-screen min-h-dvh">
      <div className="lx-boot-brand">
        {systemInfo.logoUrl ? (
          <img src={systemInfo.logoUrl} alt="" className="lx-boot-logo" />
        ) : (
          <div className="lx-boot-mark" aria-hidden="true">
            {(systemInfo.name || '雷').charAt(0)}
          </div>
        )}
        <div className="lx-boot-name">{systemInfo.name}</div>
      </div>
      <LoaderDots text="正在进入工作台" />
      <p className="lx-boot-hint">正在校验登录状态与权限…</p>
    </div>
  );

  const forbiddenScreen = (
    <div className="flex flex-col justify-center items-center min-h-dvh gap-4">
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
