import { useCallback, useState } from 'react'

interface UseBatchSelectionOptions<T = any> {
  /** 主键字段名，默认 'id' */
  keyField?: string
  /** 选择变化时的回调 */
  onSelectionChange?: (selectedIds: (string | number)[], selectedRows: T[]) => void
}

interface UseBatchSelectionResult<T = any> {
  /** 选中的 ID 列表 */
  selectedIds: (string | number)[]
  /** 选中的行数据 */
  selectedRows: T[]
  /** 是否全选 */
  isAllSelected: boolean
  /** 是否 indeterminate（部分选中） */
  isIndeterminate: boolean
  /** 选中的数量 */
  selectedCount: number
  /** 切换单行选中状态 */
  toggleRow: (row: T) => void
  /** 切换全选 */
  toggleAll: (data: T[]) => void
  /** 清空选择 */
  clearSelection: () => void
  /** 设置选中状态（用于表格 rowSelection change） */
  setSelection: (keys: (string | number)[], rows: T[]) => void
  /** 生成 rowSelection 配置 */
  getRowSelection: (data: T[]) => {
    selectedRowKeys: (string | number)[]
    onChange: (keys: (string | number)[], rows: T[]) => void
  }
}

/**
 * 批量选择 Hook
 *
 * @example
 * const batch = useBatchSelection<Employee>()
 *
 * // 在 Table 中使用
 * <Table
 *   rowSelection={batch.getRowSelection(data)}
 * />
 *
 * // 批量操作
 * {batch.selectedCount > 0 && (
 *   <Space>
 *     <span>已选择 {batch.selectedCount} 项</span>
 *     <Button onClick={() => batchDelete(batch.selectedIds)}>批量删除</Button>
 *   </Space>
 * )}
 */
export function useBatchSelection<T = any>(options: UseBatchSelectionOptions<T> = {}): UseBatchSelectionResult<T> {
  const { keyField = 'id', onSelectionChange } = options

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [selectedRows, setSelectedRows] = useState<T[]>([])

  const toggleRow = useCallback((row: T) => {
    const id = (row as any)[keyField]
    const isSelected = selectedIds.includes(id)

    let newIds: (string | number)[]
    let newRows: T[]

    if (isSelected) {
      newIds = selectedIds.filter((i) => i !== id)
      newRows = selectedRows.filter((r) => (r as any)[keyField] !== id)
    } else {
      newIds = [...selectedIds, id]
      newRows = [...selectedRows, row]
    }

    setSelectedIds(newIds)
    setSelectedRows(newRows)
    onSelectionChange?.(newIds, newRows)
  }, [selectedIds, selectedRows, keyField, onSelectionChange])

  const toggleAll = useCallback((data: T[]) => {
    if (selectedIds.length === data.length) {
      // 取消全选
      setSelectedIds([])
      setSelectedRows([])
      onSelectionChange?.([], [])
    } else {
      // 全选
      const allIds = data.map((row) => (row as any)[keyField])
      setSelectedIds(allIds)
      setSelectedRows(data)
      onSelectionChange?.(allIds, data)
    }
  }, [selectedIds, keyField, onSelectionChange])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setSelectedRows([])
    onSelectionChange?.([], [])
  }, [onSelectionChange])

  const setSelection = useCallback((keys: (string | number)[], rows: T[]) => {
    setSelectedIds(keys)
    setSelectedRows(rows)
    onSelectionChange?.(keys, rows)
  }, [onSelectionChange])

  const getRowSelection = useCallback((data: T[]) => {
    const dataIds = data.map((row) => (row as any)[keyField])

    return {
      selectedRowKeys: selectedIds.filter((id) => dataIds.includes(id)),
      onChange: (keys: (string | number)[], selectedRows: T[]) => {
        // 计算这一页的实际选中
        const pageSelectedIds = keys.filter((id) => dataIds.includes(id))
        const pageSelectedRows = selectedRows.filter((row) => dataIds.includes((row as any)[keyField]))

        // 合并其他页的选中
        const otherPageIds = selectedIds.filter((id) => !dataIds.includes(id))
        const otherPageRows = selectedRows.filter((row) => !dataIds.includes((row as any)[keyField]))

        const newIds = [...otherPageIds, ...pageSelectedIds]
        const newRows = [...otherPageRows, ...pageSelectedRows]

        setSelectedIds(newIds)
        setSelectedRows(newRows)
        onSelectionChange?.(newIds, newRows)
      },
    }
  }, [selectedIds, keyField, onSelectionChange])

  return {
    selectedIds,
    selectedRows,
    isAllSelected: selectedIds.length > 0,
    isIndeterminate: false,
    selectedCount: selectedIds.length,
    toggleRow,
    toggleAll,
    clearSelection,
    setSelection,
    getRowSelection,
  }
}

export default useBatchSelection
