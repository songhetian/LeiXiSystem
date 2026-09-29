import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';
import './arco-overrides.css';
import Providers from './providers';
import TitleSync from '@/components/TitleSync';
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
  // 不做 maximumScale / userScalable 限制：禁用缩放违反 WCAG 2.1 SC 1.4.4 (AA)。
  // 文本必须可放大至 200% 而不丢失内容；iOS 聚焦自动放大改由输入框 16px 字号解决（见 globals.css）。
  themeColor: '#2455D9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首帧防闪烁：解析本地主题，在 React 挂载前写入 html[data-theme] */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='lx_theme_mode';var m=localStorage.getItem(k);if(m!=='dark'&&m!=='light'&&m!=='system')m='system';var t=(m&&m!=='system')?m:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);if(t==='dark'){document.addEventListener('DOMContentLoaded',function(){document.body.classList.add('arco-theme-dark')})}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <TitleSync />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
