import { fetchAllPages } from '@/lib/fetch-all';

describe('fetchAllPages（分页取全量）', () => {
  it('按 total 逐页拉取，直到取满为止', async () => {
    const pages: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7],
    };
    const fetchPage = jest.fn(async (page: number) => ({
      list: pages[page] ?? [],
      total: 7,
    }));

    const all = await fetchAllPages<number>(fetchPage, { pageSize: 3 });

    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 3);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('默认单页 100 条（后端 parsePagination 的通用上限，写 10000 会被静默截断）', async () => {
    const fetchPage = jest.fn(async () => ({ list: [1], total: 1 }));
    await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledWith(1, 100);
  });

  it('遇到空页立即停止，不无限请求', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ list: [1, 2], total: 10 })
      .mockResolvedValueOnce({ list: [], total: 10 });

    const all = await fetchAllPages(fetchPage, { pageSize: 2 });

    expect(all).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('total 缺失或小于已取条数时收敛（不会重复翻页）', async () => {
    const fetchPage = jest.fn(async () => ({ list: [1, 2], total: 0 }));
    const all = await fetchAllPages(fetchPage, { pageSize: 2 });

    expect(all).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('maxPages 兜底：后端 total 虚高时也不会死循环', async () => {
    const fetchPage = jest.fn(async () => ({ list: [1], total: 999999 }));
    const all = await fetchAllPages(fetchPage, { pageSize: 1, maxPages: 3 });

    expect(all).toEqual([1, 1, 1]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
