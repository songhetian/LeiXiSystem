import { useState, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'

interface UseDraggableListOptions<T> {
  items: T[]
  onReorder?: (items: T[], oldIndex: number, newIndex: number) => void
  getItemId?: (item: T, index: number) => string | number
}

interface UseDraggableListResult<T> {
  items: T[]
  setItems: (items: T[]) => void
  handleDragEnd: (oldIndex: number, newIndex: number) => void
  getItemId: (item: T, index: number) => string | number
  moveItem: (fromIndex: number, toIndex: number) => void
}

export function useDraggableList<T = any>(
  options: UseDraggableListOptions<T>,
): UseDraggableListResult<T> {
  const { items: initialItems, onReorder, getItemId: customGetItemId } = options

  const [items, setItems] = useState<T[]>(initialItems)

  const getItemId = useCallback(
    (item: T, index: number): string | number => {
      if (customGetItemId) return customGetItemId(item, index)
      if (item && typeof item === 'object' && 'id' in item) {
        return (item as any).id
      }
      return index
    },
    [customGetItemId],
  )

  const handleDragEnd = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (oldIndex === newIndex) return

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)
      onReorder?.(newItems, oldIndex, newIndex)
    },
    [items, onReorder],
  )

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex < 0 || fromIndex >= items.length) return
      if (toIndex < 0 || toIndex >= items.length) return
      handleDragEnd(fromIndex, toIndex)
    },
    [items.length, handleDragEnd],
  )

  return {
    items,
    setItems,
    handleDragEnd,
    getItemId,
    moveItem,
  }
}

export default useDraggableList
