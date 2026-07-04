import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/utils/logger'

interface UseServerPaginationOptions<T = any> {
  fetchFn: (params: { page: number; pageSize: number; [key: string]: any }) => Promise<{
    list: T[]
    total: number
  }>
  defaultPageSize?: number
  defaultPage?: number
  initialFilters?: Record<string, any>
  immediate?: boolean
  onError?: (error: unknown) => void
}

interface UseServerPaginationResult<T> {
  data: T[]
  total: number
  loading: boolean
  page: number
  pageSize: number
  filters: Record<string, any>
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setFilters: (filters: Record<string, any>) => void
  reload: () => Promise<void>
  reset: () => void
  pagination: {
    current: number
    pageSize: number
    total: number
    sizeOptions: number[]
    onChange: (page: number, pageSize: number) => void
    showTotal: boolean
  }
}

export function useServerPagination<T = any>(
  options: UseServerPaginationOptions<T>,
): UseServerPaginationResult<T> {
  const {
    fetchFn,
    defaultPageSize = 10,
    defaultPage = 1,
    initialFilters = {},
    immediate = true,
    onError,
  } = options

  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(defaultPage)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchFn({
        page,
        pageSize,
        ...filters,
      })
      setData(result.list || [])
      setTotal(result.total || 0)
    } catch (error) {
      logger.error('分页数据加载失败', error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [fetchFn, page, pageSize, filters, onError])

  const reload = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  const reset = useCallback(() => {
    setPage(1)
    setPageSize(defaultPageSize)
    setFilters(initialFilters)
  }, [defaultPageSize, initialFilters])

  const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
  }, [])

  useEffect(() => {
    if (immediate) {
      fetchData()
    }
  }, [immediate, fetchData])

  return {
    data,
    total,
    loading,
    page,
    pageSize,
    filters,
    setPage,
    setPageSize,
    setFilters,
    reload,
    reset,
    pagination: {
      current: page,
      pageSize,
      total,
      sizeOptions: [10, 20, 50, 100],
      onChange: handlePageChange,
      showTotal: true,
    },
  }
}

export default useServerPagination
