import { useState, useCallback, useMemo } from 'react'
import { Dropdown, Button, Message, Checkbox, Divider } from '@arco-design/web-react'
import { IconSettings, IconRefresh, IconDragDotVertical } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './useTableSettings.module.css'
interface ColumnSetting {
  key: string
  title: string
  visible?: boolean
  fixed?: 'left' | 'right'
  width?: number
  minWidth?: number
}

interface UseTableSettingsOptions<T = any> {
  /** 列配置 */
  columns: TableProps<T>['columns']
  /** 本地存储 key */
  storageKey?: string
  /** 默认密度 */
  defaultSize?: 'mini' | 'small' | 'medium'
}

interface UseTableSettingsResult<T = any> {
  /** 当前列配置 */
  columnSettings: ColumnSetting<T>[]
  /** 可见列 */
  visibleColumns: TableProps<T>['columns']
  /** 当前密度 */
  size: 'mini' | 'small' | 'medium'
  /** 设置密度 */
  setSize: (size: 'mini' | 'small' | 'medium') => void
  /** 切换列显示 */
  toggleColumn: (key: string) => void
  /** 重置列配置 */
  resetColumns: () => void
  /** 设置列宽度 */
  setColumnWidth: (key: string, width: number) => void
  /** 设置面板 */
  settingsMenu: React.ReactNode
}

/**
 * 表格设置 Hook
 *
 * @example
 * const { visibleColumns, size, setSize, settingsMenu } = useTableSettings({
 *   columns,
 *   storageKey: 'vacation-types-columns',
 * })
 *
 * <Table columns={visibleColumns} size={size} />
 * {settingsMenu}
 */
export function useTableSettings<T = any>({
  columns,
  storageKey,
  defaultSize = 'medium',
}: UseTableSettingsOptions<T>): UseTableSettingsResult<T> {
  // 从 localStorage 读取保存的列配置
  const loadFromStorage = useCallback(() => {
    if (!storageKey) return null
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  }, [storageKey])

  // 从列定义初始化
  const initColumns = useMemo((): ColumnSetting<T>[] => {
    return columns.map((col: any) => ({
      key: col.key || col.dataIndex,
      title: typeof col.title === 'string' ? col.title : String(col.dataIndex),
      visible: col.visible !== false,
      fixed: col.fixed,
      width: col.width,
      minWidth: col.minWidth,
    }))
  }, [columns])

  const [columnSettings, setColumnSettings] = useState<ColumnSetting<T>[]>(() => {
    const saved = loadFromStorage()
    if (saved) return saved
    return initColumns
  })

  const [size, setSizeState] = useState<'mini' | 'small' | 'medium'>(() => {
    if (!storageKey) return defaultSize
    const savedSize = localStorage.getItem(`${storageKey}-size`)
    return (savedSize as any) || defaultSize
  })

  // 保存到 localStorage
  const saveToStorage = useCallback((settings: ColumnSetting<T>[], tableSize: string) => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings))
      localStorage.setItem(`${storageKey}-size`, tableSize)
    } catch {
      // ignore
    }
  }, [storageKey])

  // 切换列显示
  const toggleColumn = useCallback((key: string) => {
    setColumnSettings((prev) => {
      const updated = prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
      saveToStorage(updated, size)
      return updated
    })
  }, [saveToStorage, size])

  // 重置列配置
  const resetColumns = useCallback(() => {
    setColumnSettings(initColumns)
    saveToStorage(initColumns, size)
    Message.success('已重置为默认配置')
  }, [initColumns, saveToStorage, size])

  // 设置密度
  const setSize = useCallback((newSize: 'mini' | 'small' | 'medium') => {
    setSizeState(newSize)
    saveToStorage(columnSettings, newSize)
  }, [columnSettings, saveToStorage])

  // 设置列宽度
  const setColumnWidth = useCallback((key: string, width: number) => {
    setColumnSettings((prev) => {
      const updated = prev.map((col) =>
        col.key === key ? { ...col, width } : col
      )
      saveToStorage(updated, size)
      return updated
    })
  }, [saveToStorage, size])

  // 移动列顺序
  const moveColumn = useCallback((oldIndex: number, newIndex: number) => {
    setColumnSettings((prev) => {
      const updated = arrayMove(prev, oldIndex, newIndex)
      saveToStorage(updated, size)
      return updated
    })
  }, [saveToStorage, size])

  // 根据配置过滤列并保持顺序
  const visibleColumns = useMemo(() => {
    const visibleSettings = columnSettings.filter((col) => col.visible !== false)
    return visibleSettings
      .map((setting) => {
        const col = (columns as any[]).find((c: any) => (c.key || c.dataIndex) === setting.key)
        if (col) {
          return { ...col, width: setting.width || col.width }
        }
        return null
      })
      .filter(Boolean) as TableProps<T>['columns']
  }, [columns, columnSettings])

  // 设置菜单
  const settingsMenu = useMemo(() => (
    <TableSettingsPanel
      columnSettings={columnSettings}
      size={size}
      onToggleColumn={toggleColumn}
      onMoveColumn={moveColumn}
      onSetSize={setSize}
      onReset={resetColumns}
    />
  ), [columnSettings, size, toggleColumn, moveColumn, setSize, resetColumns])

  return {
    columnSettings,
    visibleColumns,
    size,
    setSize,
    toggleColumn,
    resetColumns,
    setColumnWidth,
    settingsMenu,
    moveColumn,
  }
}

