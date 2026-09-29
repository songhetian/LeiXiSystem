'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ========== 模块级共享缓存（跨组件去重 + 共享） ==========
// 与 useFetchState 不同：SWR 语义。多个组件用同一 cacheKey 订阅同一份数据，
// staleTime 内不重复请求、并发请求去重合并为一次，避免来回切页/多个下拉反复拉取。

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const moduleCache = new Map<string, CacheEntry<unknown>>();
// 在途请求：同 key 复用（去重）。记录请求序号，避免迟到返回的旧请求覆盖新请求结果。
const inflight = new Map<string, { promise: Promise<unknown>; id: number }>();
// 每个 key 最新一次请求的序号：只有最新请求才允许写缓存 / 写状态
const latestRequestId = new Map<string, number>();
let requestCounter = 0;

/** 清空缓存（测试 / 登出时调用） */
export function clearDataCache() {
  moduleCache.clear();
  inflight.clear();
  latestRequestId.clear();
}

export interface UseCachedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 强制重新请求（绕过 staleTime 与缓存）并更新数据 */
  revalidate: () => Promise<T | null>;
}

interface UseCachedDataOptions {
  /** 数据新鲜期（ms）。默认 60s；该时间段内重新订阅直接复用缓存而不请求 */
  staleTime?: number;
  /** 页面重新聚焦时自动重新请求，保证数据新鲜（默认 true） */
  revalidateOnFocus?: boolean;
}

/**
 * SWR 风格的共享数据 Hook。
 * - 相同 cacheKey 的多个调用共享同一份内存缓存，请求去重、合并。
 * - staleTime 内重新订阅（如切回页签）直接返回缓存，不触发网络请求。
 * - revalidate() 手动强制刷新；请求失败时保留上次数据并记录 error。
 */
export function useCachedData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions = {},
): UseCachedDataResult<T> {
  const { staleTime = 60_000, revalidateOnFocus = true } = options;

  // 当前活跃的 cacheKey：用于丢弃已切走后的旧请求结果，避免竞态覆盖新 key 数据
  const activeKeyRef = useRef(cacheKey);

  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>(
    () => {
      const cached = moduleCache.get(cacheKey);
      if (cached) {
        return { data: cached.data as T, loading: false, error: null };
      }
      return { data: null, loading: false, error: null };
    },
  );

  const load = useCallback(
    (force = false) => {
      const myKey = cacheKey;
      const cached = moduleCache.get(cacheKey);
      const fresh = cached && Date.now() - cached.timestamp < staleTime;

      // 命中新鲜缓存：直接返回，不发请求
      if (cached && fresh && !force) {
        setState({ data: cached.data as T, loading: false, error: null });
        return Promise.resolve(cached.data as T);
      }

      // 有旧数据（stale）时先展示旧数据、后台刷新（SWR）；无缓存则清空，避免串页残留
      setState((s) => ({
        ...s,
        data: cached ? (cached.data as T) : null,
        loading: true,
        error: null,
      }));

      // 并发去重：非强制刷新时，同 key 已在途则复用同一个 Promise；
      // 强制刷新（revalidate）必须发起新请求，否则会拿到变更前的旧数据。
      const existing = inflight.get(cacheKey) as
        | { promise: Promise<T>; id: number }
        | undefined;

      let requestId: number;
      let pending: Promise<T>;
      if (existing && !force) {
        requestId = existing.id;
        pending = existing.promise;
      } else {
        requestId = ++requestCounter;
        latestRequestId.set(cacheKey, requestId);
        pending = fetcher();
        inflight.set(cacheKey, { promise: pending, id: requestId });
        // 仅当在途表里仍是自己时才清理，避免把后续新请求的条目误删
        pending
          .finally(() => {
            if (inflight.get(cacheKey)?.id === requestId) inflight.delete(cacheKey);
          })
          .catch(() => {});
      }

      return pending
        .then((data) => {
          // 已被更新的请求（同 key 后续 revalidate）取代时丢弃结果，防止旧数据覆盖新数据
          if (latestRequestId.get(cacheKey) !== requestId) return data;
          // 无论是否为活跃 key，都写入缓存供后续订阅复用
          moduleCache.set(cacheKey, { data, timestamp: Date.now() });
          // 已切走（非当前活跃 key）时不再 setState，防止旧数据覆盖新 key
          if (activeKeyRef.current !== myKey) return data;
          setState({ data, loading: false, error: null });
          return data;
        })
        .catch((e: any) => {
          if (latestRequestId.get(cacheKey) !== requestId) return null;
          if (activeKeyRef.current !== myKey) return null;
          setState((s) => ({ ...s, loading: false, error: e?.message || '加载失败' }));
          return null;
        });
    },
    [cacheKey, fetcher, staleTime],
  );

  // 初次订阅：先标记当前活跃 key，再发起加载
  useEffect(() => {
    activeKeyRef.current = cacheKey;
    void load();
    // fetcher 闭包变化不重新加载，仅首次订阅触发，避免造成重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // 窗口聚焦时自动刷新（可在 option 中关闭）
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const onFocus = () => {
      void load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load, revalidateOnFocus]);

  const revalidate = useCallback(() => load(true), [load]);

  return { data: state.data, loading: state.loading, error: state.error, revalidate };
}