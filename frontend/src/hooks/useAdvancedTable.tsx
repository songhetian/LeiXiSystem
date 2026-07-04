import { useState, useCallback, useMemo } from 'react'
import { Dropdown, Button, Message } from '@arco-design/web-react'
import { IconSettings, IconSortAscending, IconSortDescending, IconClose } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import styles from './useAdvancedTable.module.css'
export type SortOrder = 'asc' | 'desc' | null

export interface SortConfig {
  field: string
  order: SortOrder
}

export interface ColumnFilter {
  field: string
  value: string | number | boolean | null
  operator?: 'eq' | 'contains' | 'gt' | 'lt' | 'between'
}

interface UseAdvancedTableOptions<T = any> {
  /** 列配置 */
  columns: TableProps<T>['columns']
  /** 数据 */
  data: T[]
  /** 本地存储 key */
  storageKey?: string
  /** 默认密度 */
  defaultSize?: 'mini' | 'small' | 'medium'
  /** 默认斑马纹 */
  defaultStripe?: boolean
  /** 默认显示操作列 */
  defaultShowOperations?: boolean
}

interface UseAdvancedTableResult<T = any> {
  /** 处理后的列配置 */
  processedColumns: TableProps<T>['columns']
  /** 当前密度 */
  size: 'mini' | 'small' | 'medium'
  /** 设置密度 */
  setSize: (size: 'mini' | 'small' | 'medium') => void
  /** 是否斑马纹 */
  stripe: boolean
  /** 切换斑马纹 */
  toggleStripe: () => void
  /** 当前排序 */
  sortConfig: SortConfig | null
  /** 设置排序 */
  setSort: (field: string, order: SortOrder) => void
  /** 当前筛选 */
  filters: ColumnFilter[]
  /** 添加筛选 */
  addFilter: (filter: ColumnFilter) => void
  /** 移除筛选 */
  removeFilter: (field: string) => void
  /** 清空所有筛选 */
  clearFilters: () => void
  /** 过滤和排序后的数据 */
  processedData: T[]
  /** 是否有活跃筛选 */
  hasActiveFilters: boolean
  /** 活跃筛选信息 */
  activeFiltersInfo: Array<{ field: string; label: string; value: string }>
  /** 设置菜单 */
  settingsMenu: React.ReactNode
}

/**
 * 高级表格 Hook
 *
 * @example
 * const {
 *   processedColumns,
 *   processedData,
 *   size,
 *   stripe,
 *   sortConfig,
 *   filters,
 *   setSort,
 *   toggleStripe,
 *   settingsMenu,
 * } = useAdvancedTable({
 *   columns,
 *   data,
 *   storageKey: 'vacation-types-table',
 * })
 */
