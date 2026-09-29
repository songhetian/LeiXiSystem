'use client';

import { useEffect } from 'react';
import { useSystemInfo } from '@/hooks/use-system-info';

/**
 * 浏览器标签页标题与系统设置联动：统一显示为「{系统名称}」。
 * 名称由 useSystemInfo 兜底（缺失时为「雷犀管理系统」），故此处不会再为空。
 */
export default function TitleSync() {
  const { info } = useSystemInfo();

  useEffect(() => {
    document.title = info.name;
  }, [info.name]);

  return null;
}