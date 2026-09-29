'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AppSider from './AppSider';
import AppHeader from './AppHeader';
import ProtectedRoute from './ProtectedRoute';
import ErrorBoundary from './ErrorBoundary';
import RouteProgress from './RouteProgress';
import CommandPalette from './CommandPalette';
import PageTabs from './PageTabs';
import KeepAliveHost from './KeepAliveHost';
import { useAuthStore } from '@/store/auth';
import { useTabsStore } from '@/store/tabs';
import { useSocket } from '@/hooks/use-socket';
import { useResponsive } from '@/hooks/use-responsive';

export interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  activeMenu?: string;
  onMenuClick?: (key: string) => void;
}

const MENU_ROUTES: Record<string, string> = {
  dashboard: '/',
  'broadcasts-public': '/broadcasts',
  'employee-list': '/employees',
  'employee-transactions': '/employees/transactions',
  'employee-tags': '/employees/tags',
  'employee-timeline': '/employees/timeline',
  'employee-change-logs': '/employees/change-logs',
  'performance-cycles': '/performance/cycles',
  'okr-objectives': '/okr',
  'attendance-punch': '/attendance/punch',
  'attendance-shifts': '/attendance/shifts',
  'attendance-schedules': '/attendance/schedules',
  'attendance-daily': '/attendance/daily',
  'attendance-monthly': '/attendance/monthly',
  'attendance-statistics': '/attendance/statistics',
  'attendance-vacation-balance': '/attendance/vacation/balance',
  'attendance-vacation-leave': '/attendance/vacation/leave',
  'attendance-vacation-type-settings': '/attendance/vacation/settings',
  'attendance-vacation-overtime': '/attendance/vacation/overtime',
  'attendance-vacation-audit': '/attendance/vacation/audit',
  'attendance-punch-makeup': '/attendance/punch-makeup',
  'attendance-devices': '/attendance/devices',
  'attendance-settings': '/attendance/settings',
  'approval-todo': '/approval/todo',
  'approval-approved': '/approval/approved',
  'approval-submissions': '/approval/submissions',
  'approval-settings': '/approval/settings',
  'approval-approvers': '/approval/approvers',
  'approval-role-workflow': '/approval/role-workflow',
  'payroll-runs': '/payroll/runs',
  'my-payslips': '/payroll/my-payslips',
  'my-reimbursement': '/expense/my',
  'expense-approval': '/expense/approval',
  'expense-settings': '/expense/settings',
  knowledge: '/knowledge',
  'knowledge-admin': '/knowledge/admin',
  notifications: '/notifications',
  'notifications-settings': '/notifications/settings',
  'system-departments': '/system/departments',
  'system-positions': '/system/positions',
  'system-broadcasts': '/system/broadcasts',
  'system-users': '/system/users',
  'system-roles': '/system/roles',
  'system-permissions': '/system/permissions',
  'system-logs': '/system/logs',
  settings: '/settings',
};

export default function AppLayout({
  children,
  title,
  activeMenu = 'dashboard',
  onMenuClick,
}: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const tabs = useTabsStore((s) => s.tabs);
  const alivePaths = useMemo(() => tabs.map((t) => t.path), [tabs]);
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const permissions = useMemo(() => user?.permissions ?? [], [user?.permissions]);
  const { isMobile } = useResponsive();
  const [siderVisible, setSiderVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useSocket();

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshUser]);

  const handleMenuClick = useCallback((key: string) => {
    const route = MENU_ROUTES[key];
    if (route) {
      router.push(route);
    }
    onMenuClick?.(key);
  }, [router, onMenuClick]);

  const handleMenuToggle = useCallback(() => {
    if (isMobile) {
      setSiderVisible((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  const closeSider = useCallback(() => {
    setSiderVisible(false);
  }, []);

  // 移动端抽屉：键盘用户无法点击遮罩关闭，补 Escape（WCAG SC 2.1.1 Keyboard）
  useEffect(() => {
    if (!isMobile || !siderVisible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSider();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobile, siderVisible, closeSider]);

  return (
    <ProtectedRoute>
      <RouteProgress />
      <CommandPalette />
      <div className="app-layout">
        {!isMobile && (
          <AppSider
            activeKey={activeMenu}
            onMenuClick={handleMenuClick}
            permissions={permissions}
            collapsed={collapsed}
          />
        )}
        {isMobile && (
          <>
            <AppSider
              activeKey={activeMenu}
              onMenuClick={handleMenuClick}
              permissions={permissions}
              isMobile={true}
              visible={siderVisible}
              onClose={closeSider}
            />
            {siderVisible && (
              // 纯装饰性遮罩：关闭操作已由 Escape 键与侧栏内按钮提供键盘通路，故对辅助技术隐藏
              <div
                className="drawer-mask"
                aria-hidden="true"
                onClick={closeSider}
              />
            )}
          </>
        )}
        <div className="app-main">
          <AppHeader title={title} isMobile={isMobile} collapsed={!isMobile && collapsed} onMenuToggle={handleMenuToggle} />
          <PageTabs />
          <main className="app-content" id="app-tabpanel" role="tabpanel" aria-label="页面内容">
            <ErrorBoundary>
              <KeepAliveHost activePath={pathname} alivePaths={alivePaths}>
                {children}
              </KeepAliveHost>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
