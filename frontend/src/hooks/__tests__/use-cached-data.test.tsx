import '@testing-library/jest-dom';
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
});