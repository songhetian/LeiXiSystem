import { useCallback, useEffect, useRef, useState } from 'react'

interface UseTableDataOptions<T> {
  fetcher: (params?: any) => Promise<any>
  form?: any
  pageSize?: number
  immediate?: boolean
  paginated?: boolean
  defaultParams?: Record<string, any>
  normalize?: (response: any) => { list: T[]; total?: number }
  searchDebounceMs?: number
}

function defaultNormalize<T>(response: any): { list: T[]; total?: number } {
  if (Array.isArray(response?.data)) {
    return { list: response.data, total: response.data.length }
  }

  if (Array.isArray(response?.data?.list)) {
    return {
      list: response.data.list,
      total: response.data.total,
    }
  }

  return { list: [], total: 0 }
}

export function useTableData<T = any>({
  fetcher,
  form,
  pageSize = 10,
  immediate = true,
  paginated = true,
  defaultParams,
  normalize = defaultNormalize<T>,
  searchDebounceMs = 300,
}: UseTableDataOptions<T>) {
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const requestSeqRef = useRef(0)
  const searchTimerRef = useRef<number | undefined>()

  const loadData = useCallback(async (current = 1, extraParams?: Record<string, any>) => {
    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq
    setLoading(true)
    try {
      const formValues = form?.getFieldsValue?.() || {}
      const paginationParams = paginated ? { page: current, pageSize } : {}
      const response = await fetcher({
        ...paginationParams,
        ...defaultParams,
        ...formValues,
        ...extraParams,
      })
      const result = normalize(response)
      if (requestSeq !== requestSeqRef.current) return
      setData(result.list)
      setTotal(result.total ?? result.list.length)
      setPage(current)
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false)
      }
    }
  }, [defaultParams, fetcher, form, normalize, pageSize, paginated])

  const handleSearch = useCallback(() => {
    window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      loadData(1)
    }, searchDebounceMs)
  }, [loadData, searchDebounceMs])

  const handleReset = useCallback(() => {
    form?.resetFields?.()
    loadData(1)
  }, [form, loadData])

  useEffect(() => {
    if (immediate) {
      loadData(1)
    }
    return () => {
      window.clearTimeout(searchTimerRef.current)
      requestSeqRef.current += 1
    }
  }, [immediate, loadData])

  return {
    data,
    setData,
    total,
    setTotal,
    page,
    setPage,
    loading,
    setLoading,
    loadData,
    handleSearch,
    handleReset,
  }
}
