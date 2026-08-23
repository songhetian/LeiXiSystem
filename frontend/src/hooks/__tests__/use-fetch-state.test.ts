import { renderHook, act } from '@testing-library/react';
import useFetchState from '@/hooks/use-fetch-state';

describe('useFetchState', () => {
  describe('初始状态', () => {
    it('初始 data 为 null，loading 为 false，error 为 null', () => {
      const { result } = renderHook(() => useFetchState<string>());

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('支持自定义初始值', () => {
      const { result } = renderHook(() => useFetchState<number>(42));

      expect(result.current.data).toBe(42);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('run() 成功', () => {
    it('成功时设置 data，清除 error，loading 变为 false', async () => {
      const { result } = renderHook(() => useFetchState<string>());

      await act(async () => {
        await result.current.run(() => Promise.resolve('hello'));
      });

      expect(result.current.data).toBe('hello');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('run 返回值就是 data', async () => {
      const { result } = renderHook(() => useFetchState<number>());

      let returned: number | null = -1;
      await act(async () => {
        returned = await result.current.run(() => Promise.resolve(99));
      });

      expect(returned).toBe(99);
      expect(result.current.data).toBe(99);
    });

    it('fetcher 返回 undefined 时 data 为 null', async () => {
      const { result } = renderHook(() => useFetchState<string>());

      await act(async () => {
        await result.current.run(() => Promise.resolve(undefined));
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('run() 失败', () => {
    it('失败时设置 error，清除 loading，data 保持旧值', async () => {
      const { result } = renderHook(() => useFetchState<string>('old'));

      await act(async () => {
        await result.current.run(() => Promise.reject(new Error('网络错误')));
      });

      expect(result.current.error).toBe('网络错误');
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe('old');
    });

    it('Error 无 message 时用默认文案', async () => {
      const { result } = renderHook(() => useFetchState<string>());

      await act(async () => {
        await result.current.run(() => Promise.reject(new Error('')));
      });

      expect(result.current.error).toBe('加载失败');
    });

    it('失败时 run 返回 null', async () => {
      const { result } = renderHook(() => useFetchState<string>());

      let returned: string | null = 'not-null';
      await act(async () => {
        returned = await result.current.run(() => Promise.reject(new Error('fail')));
      });

      expect(returned).toBeNull();
    });
  });

  describe('setData / setError / setLoading', () => {
    it('setData 更新 data 并清除 error', () => {
      const { result } = renderHook(() => useFetchState<string>());

      act(() => result.current.setError('旧错误'));
      expect(result.current.error).toBe('旧错误');

      act(() => result.current.setData('新数据'));
      expect(result.current.data).toBe('新数据');
      expect(result.current.error).toBeNull();
    });

    it('setError 单独更新 error', () => {
      const { result } = renderHook(() => useFetchState<string>('data'));

      act(() => result.current.setError('出错了'));
      expect(result.current.error).toBe('出错了');
      expect(result.current.data).toBe('data');
    });

    it('setLoading 单独更新 loading', () => {
      const { result } = renderHook(() => useFetchState<string>());

      act(() => result.current.setLoading(true));
      expect(result.current.loading).toBe(true);

      act(() => result.current.setLoading(false));
      expect(result.current.loading).toBe(false);
    });
  });

  describe('reset()', () => {
    it('重置到初始状态', () => {
      const { result } = renderHook(() => useFetchState<string>('initial'));

      act(() => result.current.setData('changed'));
      act(() => result.current.setError('some error'));
      act(() => result.current.setLoading(true));

      act(() => result.current.reset());

      expect(result.current.data).toBe('initial');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('连续 run', () => {
    it('第二次 run 会清除之前的 error', async () => {
      const { result } = renderHook(() => useFetchState<string>());

      await act(async () => {
        await result.current.run(() => Promise.reject(new Error('第一次失败')));
      });
      expect(result.current.error).toBe('第一次失败');

      await act(async () => {
        await result.current.run(() => Promise.resolve('成功了'));
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe('成功了');
    });
  });
});
