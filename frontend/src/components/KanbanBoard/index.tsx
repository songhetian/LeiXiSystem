import { useState, useCallback, useMemo } from 'react'
import { Button, Tag, Avatar } from '@arco-design/web-react'
import { IconPlus, IconMore } from '@arco-design/web-react/icon'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './index.module.css'
export interface KanbanItem {
  id: string | number
  title: string
  description?: string
  tags?: string[]
  assignee?: {
    name: string
    avatar?: string
  }
  [key: string]: any
}

export interface KanbanColumn {
  id: string | number
  title: string
  color?: string
  items: KanbanItem[]
}

interface KanbanBoardProps {
  columns: KanbanColumn[]
  onColumnsChange?: (columns: KanbanColumn[]) => void
  onItemClick?: (item: KanbanItem, columnId: string | number) => void
  onAddItem?: (columnId: string | number) => void
  editable?: boolean
}

function SortableItem({
  item,
  columnId,
  onClick,
}: {
  item: KanbanItem
  columnId: string | number
  onClick?: (item: KanbanItem, columnId: string | number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles['kanban-board__card']}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(item, columnId)}
    >
      <div className={styles['kanban-board__card-title']}>{item.title}</div>
      {item.description && (
        <div className={styles['kanban-board__card-desc']}>{item.description}</div>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className={styles['kanban-board__card-tags']}>
          {item.tags.map((tag) => (
            <Tag key={tag} size="small">{tag}</Tag>
          ))}
        </div>
      )}
      {item.assignee && (
        <div className={styles['kanban-board__card-footer']}>
          <Avatar size={20} style={{ backgroundColor: 'var(--color-primary-light-1)' }}>
            {item.assignee.name?.charAt(0)}
          </Avatar>
          <span className={styles['kanban-board__card-assignee']}>{item.assignee.name}</span>
        </div>
      )}
    </div>
  )
}

function KanbanColumnComponent({
  column,
  onAddItem,
  onItemClick,
  editable,
}: {
  column: KanbanColumn
  onAddItem?: (columnId: string | number) => void
  onItemClick?: (item: KanbanItem, columnId: string | number) => void
  editable?: boolean
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    disabled: true,
  })

  const itemIds = useMemo(() => column.items.map((item) => item.id), [column.items])

  return (
    <div ref={setNodeRef} className={styles['kanban-board__column']}>
      <div className={styles['kanban-board__column-header']}>
        <div className={styles['kanban-board__column-title']}>
          <span
            className={styles['kanban-board__column-dot']}
            style={{ backgroundColor: column.color || 'var(--color-primary-5)' }}
          />
          {column.title}
          <Tag size="small" className={styles['kanban-board__column-count']}>
            {column.items.length}
          </Tag>
        </div>
        {editable && (
          <Button size="mini" type="text" icon={<IconMore />} />
        )}
      </div>

      <div className={styles['kanban-board__column-body']}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {column.items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              columnId={column.id}
              onClick={onItemClick}
            />
          ))}
        </SortableContext>

        {editable && (
          <Button
            type="dashed"
            long
            size="small"
            icon={<IconPlus />}
            className={styles['kanban-board__add-btn']}
            onClick={() => onAddItem?.(column.id)}
          >
            添加卡片
          </Button>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard(props: KanbanBoardProps) {
  const { columns, onColumnsChange, onItemClick, onAddItem, editable = true } = props

  const [activeId, setActiveId] = useState<string | number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const findColumnByItemId = useCallback(
    (itemId: string | number): { column: KanbanColumn | null; index: number } => {
      for (let i = 0; i < columns.length; i++) {
        const idx = columns[i].items.findIndex((item) => item.id === itemId)
        if (idx !== -1) {
          return { column: columns[i], index: idx }
        }
      }
      return { column: null, index: -1 }
    },
    [columns],
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    const { column } = findColumnByItemId(activeId)
    if (!column) return null
    return column.items.find((item) => item.id === activeId) || null
  }, [activeId, findColumnByItemId])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const { column: fromColumn, index: fromIndex } = findColumnByItemId(active.id)
      if (!fromColumn || fromIndex === -1) return

      const { column: toColumn, index: toIndex } = findColumnByItemId(over.id)

      if (fromColumn.id === toColumn?.id) {
        const newItems = arrayMove(fromColumn.items, fromIndex, toIndex)
        const newColumns = columns.map((col) =>
          col.id === fromColumn.id ? { ...col, items: newItems } : col,
        )
        onColumnsChange?.(newColumns)
      } else if (toColumn) {
        const item = fromColumn.items[fromIndex]
        const newFromItems = fromColumn.items.filter((_, i) => i !== fromIndex)
        const newToItems = [...toColumn.items]
        newToItems.splice(toIndex, 0, item)
        const newColumns = columns.map((col) => {
          if (col.id === fromColumn.id) return { ...col, items: newFromItems }
          if (col.id === toColumn.id) return { ...col, items: newToItems }
          return col
        })
        onColumnsChange?.(newColumns)
      }
    },
    [columns, findColumnByItemId, onColumnsChange],
  )

  const columnIds = useMemo(() => columns.map((col) => col.id), [columns])

  return (
    <div className={styles['kanban-board']}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnIds} disabled strategy={verticalListSortingStrategy}>
          <div className={styles['kanban-board__columns']}>
            {columns.map((column) => (
              <KanbanColumnComponent
                key={column.id}
                column={column}
                onAddItem={onAddItem}
                onItemClick={onItemClick}
                editable={editable}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className={styles['kanban-board__drag-overlay']}>
              <div className={styles['kanban-board__card-title']}>{activeItem.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
