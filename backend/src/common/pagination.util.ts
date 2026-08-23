export interface PaginationOptions {
  maxPageSize?: number;
  defaultPageSize?: number;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
}

const DEFAULT_MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(
  params: { page?: string | number; pageSize?: string | number },
  options: PaginationOptions = {},
): PaginationResult {
  const maxPageSize = options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const pageRaw = params.page;
  const pageSizeRaw = params.pageSize;

  let page = typeof pageRaw === 'number' ? pageRaw : parseInt(pageRaw ?? '', 10);
  if (isNaN(page) || page < 1) page = 1;

  let pageSize = typeof pageSizeRaw === 'number' ? pageSizeRaw : parseInt(pageSizeRaw ?? '', 10);
  if (isNaN(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > maxPageSize) pageSize = maxPageSize;

  return { page, pageSize };
}
