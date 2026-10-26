import { useState, useCallback, useRef, useEffect } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseFetchStateResult<T> extends FetchState<T> {
  setData: (data: T | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  run: (fetcher: () => Promise<T | null | undefined>) => Promise<T | null>;
  reset: () => void;
}

export function useFetchState<T>(initialData: T | null = null): UseFetchStateResult<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  // 组件卸载后标记为 false，避免在途请求返回时对已卸载组件触发 setState
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // run 调用序号：快速连续触发（如快速翻页/切换筛选）时只有最新一次
  // 允许写状态，迟到的旧响应直接丢弃，否则会把新结果覆盖回旧数据
  const seqRef = useRef(0);

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data, error: null }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const run = useCallback(async (fetcher: () => Promise<T | null | undefined>): Promise<T | null> => {
    const seq = ++seqRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetcher();
      const data = result ?? null;
      if (mountedRef.current && seq === seqRef.current) {
        setState({ data, loading: false, error: null });
      }
      return data;
    } catch (e) {
      if (mountedRef.current && seq === seqRef.current) {
        setState((prev) => ({ ...prev, loading: false, error: getApiErrorMessage(e, '加载失败') }));
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: initialData, loading: false, error: null });
  }, [initialData]);

  return {
    ...state,
    setData,
    setError,
    setLoading,
    run,
    reset,
  };
}

export default useFetchState;
