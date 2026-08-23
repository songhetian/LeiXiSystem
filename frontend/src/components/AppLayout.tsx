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
  'employee-list': '/employees',
  'employee-transactions': '/employees/transactions',
  'employee-timeline': '/employees/timeline',
  'attendance-punch': '/attendance/punch',
  'attendance-shifts': '/attendance/shifts',
  'attendance-schedules': '/attendance/schedules',
  'attendance-daily': '/attendance/daily',
  'attendance-monthly': '/attendance/monthly',
  'attendance-vacation-balance': '/attendance/vacation/balance',
  'attendance-vacation-leave': '/attendance/vacation/leave',
  'attendance-vacation-overtime': '/attendance/vacation/overtime',
  'attendance-punch-makeup': '/attendance/punch-makeup',
  'attendance-devices': '/attendance/devices',
  'attendance-settings': '/attendance/settings',
  'approval-todo': '/approval/todo',
  'approval-approved': '/approval/approved',
  'approval-submissions': '/approval/submissions',
  'approval-settings': '/approval/settings',
  'payroll-runs': '/payroll/runs',
  'my-payslips': '/payroll/my-payslips',
  'my-reimbursement': '/expense/my',
  'expense-approval': '/expense/approval',
  knowledge: '/knowledge',
  'knowledge-admin': '/knowledge/admin',
  notifications: '/notifications',
  'system-departments': '/system/departments',
  'system-broadcasts': '/system/broadcasts',
  'system-users': '/system/users',
  'system-roles': '/system/roles',
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
              <div
                className="drawer-mask"
                onClick={closeSider}
              />
            )}
          </>
        )}
        <div className="app-main">
          <AppHeader title={title} isMobile={isMobile} collapsed={!isMobile && collapsed} onMenuToggle={handleMenuToggle} />
          {!isMobile && <PageTabs />}
          <main className="app-content">
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
