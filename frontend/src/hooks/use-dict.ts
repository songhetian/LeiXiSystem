'use client';

import { useState, useEffect, useCallback } from 'react';

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

  const load = useCallback(async (force = false) => {
    const cached = memoryCache[key];
    if (!force && cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data);
      return cached.data;
    }

    setLoading(true);
    try {
      const result = await fetcher();
      memoryCache[key] = { data: result, timestamp: Date.now() };
      setData(result);
      return result;
    } finally {
      setLoading(false);
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
