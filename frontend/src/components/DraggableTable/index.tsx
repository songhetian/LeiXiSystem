import { useCallback, useMemo } from 'react'
import { Table } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { IconDragDotVertical } from '@arco-design/web-react/icon'
import styles from './index.module.css'
interface SortableRowProps {
  id: string | number
  children: React.ReactNode
  isDragging?: boolean
}

function SortableRow({ id, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'var(--color-fill-2)' : undefined,
    cursor: 'grab',
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={styles['draggable-table__row']}
      aria-grabbed={isDragging}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  )
}

interface DraggableTableProps<T = any> extends Omit<TableProps<T>, 'components'> {
  /** 是否启用拖拽排序，默认 true */
  draggable?: boolean
  /** 拖拽排序结束回调 */
  onReorder?: (items: T[], oldIndex: number, newIndex: number) => void
  /** 获取行的唯一标识，默认取 id 字段 */
  rowKey?: string | ((record: T) => string | number)
}

function DraggableTable<T extends Record<string, any> = any>(props: DraggableTableProps<T>) {
  const {
    draggable = true,
    onReorder,
    data = [],
    columns = [],
    rowKey = 'id',
    ...tableProps
  } = props

  const [activeId, setActiveId] = useState<string | number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const getRowId = useCallback(
    (record: T): string | number => {
      if (typeof rowKey === 'function') return rowKey(record)
      return record[rowKey] as string | number
    },
    [rowKey],
  )

  const itemIds = useMemo(() => {
    if (!draggable) return []
    return data.map((item) => getRowId(item))
  }, [data, draggable, getRowId])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const oldIndex = itemIds.indexOf(active.id)
      const newIndex = itemIds.indexOf(over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const newItems = arrayMove(data as T[], oldIndex, newIndex)
      onReorder?.(newItems, oldIndex, newIndex)
    },
    [itemIds, data, onReorder],
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    const index = itemIds.indexOf(activeId)
    return index >= 0 ? (data as T[])[index] : null
  }, [activeId, itemIds, data])

  const allColumns = useMemo(() => {
    if (!draggable) return columns
    return [
      {
        title: '',
        key: 'drag-handle',
        width: 40,
        align: 'center' as const,
        render: () => <IconDragDotVertical style={{ cursor: 'grab', color: 'var(--color-text-3)' }} />,
      },
      ...columns,
    ]
  }, [columns, draggable])

  const components = useMemo(() => {
    if (!draggable) return undefined

    return {
      body: {
        row: (rowProps: any) => {
          const record = rowProps.record as T
          const id = getRowId(record)
          return (
            <SortableRow id={id} key={id}>
              {rowProps.children}
            </SortableRow>
          )
        },
      },
    }
  }, [draggable, getRowId])

  if (!draggable) {
    return <Table {...tableProps} data={data} columns={columns} rowKey={rowKey as string} />
  }

  return (
    <div className={styles['draggable-table']} aria-dropeffect="move">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <Table
            {...tableProps}
            data={data}
            columns={allColumns}
            components={components}
            rowKey={rowKey as string}
          />
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className={styles['draggable-table__drag-overlay']}>
              <IconDragDotVertical />
              <span className={styles['draggable-table__drag-overlay-text']}>
                {(activeItem as any).name || (activeItem as any).title || '拖拽中...'}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default DraggableTable
