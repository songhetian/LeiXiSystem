/**
 * 分页取全量。
 *
 * 后端对所有列表接口都有 pageSize 上限（`parsePagination`，默认 100），
 * 页面里写 `pageSize: 10000` 会被静默截断成 100 —— 导出看起来成功、实际只导出了
 * 第一页，数据越多丢得越多、且没有任何提示。导出/全量统计一律走这里翻页收集。
 */

export interface PagePayload<T> {
  list: T[];
  total: number;
}

export interface FetchAllOptions {
  /** 单页条数，默认取后端通用上限 100 */
  pageSize?: number;
  /** 兜底最大页数，防止后端 total 异常导致死循环 */
  maxPages?: number;
}

/**
 * 逐页拉取直到累计条数达到 total（或某页返回空）。
 * @param fetchPage 传入页码与页大小，返回该页数据与总数
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PagePayload<T>>,
  options: FetchAllOptions = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 200;

  const all: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { list, total } = await fetchPage(page, pageSize);
    all.push(...list);
    // 空页 / 已取满 / total 不可信（小于已取条数）都收敛，避免无意义请求
    if (list.length === 0 || all.length >= total) break;
  }
  return all;
}