interface SortableColumnItemProps {
  column: ColumnSetting
  onToggle: (key: string) => void
}

function SortableColumnItem({ column, onToggle }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.key,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'var(--color-fill-2)' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles['table-settings-panel__item']}>
      <span className={styles['table-settings-panel__drag-handle']} {...attributes} {...listeners}>
        <IconDragDotVertical style={{ fontSize: 12 }} />
      </span>
      <Checkbox
        checked={column.visible !== false}
        onChange={() => onToggle(column.key)}
      >
        {column.title}
      </Checkbox>
    </div>
  )
}

interface TableSettingsPanelProps<T = any> {
  columnSettings: ColumnSetting<T>[]
  size: 'mini' | 'small' | 'medium'
  onToggleColumn: (key: string) => void
  onMoveColumn: (oldIndex: number, newIndex: number) => void
  onSetSize: (size: 'mini' | 'small' | 'medium') => void
  onReset: () => void
}

function TableSettingsPanel<T = any>(props: TableSettingsPanelProps<T>) {
  const { columnSettings, size, onToggleColumn, onMoveColumn, onSetSize, onReset } = props

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const columnKeys = useMemo(() => columnSettings.map((c) => c.key), [columnSettings])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = columnKeys.indexOf(active.id as string)
      const newIndex = columnKeys.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        onMoveColumn(oldIndex, newIndex)
      }
    },
    [columnKeys, onMoveColumn],
  )

  return (
    <div className={styles['table-settings-panel']}>
      <div className={styles['table-settings-panel__section']}>
        <div className={styles['table-settings-panel__title']}>列显示/排序</div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columnKeys} strategy={verticalListSortingStrategy}>
            {columnSettings.map((col) => (
              <SortableColumnItem
                key={col.key}
                column={col as ColumnSetting}
                onToggle={onToggleColumn}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <Divider />

      <div className={styles['table-settings-panel__section']}>
        <div className={styles['table-settings-panel__title']}>密度</div>
        <div className={styles['table-settings-panel__sizes']}>
          <Button
            type={size === 'mini' ? 'primary' : 'secondary'}
            size="mini"
            onClick={() => onSetSize('mini')}
          >
            紧凑
          </Button>
          <Button
            type={size === 'small' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => onSetSize('small')}
          >
            默认
          </Button>
          <Button
            type={size === 'medium' ? 'primary' : 'secondary'}
            size="medium"
            onClick={() => onSetSize('medium')}
          >
            舒适
          </Button>
        </div>
      </div>

      <Divider />

      <Button
        type="text"
        icon={<IconRefresh />}
        onClick={onReset}
        className={styles['table-settings-panel__reset']}
      >
        重置默认
      </Button>
    </div>
  )
}

// 表格设置按钮组件
interface TableSettingsButtonProps {
  settingsMenu: React.ReactNode
  className?: string
}

export function TableSettingsButton({ settingsMenu, className = '' }: TableSettingsButtonProps) {
  return (
    <Dropdown
      trigger="click"
      position="bl"
      popup={() => settingsMenu}
      className={`${styles['table-settings-dropdown']} ${className}`}
    >
      <Button icon={<IconSettings />} type="text" size="small">
        设置
      </Button>
    </Dropdown>
  )
}

export default useTableSettings
