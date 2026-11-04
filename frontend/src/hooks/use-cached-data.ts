'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';

// ========== 模块级共享缓存（跨组件去重 + 共享） ==========
// 与 useFetchState 不同：SWR 语义。多个组件用同一 cacheKey 订阅同一份数据，
// staleTime 内不重复请求、并发请求去重合并为一次，避免来回切页/多个下拉反复拉取。

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const moduleCache = new Map<string, CacheEntry<unknown>>();

// ========== 缓存容量与过期控制 ==========
// EmployeeSelect 等组件会把搜索词编进 cacheKey，长会话下条目只增不减；
// 用 LRU 上限兜底，避免内存无界增长。写入时顺手清理超过 TTL 的陈旧条目。
const MAX_CACHE_SIZE = 200;
const CACHE_TTL = 5 * 60_000;

/** 读取缓存并刷新 LRU 顺序（命中即移到末尾） */
function readCache<T>(key: string): CacheEntry<T> | undefined {
  const entry = moduleCache.get(key);
  if (!entry) return undefined;
  moduleCache.delete(key);
  moduleCache.set(key, entry);
  return entry as CacheEntry<T>;
}

/** 写入缓存：先清理过期条目，再按 LRU 淘汰最久未使用的 key */
function writeCache(key: string, entry: CacheEntry<unknown>) {
  const now = Date.now();
  for (const [k, v] of moduleCache) {
    if (k !== key && now - v.timestamp > CACHE_TTL) moduleCache.delete(k);
  }
  if (moduleCache.has(key)) moduleCache.delete(key);
  moduleCache.set(key, entry);
  while (moduleCache.size > MAX_CACHE_SIZE) {
    const oldest = moduleCache.keys().next().value;
    if (oldest === undefined) break;
    moduleCache.delete(oldest);
  }
}

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
  /** 切换 cacheKey 后的首帧为 undefined，避免短暂展示上一个 key 的旧数据 */
  data: T | null | undefined;
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

  // state 同时记录「这份 data 属于哪个 cacheKey」：key 一变，首帧就不能再渲染旧数据
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    loading: boolean;
    error: string | null;
  }>(() => {
    const cached = readCache<T>(cacheKey);
    if (cached) {
      return { key: cacheKey, data: cached.data, loading: false, error: null };
    }
    // 无缓存时首帧就是 loading：mounted effect 里马上会发请求，若首帧
    // 返回 loading=false + data=null，页面会先闪一下「暂无数据」再切骨架屏，
    // 用户看到的是「刚说有数据、又说没有、又变成加载中」。
    return { key: cacheKey, data: null, loading: true, error: null };
  });

  // 组件卸载守卫：在途请求返回时不再对已卸载实例 setState（模块级缓存仍照常
  // 写入，供后续订阅复用）。否则 React 会对已卸载组件排队更新，测试中表现为
  // 跨用例 act 告警、真实运行中属无效更新。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // fetcher 经 ref 透传：inline 箭头函数每次渲染都是新引用，若直接进依赖会让
  // load（连带 revalidate、focus/visibilitychange 监听）每渲染漂移；
  // 走 ref 后 load 依赖只剩 cacheKey / staleTime，身份稳定。
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    (force = false) => {
      const myKey = cacheKey;
      const cached = readCache<T>(cacheKey);
      const fresh = cached && Date.now() - cached.timestamp < staleTime;

      // 命中新鲜缓存：直接返回，不发请求
      if (cached && fresh && !force) {
        setState({ key: cacheKey, data: cached.data, loading: false, error: null });
        return Promise.resolve(cached.data);
      }

      // 有旧数据（stale）时先展示旧数据、后台刷新（SWR）；无缓存则清空，避免串页残留
      setState((s) => ({
        ...s,
        key: myKey,
        data: cached ? cached.data : null,
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
        pending = fetcherRef.current();
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
          // 无论是否为活跃 key / 实例是否卸载，都写入缓存供后续订阅复用
          writeCache(cacheKey, { data, timestamp: Date.now() });
          // 已切走（非当前活跃 key）或实例已卸载时不再 setState
          if (activeKeyRef.current !== myKey || !mountedRef.current) return data;
          setState({ key: myKey, data, loading: false, error: null });
          return data;
        })
        .catch((e) => {
          if (latestRequestId.get(cacheKey) !== requestId) return null;
          if (activeKeyRef.current !== myKey || !mountedRef.current) return null;
          // 新 key 失败时不能沿用旧 key 的数据，只有同一 key 才保留
          setState((s) => ({
            key: myKey,
            data: s.key === myKey ? s.data : null,
            loading: false,
            error: getApiErrorMessage(e, '加载失败'),
          }));
          return null;
        });
    },
    [cacheKey, staleTime],
  );

  // 初次订阅：先标记当前活跃 key，再发起加载
  useEffect(() => {
    activeKeyRef.current = cacheKey;
    void load();
    // fetcher 闭包变化不重新加载，仅首次订阅触发，避免造成重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // 窗口聚焦 / 页签回前台时自动刷新（可在 option 中关闭）。
  // visibilitychange 在切走（hidden）时同样触发，必须判 visibilityState，
  // 否则用户离开页面反而会多打一轮请求。
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
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

  // 派生判断而非同步 setState：cacheKey 变化后的首帧直接视为「新 key 加载中」，
  // 不渲染上一个 key 的 data；随后 effect 里 load() 会把 state.key 对齐并恢复。
  const keyMatched = state.key === cacheKey;
  return {
    data: keyMatched ? state.data : undefined,
    loading: keyMatched ? state.loading : true,
    error: keyMatched ? state.error : null,
    revalidate,
  };
}