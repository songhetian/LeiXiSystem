import { useEffect, useCallback, useRef } from 'react'

interface UseTableHotkeysOptions {
  onNew?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onRefresh?: () => void
  onSearch?: () => void
  onExport?: () => void
  hasSelection?: boolean
  onSelectAll?: () => void
}

/**
 * 表格快捷键 Hook
 *
 * 支持的快捷键:
 * - Ctrl+N: 新建
 * - Ctrl+E: 编辑（需选中行）
 * - Delete: 删除（需选中行）
 * - Ctrl+R: 刷新
 * - Ctrl+K: 搜索
 * - Ctrl+D: 导出
 * - Ctrl+A: 全选
 * - ↑/↓: 行导航
 * - Enter: 编辑选中行
 * - Escape: 取消选择
 */
export function useTableHotkeys(options: UseTableHotkeysOptions) {
  const {
    onNew,
    onEdit,
    onDelete,
    onRefresh,
    onSearch,
    onExport,
    onSelectAll,
  } = options

  const selectedIndexRef = useRef<number>(-1)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      // 如果在输入框中且不是 Escape，则不处理
      if (isInput && e.key !== 'Escape') {
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+N: 新建
      if (ctrl && e.key === 'n') {
        e.preventDefault()
        onNew?.()
        return
      }

      // Ctrl+E: 编辑
      if (ctrl && e.key === 'e') {
        e.preventDefault()
        onEdit?.()
        return
      }

      // Delete: 删除
      if (e.key === 'Delete' && !isInput) {
        e.preventDefault()
        onDelete?.()
        return
      }

      // Ctrl+R: 刷新
      if (ctrl && e.key === 'r') {
        e.preventDefault()
        onRefresh?.()
        return
      }

      // Ctrl+K: 搜索
      if (ctrl && e.key === 'k') {
        e.preventDefault()
        onSearch?.()
        return
      }

      // Ctrl+D: 导出
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        onExport?.()
        return
      }

      // Ctrl+A: 全选
      if (ctrl && e.key === 'a') {
        e.preventDefault()
        onSelectAll?.()
        return
      }
    },
    [onNew, onEdit, onDelete, onRefresh, onSearch, onExport, onSelectAll]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    selectedIndex: selectedIndexRef.current,
    setSelectedIndex: (index: number) => {
      selectedIndexRef.current = index
    },
  }
}

export default useTableHotkeys
