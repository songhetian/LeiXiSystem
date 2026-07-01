import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useServerPagination } from '../useServerPagination'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useServerPagination', () => {
  let mockFetchFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchFn = vi.fn().mockResolvedValue({
      list: [{ id: 1 }, { id: 2 }],
      total: 20,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始加载', () => {
    it('immediate=true 时应该在挂载时立即请求数据', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(mockFetchFn).toHaveBeenCalledTimes(1)
      })

      expect(mockFetchFn).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
      })

      await waitFor(() => {
        expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }])
        expect(result.current.total).toBe(20)
        expect(result.current.loading).toBe(false)
      })
    })

    it('immediate=false 时不应该自动请求', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn, immediate: false }),
      )

      // Wait a tick to confirm no call
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(mockFetchFn).not.toHaveBeenCalled()
      expect(result.current.data).toEqual([])
    })

    it('应该使用默认的 page=1 和 pageSize=10', async () => {
      renderHook(() => useServerPagination({ fetchFn: mockFetchFn }))

      await waitFor(() => {
        expect(mockFetchFn).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, pageSize: 10 }),
        )
      })
    })

    it('应该支持自定义 defaultPage 和 defaultPageSize', async () => {
      renderHook(() =>
        useServerPagination({
          fetchFn: mockFetchFn,
          defaultPage: 2,
          defaultPageSize: 20,
        }),
      )

      await waitFor(() => {
        expect(mockFetchFn).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, pageSize: 20 }),
        )
      })
    })
  })

  describe('初始 filters', () => {
    it('应该将 initialFilters 传给 fetchFn', async () => {
      const filters = { status: 'active', keyword: 'test' }

      renderHook(() =>
        useServerPagination({
          fetchFn: mockFetchFn,
          initialFilters: filters,
        }),
      )

      await waitFor(() => {
        expect(mockFetchFn).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'active', keyword: 'test' }),
        )
      })
    })
  })

  describe('pagination 对象', () => {
    it('应该返回正确的 pagination 配置', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.pagination.current).toBe(1)
      expect(result.current.pagination.pageSize).toBe(10)
      expect(result.current.pagination.total).toBe(20)
      expect(result.current.pagination.sizeOptions).toEqual([10, 20, 50, 100])
      expect(result.current.pagination.showTotal).toBe(true)
      expect(typeof result.current.pagination.onChange).toBe('function')
    })
  })

  describe('翻页', () => {
    it('pagination.onChange 应该更新页码并重新请求', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      mockFetchFn.mockResolvedValueOnce({
        list: [{ id: 3 }],
        total: 20,
      })

      await act(async () => {
        result.current.pagination.onChange(2, 10)
      })

      await waitFor(() => {
        expect(result.current.page).toBe(2)
      })

      await waitFor(() => {
        expect(mockFetchFn).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, pageSize: 10 }),
        )
      })
    })

    it('setPage 应该更新页码', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setPage(3)
      })

      await waitFor(() => {
        expect(result.current.page).toBe(3)
      })
    })

    it('setPageSize 应该更新每页数量', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setPageSize(50)
      })

      await waitFor(() => {
        expect(result.current.pageSize).toBe(50)
      })
    })
  })

  describe('setFilters', () => {
    it('应该更新 filters 并触发重新请求', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        result.current.setFilters({ status: 'inactive' })
      })

      await waitFor(() => {
        expect(result.current.filters).toEqual({ status: 'inactive' })
      })

      await waitFor(() => {
        expect(mockFetchFn).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'inactive' }),
        )
      })
    })
  })

  describe('reload', () => {
    it('应该以当前参数重新请求', async () => {
      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const callCount = mockFetchFn.mock.calls.length

      await act(async () => {
        await result.current.reload()
      })

      expect(mockFetchFn).toHaveBeenCalledTimes(callCount + 1)
    })
  })

  describe('reset', () => {
    it('应该重置到默认状态', async () => {
      const { result } = renderHook(() =>
        useServerPagination({
          fetchFn: mockFetchFn,
          defaultPageSize: 10,
          initialFilters: { status: 'active' },
        }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // 修改状态
      act(() => {
        result.current.setPage(5)
        result.current.setPageSize(50)
      })

      await waitFor(() => {
        expect(result.current.page).toBe(5)
      })

      // 重置
      act(() => {
        result.current.reset()
      })

      await waitFor(() => {
        expect(result.current.page).toBe(1)
        expect(result.current.pageSize).toBe(10)
        expect(result.current.filters).toEqual({ status: 'active' })
      })
    })
  })

  describe('错误处理', () => {
    it('请求失败时应该调用 onError 回调', async () => {
      const onError = vi.fn()
      const error = new Error('网络错误')
      mockFetchFn.mockRejectedValueOnce(error)

      renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn, onError }),
      )

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error)
      })
    })

    it('请求失败时 loading 应该恢复为 false', async () => {
      mockFetchFn.mockRejectedValueOnce(new Error('error'))

      const { result } = renderHook(() =>
        useServerPagination({ fetchFn: mockFetchFn }),
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([])
    })
  })
})
