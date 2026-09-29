'use client';

import { useEffect } from 'react';
import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import { NextIntlClientProvider } from 'next-intl';
import zhMessages from '@/messages/zh.json';
import { useAuthStore } from '@/store/auth';
import { useThemeStore, watchSystemTheme } from '@/store/theme';
import { useArcoThemeTokens } from '@/lib/design-tokens';

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const initTheme = useThemeStore((s) => s.init);
  // Arco 主题色/圆角/字号从 globals.css 的 --lx-* token 运行时读取，避免两处各写一份色值
  const arcoTheme = useArcoThemeTokens();

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
          ...arcoTheme,
          wireframe: false,
        }}
      >
        {children}
      </ConfigProvider>
    </NextIntlClientProvider>
  );
}