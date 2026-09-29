'use client';

import { useMemo } from 'react';
import { settingsApi, type SystemInfoData, type SystemInfoResult } from '@/services/settings';
import { useCachedData } from '@/hooks/use-cached-data';

export interface SystemInfo {
  name: string;
  /** 页面可用的 Logo 地址（无 Logo 时为空字符串） */
  logoUrl: string;
}

const DEFAULT_NAME = '雷犀管理系统';
const DEFAULT_LOGO_URL = '';
/** 相对路径 Logo 的公开读取端点（免登录可读） */
const PUBLIC_LOGO_PATH = '/api/v1/public/system/logo';

/** 公开信息 → 页面模型：名称缺失回退默认值，Logo 相对路径映射到公开端点 */
function toSystemInfo(d?: SystemInfoData): SystemInfo {
  const logo = d?.logo?.trim() || '';
  return {
    name: d?.name?.trim() || DEFAULT_NAME,
    logoUrl: !logo ? DEFAULT_LOGO_URL : /^https?:\/\//.test(logo) ? logo : PUBLIC_LOGO_PATH,
  };
}

/**
 * 系统公开信息（系统名称 / Logo）：登录页、侧边栏共用。
 * - 经 useCachedData(SWR) 共享缓存，跨组件去重。
 * - 名称缺失时回退「雷犀管理系统」。
 * - logo 为相对路径(/uploads/...)时，走公开端点 /public/system/logo（免登录可读）；
 *   为完整 URL 时原样返回。
 */
export function useSystemInfo(): {
  info: SystemInfo;
  loading: boolean;
  revalidate: () => Promise<SystemInfo | null>;
} {
  const { data, loading, revalidate } = useCachedData<SystemInfoResult>(
    'system:public:info',
    () => settingsApi.info().catch(() => ({ code: 0, data: undefined }) as SystemInfoResult),
    { staleTime: 60_000 },
  );

  const s = data?.data;
  const info = useMemo<SystemInfo>(() => toSystemInfo(s), [s]);

  const revalidateInfo = useMemo(
    () => async (): Promise<SystemInfo | null> => {
      const res = await revalidate();
      if (!res || res.code !== 0) return null;
      return toSystemInfo(res.data);
    },
    [revalidate],
  );

  return { info, loading, revalidate: revalidateInfo };
}