import '@testing-library/jest-dom';
import { useState } from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { useCachedData, clearDataCache } from '@/hooks/use-cached-data';

// ========== 探针组件（把 Hook 输出暴露到 DOM，便于断言） ==========
function Probe({ cacheKey, fetcher, label, staleTime }: any) {
  const { data, loading, error, revalidate } = useCachedData(cacheKey, fetcher, { staleTime });
  return (
    <div>
      <span data-testid={`${label}-data`}>{data ? JSON.stringify(data) : 'null'}</span>
      <span data-testid={`${label}-loading`}>{String(loading)}</span>
      <span data-testid={`${label}-error`}>{error || ''}</span>
      <button data-testid={`${label}-rv`} onClick={() => revalidate()}>revalidate</button>
    </div>
  );
}

const fetcher = jest.fn();

describe('useCachedData（SWR 语义：共享缓存 / 去重 / 失效）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
  });

  it('挂载后发起一次请求并暴露 data', async () => {
    fetcher.mockResolvedValue({ list: [1, 2, 3] });
    render(<Probe cacheKey="k1" fetcher={fetcher} label="a" />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('{"list":[1,2,3]}');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('同 key 多实例共享缓存：只发一次请求', async () => {
    fetcher.mockResolvedValue('shared');
    render(
      <>
        <Probe cacheKey="same" fetcher={fetcher} label="a" />
        <Probe cacheKey="same" fetcher={fetcher} label="b" />
      </>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"shared"');
      expect(screen.getByTestId('b-data')).toHaveTextContent('"shared"');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('staleTime 内重新挂载不再请求（命中缓存）', async () => {
    fetcher.mockResolvedValue('fresh-data');
    const { unmount } = render(<Probe cacheKey="k2" fetcher={fetcher} label="a" staleTime={5000} />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"fresh-data"');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    unmount();
    fetcher.mockClear(); // 新挂载后不应再有请求
    render(<Probe cacheKey="k2" fetcher={fetcher} label="b" staleTime={5000} />);
    await waitFor(() => {
      expect(screen.getByTestId('b-data')).toHaveTextContent('"fresh-data"');
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('超过 staleTime 后重新挂载会重新请求', async () => {
    fetcher.mockResolvedValue('old');
    const { unmount } = render(<Probe cacheKey="k3" fetcher={fetcher} label="a" staleTime={0} />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"old"');
    });
    unmount();

    fetcher.mockResolvedValue('new');
    render(<Probe cacheKey="k3" fetcher={fetcher} label="b" staleTime={0} />);
    await waitFor(() => {
      expect(screen.getByTestId('b-data')).toHaveTextContent('"new"');
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('revalidate() 强制重新请求并更新数据', async () => {
    fetcher.mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    render(<Probe cacheKey="k4" fetcher={fetcher} label="a" staleTime={5000} />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"v1"');
    });

    fireEvent.click(screen.getByTestId('a-rv'));
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"v2"');
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('请求失败时保留已有数据并暴露 error', async () => {
    fetcher.mockResolvedValueOnce('ok-data');
    render(<Probe cacheKey="k5" fetcher={fetcher} label="a" staleTime={5000} />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"ok-data"');
    });

    // 手动强制重新请求并让其失败
    fetcher.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByTestId('a-rv'));
    await waitFor(() => {
      expect(screen.getByTestId('a-error')).toHaveTextContent('boom');
    });
    // 已有数据仍然保留
    expect(screen.getByTestId('a-data')).toHaveTextContent('"ok-data"');
  });

  it('异步更新均在 act 内完成，避免脏状态泄漏', async () => {
    fetcher.mockResolvedValue('done');
    await act(async () => {
      render(<Probe cacheKey="k6" fetcher={fetcher} label="a" />);
    });
    expect(screen.getByTestId('a-data')).toHaveTextContent('"done"');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('revalidate() 不被在途请求吞掉：迟到返回的旧结果不覆盖新数据', async () => {
    // 首次请求由测试手动控制 resolve 时机，使其长时间处于在途状态
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    fetcher.mockReturnValueOnce(firstPromise).mockResolvedValueOnce('new-data');

    render(<Probe cacheKey="k7" fetcher={fetcher} label="a" staleTime={5000} />);

    // 首次请求仍在途时手动刷新，必须发起第二次请求（不能复用旧的在途请求）
    await act(async () => {
      fireEvent.click(screen.getByTestId('a-rv'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"new-data"');
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // 旧请求迟到返回，不得覆盖已展示的新数据
    await act(async () => {
      resolveFirst('old-data');
    });
    expect(screen.getByTestId('a-data')).toHaveTextContent('"new-data"');
  });

  it('切换 cacheKey 后，旧请求后返回不会覆盖新 key 的数据', async () => {
    // 旧 key 的请求由测试手动控制 resolve 时机
    let resolveOld: (v: unknown) => void = () => {};
    const oldPromise = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const switchFetcher = jest.fn((key: string) =>
      key === 'old' ? oldPromise : Promise.resolve('new-data'),
    );

    function Wrapper() {
      const [key, setKey] = useState('old');
      const { data } = useCachedData(key, () => switchFetcher(key), { staleTime: 0 });
      return (
        <div>
          <span data-testid="switch-data">{data ? JSON.stringify(data) : 'null'}</span>
          <button data-testid="switch-key" onClick={() => setKey('new')}>switch</button>
        </div>
      );
    }

    render(<Wrapper />);

    // 切到 new key，等新数据渲染出来
    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-key'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('switch-data')).toHaveTextContent('"new-data"');
    });

    // 此时旧请求才返回，不应覆盖已展示的新数据
    await act(async () => {
      resolveOld('old-data');
    });
    expect(screen.getByTestId('switch-data')).toHaveTextContent('"new-data"');
    expect(switchFetcher).toHaveBeenCalledWith('old');
    expect(switchFetcher).toHaveBeenCalledWith('new');
  });

  it('页面切到后台（visibilitychange → hidden）不触发重新请求', async () => {
    fetcher.mockResolvedValue('data-x');
    render(<Probe cacheKey="k8" fetcher={fetcher} label="a" staleTime={5000} />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"data-x"');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 模拟文档变为隐藏（切走页签）：visibilitychange 事件不应触发刷新
    const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: original?.get ? original.get() : 'visible',
    });

    // 等一拍确认没有多余请求
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('页面回到前台（visibilitychange → visible）触发重新请求', async () => {
    fetcher.mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    render(<Probe cacheKey="k9" fetcher={fetcher} label="a" staleTime={0} />);
    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"v1"');
    });

    const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
    });
    if (original?.get) {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: original.get,
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('a-data')).toHaveTextContent('"v2"');
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});