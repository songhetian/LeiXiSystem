'use client';

import { Layout } from '@arco-design/web-react';
import { useRouter } from 'next/navigation';
import AppSider from './AppSider';
import AppHeader from './AppHeader';
import ProtectedRoute from './ProtectedRoute';

const Content = Layout.Content;

export interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  activeMenu?: string;
  onMenuClick?: (key: string) => void;
}

const MENU_ROUTES: Record<string, string> = {
  dashboard: '/',
  settings: '/settings',
};

export default function AppLayout({
  children,
  title,
  activeMenu = 'dashboard',
  onMenuClick,
}: AppLayoutProps) {
  const router = useRouter();

  const handleMenuClick = (key: string) => {
    const route = MENU_ROUTES[key];
    if (route) {
      router.push(route);
    }
    onMenuClick?.(key);
  };

  return (
    <ProtectedRoute>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSider activeKey={activeMenu} onMenuClick={handleMenuClick} />
        <Layout>
          <AppHeader title={title} />
          <Content style={styles.content}>{children}</Content>
        </Layout>
      </Layout>
    </ProtectedRoute>
  );
}

const styles = {
  content: {
    padding: 24,
    background: '#f5f6f8',
    overflow: 'auto',
  } as React.CSSProperties,
};
