import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '雷犀客服管理系统',
  description: '考勤 · 算薪 · 员工管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
      </body>
    </html>
  );
}
