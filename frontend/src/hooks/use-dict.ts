'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache: Record<string, CacheEntry<any>> = {};

interface UseDictOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
}

export function useDict<T>({ key, fetcher, ttl = CACHE_TTL }: UseDictOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  // 卸载守卫：在途请求返回时不再对已卸载实例 setState（模块级缓存仍照常写入）。
  // 否则 React 18 会对已卸载组件排队更新，测试中表现为跨用例 act 告警
  // （与 use-cached-data 同款处理）。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (force = false) => {
    const cached = memoryCache[key];
    if (!force && cached && Date.now() - cached.timestamp < ttl) {
      if (mountedRef.current) setData(cached.data);
      return cached.data;
    }

    if (mountedRef.current) setLoading(true);
    try {
      const result = await fetcher();
      memoryCache[key] = { data: result, timestamp: Date.now() };
      if (mountedRef.current) setData(result);
      return result;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [key, fetcher, ttl]);

  const refresh = useCallback(() => {
    return load(true);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, refresh };
}

export function clearDictCache(key?: string) {
  if (key) {
    delete memoryCache[key];
  } else {
    Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
  }
}

export default useDict;
