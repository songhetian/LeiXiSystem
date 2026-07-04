import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBatchSelection } from '../useBatchSelection'

interface TestRow {
  id: number
  name: string
}

const sampleData: TestRow[] = [
  { id: 1, name: '张三' },
  { id: 2, name: '李四' },
  { id: 3, name: '王五' },
]

describe('useBatchSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('应该以空选中初始化', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      expect(result.current.selectedIds).toEqual([])
      expect(result.current.selectedRows).toEqual([])
      expect(result.current.selectedCount).toBe(0)
      expect(result.current.isAllSelected).toBe(false)
      expect(result.current.isIndeterminate).toBe(false)
    })
  })

  describe('toggleRow', () => {
    it('应该选中一行', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleRow(sampleData[0])
      })

      expect(result.current.selectedIds).toEqual([1])
      expect(result.current.selectedRows).toEqual([sampleData[0]])
      expect(result.current.selectedCount).toBe(1)
    })

    it('再次 toggle 应该取消选中', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleRow(sampleData[0])
      })
      expect(result.current.selectedIds).toEqual([1])

      act(() => {
        result.current.toggleRow(sampleData[0])
      })
      expect(result.current.selectedIds).toEqual([])
      expect(result.current.selectedRows).toEqual([])
    })

    it('应该支持选中多行', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleRow(sampleData[0])
      })
      act(() => {
        result.current.toggleRow(sampleData[2])
      })

      expect(result.current.selectedIds).toEqual([1, 3])
      expect(result.current.selectedCount).toBe(2)
    })

    it('应该触发 onSelectionChange 回调', () => {
      const onSelectionChange = vi.fn()
      const { result } = renderHook(() =>
        useBatchSelection<TestRow>({ onSelectionChange }),
      )

      act(() => {
        result.current.toggleRow(sampleData[0])
      })

      expect(onSelectionChange).toHaveBeenCalledWith([1], [sampleData[0]])
    })
  })

  describe('toggleAll', () => {
    it('应该全选所有数据', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleAll(sampleData)
      })

      expect(result.current.selectedIds).toEqual([1, 2, 3])
      expect(result.current.selectedRows).toEqual(sampleData)
      expect(result.current.isAllSelected).toBe(true)
    })

    it('已全选时应该取消全选', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleAll(sampleData)
      })
      expect(result.current.selectedIds).toHaveLength(3)

      act(() => {
        result.current.toggleAll(sampleData)
      })
      expect(result.current.selectedIds).toEqual([])
      expect(result.current.selectedRows).toEqual([])
    })

    it('全选应该触发 onSelectionChange', () => {
      const onSelectionChange = vi.fn()
      const { result } = renderHook(() =>
        useBatchSelection<TestRow>({ onSelectionChange }),
      )

      act(() => {
        result.current.toggleAll(sampleData)
      })

      expect(onSelectionChange).toHaveBeenCalledWith([1, 2, 3], sampleData)
    })
  })

  describe('clearSelection', () => {
    it('应该清空所有选中', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleAll(sampleData)
      })
      expect(result.current.selectedCount).toBe(3)

      act(() => {
        result.current.clearSelection()
      })

      expect(result.current.selectedIds).toEqual([])
      expect(result.current.selectedRows).toEqual([])
      expect(result.current.selectedCount).toBe(0)
    })

    it('清空选中应该触发 onSelectionChange', () => {
      const onSelectionChange = vi.fn()
      const { result } = renderHook(() =>
        useBatchSelection<TestRow>({ onSelectionChange }),
      )

      act(() => {
        result.current.toggleAll(sampleData)
      })

      act(() => {
        result.current.clearSelection()
      })

      expect(onSelectionChange).toHaveBeenLastCalledWith([], [])
    })
  })

  describe('setSelection', () => {
    it('应该直接设置选中状态', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.setSelection([1, 2], [sampleData[0], sampleData[1]])
      })

      expect(result.current.selectedIds).toEqual([1, 2])
      expect(result.current.selectedRows).toEqual([sampleData[0], sampleData[1]])
    })
  })

  describe('自定义 keyField', () => {
    it('应该支持自定义主键字段', () => {
      interface CustomRow {
        uid: string
        name: string
      }
      const data: CustomRow[] = [
        { uid: 'a', name: 'X' },
        { uid: 'b', name: 'Y' },
      ]

      const { result } = renderHook(() =>
        useBatchSelection<CustomRow>({ keyField: 'uid' }),
      )

      act(() => {
        result.current.toggleRow(data[0])
      })

      expect(result.current.selectedIds).toEqual(['a'])
    })
  })

  describe('getRowSelection', () => {
    it('应该返回正确的 rowSelection 配置', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      act(() => {
        result.current.toggleRow(sampleData[0])
      })

      const rowSelection = result.current.getRowSelection(sampleData)

      expect(rowSelection.selectedRowKeys).toEqual([1])
      expect(typeof rowSelection.onChange).toBe('function')
    })

    it('onChange 应该合并跨页选中', () => {
      const { result } = renderHook(() => useBatchSelection<TestRow>())

      // 模拟先选中了第一页的一条
      act(() => {
        result.current.toggleRow(sampleData[0])
      })

      const page2Data: TestRow[] = [
        { id: 4, name: '赵六' },
        { id: 5, name: '钱七' },
      ]

      const rowSelection = result.current.getRowSelection(page2Data)

      act(() => {
        rowSelection.onChange([4], [page2Data[0]])
      })

      // 应该保留第一页的选中 + 新增第二页
      expect(result.current.selectedIds).toEqual([1, 4])
      expect(result.current.selectedCount).toBe(2)
    })
  })
})
