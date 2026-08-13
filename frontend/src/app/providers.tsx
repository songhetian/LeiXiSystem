'use client';

import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ConfigProvider locale={zhCN}>{children}</ConfigProvider>;
}
