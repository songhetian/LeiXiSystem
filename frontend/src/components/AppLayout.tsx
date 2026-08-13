'use client';

import { Layout } from '@arco-design/web-react';
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

export default function AppLayout({
  children,
  title,
  activeMenu = 'dashboard',
  onMenuClick,
}: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSider activeKey={activeMenu} onMenuClick={onMenuClick} />
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
