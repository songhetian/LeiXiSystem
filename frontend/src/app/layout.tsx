import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';
import './arco-overrides.css';
import Providers from './providers';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '雷犀管理系统',
  description: '考勤 · 算薪 · 员工管理',
  applicationName: '雷犀管理系统',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '雷犀系统',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2455D9',
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