export function useAdvancedTable<T = any>({
  columns,
  data,
  storageKey,
  defaultSize = 'medium',
  defaultStripe = false,
}: UseAdvancedTableOptions<T>): UseAdvancedTableResult<T> {
  // 密度设置
  const [size, setSizeState] = useState<'mini' | 'small' | 'medium'>(() => {
    if (!storageKey) return defaultSize
    const saved = localStorage.getItem(`${storageKey}-size`)
    return (saved as any) || defaultSize
  })

  // 斑马纹
  const [stripe, setStripe] = useState(() => {
    if (!storageKey) return defaultStripe
    const saved = localStorage.getItem(`${storageKey}-stripe`)
    return saved ? saved === 'true' : defaultStripe
  })

  // 排序
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  // 筛选
  const [filters, setFilters] = useState<ColumnFilter[]>([])

  // 保存设置
  const saveSettings = useCallback((tableSize: string, tableStripe: boolean) => {
    if (!storageKey) return
    try {
      localStorage.setItem(`${storageKey}-size`, tableSize)
      localStorage.setItem(`${storageKey}-stripe`, String(tableStripe))
    } catch {
      // ignore
    }
  }, [storageKey])

  // 设置密度
  const setSize = useCallback((newSize: 'mini' | 'small' | 'medium') => {
    setSizeState(newSize)
    saveSettings(newSize, stripe)
  }, [stripe, saveSettings])

  // 切换斑马纹
  const toggleStripe = useCallback(() => {
    setStripe((prev) => {
      saveSettings(size, !prev)
      return !prev
    })
  }, [size, saveSettings])

  // 设置排序
  const setSort = useCallback((field: string, order: SortOrder) => {
    setSortConfig(order ? { field, order } : null)
  }, [])

  // 添加筛选
  const addFilter = useCallback((filter: ColumnFilter) => {
    setFilters((prev) => {
      const exists = prev.find((f) => f.field === filter.field)
      if (exists) {
        return prev.map((f) => f.field === filter.field ? filter : f)
      }
      return [...prev, filter]
    })
  }, [])

  // 移除筛选
  const removeFilter = useCallback((field: string) => {
    setFilters((prev) => prev.filter((f) => f.field !== field))
  }, [])

  // 清空筛选
  const clearFilters = useCallback(() => {
    setFilters([])
    Message.success('已清空所有筛选')
  }, [])

  // 处理列配置
  const processedColumns = useMemo(() => {
    return (columns || []).map((col: any) => {
      const key = col.key || col.dataIndex

      // 添加排序
      const isSortable = col.sorteable !== false && !col.key?.includes('action')
      if (isSortable) {
        return {
          ...col,
          sortOrder: sortConfig?.field === key ? sortConfig!.order : null,
          onSort: (_a: any, _b: any) => {
            const newOrder: SortOrder = sortConfig?.field === key
              ? sortConfig!.order === 'asc' ? 'desc' : 'asc'
              : 'asc'
            setSort(key, newOrder)
            return 0
          },
        }
      }

      return col
    })
  }, [columns, sortConfig, setSort])

  // 过滤和排序后的数据
  const processedData = useMemo(() => {
    let result = [...data]

    // 应用筛选
    for (const filter of filters) {
      result = result.filter((item) => {
        const value = (item as any)[filter.field]
        switch (filter.operator) {
          case 'eq':
            return value === filter.value
          case 'gt':
            return value > (filter.value ?? '')
          case 'lt':
            return value < (filter.value ?? '')
          case 'contains':
            return String(value).includes(String(filter.value))
          default:
            return value === filter.value
        }
      })
    }

    // 应用排序
    if (sortConfig) {
      const { field, order } = sortConfig
      result.sort((a, b) => {
        const aVal = (a as any)[field]
        const bVal = (b as any)[field]

        if (aVal === bVal) return 0
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        const cmp = aVal < bVal ? -1 : 1
        return order === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [data, filters, sortConfig])

  // 活跃筛选信息
  const activeFiltersInfo = useMemo(() => {
    return filters.map((filter) => {
      const col = columns?.find((c: any) => (c.key || c.dataIndex) === filter.field)
      return {
        field: filter.field,
        label: typeof col?.title === 'string' ? col.title : filter.field,
        value: String(filter.value),
      }
    })
  }, [filters, columns])

  // 设置菜单
  const settingsMenu = useMemo(() => (
    <div className={styles['advanced-table-settings']}>
      <div className={styles['advanced-table-settings__section']}>
        <div className={styles['advanced-table-settings__title']}>显示</div>
        <label className={styles['advanced-table-settings__item']}>
          <input
            type="checkbox"
            checked={stripe}
            onChange={toggleStripe}
          />
          斑马纹
        </label>
      </div>

      <div className={styles['advanced-table-settings__section']}>
        <div className={styles['advanced-table-settings__title']}>密度</div>
        <div className={styles['advanced-table-settings__sizes']}>
          {(['mini', 'small', 'medium'] as const).map((s) => (
            <Button
              key={s}
              type={size === s ? 'primary' : 'secondary'}
              size="mini"
              onClick={() => setSize(s)}
            >
              {s === 'mini' ? '紧凑' : s === 'small' ? '默认' : '舒适'}
            </Button>
          ))}
        </div>
      </div>
    </div>
  ), [stripe, toggleStripe, size, setSize])

  return {
    processedColumns,
    size,
    setSize,
    stripe,
    toggleStripe,
    sortConfig,
    setSort,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    processedData,
    hasActiveFilters: filters.length > 0,
    activeFiltersInfo,
    settingsMenu,
  }
}

// 表格设置按钮
interface AdvancedTableSettingsButtonProps {
  settingsMenu: React.ReactNode
  sortConfig: SortConfig | null
  onClearSort?: () => void
  className?: string
}

export function AdvancedTableSettingsButton({
  settingsMenu,
  sortConfig: _sortConfig,
  onClearSort: _onClearSort,
  className = '',
}: AdvancedTableSettingsButtonProps) {
  return (
    <Dropdown
      trigger="click"
      position="bl"
      droplist={settingsMenu}
    >
      <Button icon={<IconSettings />} type="text" size="small" className={className}>
        设置
      </Button>
    </Dropdown>
  )
}

// 排序指示器
interface SortIndicatorProps {
  sortOrder: SortOrder
  onClick?: () => void
}

export function SortIndicator({ sortOrder, onClick }: SortIndicatorProps) {
  if (!sortOrder) {
    return (
      <span className={styles['sort-indicator'] + ' ' + styles['sort-indicator--none']} onClick={onClick}>
        <IconSortAscending />
      </span>
    )
  }

  return (
    <span className={`${styles['sort-indicator']} ${styles[`sort-indicator--${sortOrder}`]}`} onClick={onClick}>
      {sortOrder === 'asc' ? <IconSortAscending /> : <IconSortDescending />}
    </span>
  )
}

// 活跃筛选标签
interface ActiveFiltersBarProps {
  filters: Array<{ field: string; label: string; value: string }>
  onRemove: (field: string) => void
  onClearAll: () => void
}

export function ActiveFiltersBar({ filters, onRemove, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) return null

  return (
    <div className={styles['active-filters-bar']}>
      <span className={styles['active-filters-bar__label']}>已筛选：</span>
      {filters.map((filter) => (
        <span key={filter.field} className={styles['active-filters-bar__tag']}>
          {filter.label}: {filter.value}
          <IconClose className={styles['active-filters-bar__close']} onClick={() => onRemove(filter.field)} />
        </span>
      ))}
      <Button type="text" size="mini" onClick={onClearAll}>
        清空
      </Button>
    </div>
  )
}

export default useAdvancedTable
