'use client';

import { useEffect } from 'react';
import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import { NextIntlClientProvider } from 'next-intl';
import zhMessages from '@/messages/zh.json';
import { useAuthStore } from '@/store/auth';
import { useThemeStore, watchSystemTheme } from '@/store/theme';

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    hydrate();
    initTheme();
    const unsubscribe = watchSystemTheme();
    return unsubscribe;
  }, [hydrate, initTheme]);

  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          primaryColor: '#2455D9',
          successColor: '#22c55e',
          dangerColor: '#ef4444',
          warningColor: '#f59e0b',
          infoColor: '#2455D9',
          borderRadius: 10,
          borderRadiusSM: 8,
          borderRadiusXS: 6,
          borderRadiusLG: 12,
          fontSize: 14,
          fontSizeSM: 12,
          fontSizeHeading3: 18,
          wireframe: false,
        }}
      >
        {children}
      </ConfigProvider>
    </NextIntlClientProvider>
  );
}