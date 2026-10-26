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
import { menuPathFor } from '@/config/navigation';

export interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  activeMenu?: string;
  onMenuClick?: (key: string) => void;
}

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
  // 当前激活页签在 tabs 中的下标：用于把 main[role=tabpanel] 关联到对应 tab（WCAG SC 4.1.2）。
  // 与 PageTabs 的 `id={`page-tab-${index}`}` 对齐。
  const activeTabIndex = useMemo(
    () => tabs.findIndex((t) => t.path === pathname),
    [tabs, pathname],
  );

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
    const route = menuPathFor(key);
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
        {/* 跳过块：键盘用户 Tab 首站即可越过侧栏/页签直达主内容（WCAG SC 2.4.1, A） */}
        <a href="#app-tabpanel" className="lx-skip-link">
          跳转到主内容
        </a>
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
          <main
            className="app-content"
            id="app-tabpanel"
            role="tabpanel"
            tabIndex={-1}
            aria-labelledby={activeTabIndex >= 0 ? `page-tab-${activeTabIndex}` : undefined}
            aria-label="页面内容"
          >
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
