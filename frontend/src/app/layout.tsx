import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';
import Providers from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '雷犀客服管理系统',
  description: '考勤 · 算薪 · 员工管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
