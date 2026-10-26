'use client';

import { usePathname } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { menuKeyFor, tabTitleFor } from '@/config/navigation';

/**
 * 仪表盘外壳：activeMenu（侧栏高亮）与标题均从 config/navigation 派生，
 * 新增页面只需在 NAV_TREE 登记一处。
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const activeMenu = menuKeyFor(pathname) || 'dashboard';
  const title = tabTitleFor(pathname);

  return (
    <AppLayout title={title} activeMenu={activeMenu}>
      {children}
    </AppLayout>
  );
}
