import { useState, useCallback, useMemo } from 'react'
import { Button } from '@arco-design/web-react'
import { IconFolder, IconFile, IconDragDotVertical } from '@arco-design/web-react/icon'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './index.module.css'
export interface TreeDragNode {
  id: string | number
  title: string
  children?: TreeDragNode[]
  icon?: React.ReactNode
  [key: string]: any
}

interface TreeDragProps {
  data: TreeDragNode[]
  onChange?: (data: TreeDragNode[]) => void
  onNodeClick?: (node: TreeDragNode) => void
  editable?: boolean
  defaultExpandAll?: boolean
}

function flattenTree(nodes: TreeDragNode[], depth = 0): { node: TreeDragNode; depth: number; parentId: string | number | null }[] {
  const result: { node: TreeDragNode; depth: number; parentId: string | number | null }[] = []
  for (const node of nodes) {
    result.push({ node, depth, parentId: null })
    if (node.children && node.children.length > 0) {
      const children = flattenTree(node.children, depth + 1)
      children.forEach((c) => {
        if (c.parentId === null) c.parentId = node.id
      })
      result.push(...children)
    }
  }
  return result
}

function buildTree(flattened: { node: TreeDragNode; depth: number; parentId: string | number | null }[]): TreeDragNode[] {
  const map = new Map<string | number, TreeDragNode>()
  const roots: TreeDragNode[] = []

  flattened.forEach(({ node }) => {
    map.set(node.id, { ...node, children: [] })
  })

  flattened.forEach(({ node, parentId }) => {
    const current = map.get(node.id)!
    if (parentId === null) {
      roots.push(current)
    } else {
      const parent = map.get(parentId)
      if (parent) {
        parent.children!.push(current)
      }
    }
  })

  return roots
}

function SortableTreeNode({
  node,
  depth,
  onToggle,
  expanded,
  onClick,
}: {
  node: TreeDragNode
  depth: number
  onToggle: (id: string | number) => void
  expanded: boolean
  onClick?: (node: TreeDragNode) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: depth * 20 + 8,
  }

  const hasChildren = node.children && node.children.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles['tree-drag__node']}
    >
      <div className={styles['tree-drag__node-content']}>
        <span className={styles['tree-drag__drag-handle']} {...attributes} {...listeners}>
          <IconDragDotVertical />
        </span>
        {hasChildren ? (
          <Button
            size="mini"
            type="text"
            icon={expanded ? '▼' : '▶'}
            className={styles['tree-drag__expand-btn']}
            onClick={() => onToggle(node.id)}
          />
        ) : (
          <span className={styles['tree-drag__no-expand']} />
        )}
        <span className={styles['tree-drag__node-icon']}>
          {node.icon || (hasChildren ? <IconFolder /> : <IconFile />)}
        </span>
        <span
          className={styles['tree-drag__node-title']}
          onClick={() => onClick?.(node)}
        >
          {node.title}
        </span>
      </div>
    </div>
  )
}

export default function TreeDrag(props: TreeDragProps) {
  const { data, onChange, onNodeClick, editable = true, defaultExpandAll = true } = props

  const [activeId, setActiveId] = useState<string | number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(() => {
    if (!defaultExpandAll) return new Set()
    const ids = new Set<string | number>()
    function collect(nodes: TreeDragNode[]) {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          ids.add(node.id)
          collect(node.children)
        }
      })
    }
    collect(data)
    return ids
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const toggleExpand = useCallback((id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const flattened = useMemo(() => {
    function collectVisible(nodes: TreeDragNode[], depth = 0, parentId: string | number | null = null): { node: TreeDragNode; depth: number; parentId: string | number | null }[] {
      const result: { node: TreeDragNode; depth: number; parentId: string | number | null }[] = []
      for (const node of nodes) {
        result.push({ node, depth, parentId })
        if (node.children && node.children.length > 0 && expandedIds.has(node.id)) {
          result.push(...collectVisible(node.children, depth + 1, node.id))
        }
      }
      return result
    }
    return collectVisible(data)
  }, [data, expandedIds])

  const itemIds = useMemo(() => flattened.map((f) => f.node.id), [flattened])

  const activeNode = useMemo(() => {
    if (!activeId) return null
    const found = flattened.find((f) => f.node.id === activeId)
    return found ? found.node : null
  }, [activeId, flattened])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const allFlattened = flattenTree(data)
      const activeIndex = allFlattened.findIndex((f) => f.node.id === active.id)
      const overIndex = allFlattened.findIndex((f) => f.node.id === over.id)

      if (activeIndex === -1 || overIndex === -1) return

      const activeItem = allFlattened[activeIndex]
      const overItem = allFlattened[overIndex]

      if (activeItem.parentId !== overItem.parentId) {
        return
      }

      const newFlattened = arrayMove(allFlattened, activeIndex, overIndex)
      const newTree = buildTree(newFlattened)
      onChange?.(newTree)
    },
    [data, onChange],
  )

  return (
    <div className={styles['tree-drag']}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={!editable}>
          <div className={styles['tree-drag__container']}>
            {flattened.map(({ node, depth }) => (
              <SortableTreeNode
                key={node.id}
                node={node}
                depth={depth}
                onToggle={toggleExpand}
                expanded={expandedIds.has(node.id)}
                onClick={onNodeClick}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeNode ? (
            <div className={styles['tree-drag__drag-overlay']}>
              <IconFile />
              <span>{activeNode.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
