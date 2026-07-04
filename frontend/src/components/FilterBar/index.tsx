import { ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@arco-design/web-react'
import { IconSearch, IconRefresh, IconDown, IconUp } from '@arco-design/web-react/icon'
import styles from './index.module.css'

interface FilterBarProps {
  filters: ReactNode
  advancedFilters?: ReactNode
  onSearch: () => void
  onReset: () => void
  searchText?: string
  resetText?: string
  /** 是否在输入框中启用 Enter 键触发搜索，默认 true */
  enableEnterSearch?: boolean
  className?: string
}

function FilterBar({
  filters,
  advancedFilters,
  onSearch,
  onReset,
  searchText = '查询',
  resetText = '重置',
  enableEnterSearch = true,
  className = '',
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)
  const advancedRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState(0)

  // Measure advanced filters content height for smooth animation
  useEffect(() => {
    if (!advancedRef.current) return

    const el = advancedRef.current
    if (expanded) {
      // Measure actual scrollHeight then set it
      setMaxHeight(el.scrollHeight)
    } else {
      setMaxHeight(0)
    }
  }, [expanded])

  // Re-measure on resize to handle dynamic content
  useEffect(() => {
    if (!advancedFilters || !expanded) return

    const handleResize = () => {
      if (advancedRef.current) {
        setMaxHeight(advancedRef.current.scrollHeight)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [advancedFilters, expanded])

  // Listen for Enter key in input fields to trigger search
  useEffect(() => {
    if (!enableEnterSearch) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return

      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (isInput && !target.closest('button')) {
        e.preventDefault()
        onSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableEnterSearch, onSearch])

  return (
    <div className={`${styles['filter-bar']} ${className}`}>
      {/* Basic filters — always visible, CSS Grid */}
      <div className={styles['filter-bar__filters']}>{filters}</div>

      {/* Advanced filters — collapsible with smooth max-height transition */}
      {advancedFilters && (
        <div
          ref={advancedRef}
          className={styles['filter-bar__advanced-wrapper']}
          style={{ maxHeight }}
        >
          <div className={styles['filter-bar__advanced']}>{advancedFilters}</div>
        </div>
      )}

      {/* Actions row: search / reset / expand toggle */}
      <div className={styles['filter-bar__actions']}>
        <Button type="primary" icon={<IconSearch />} onClick={onSearch}>
          {searchText}
        </Button>
        <Button type="secondary" icon={<IconRefresh />} onClick={onReset}>
          {resetText}
        </Button>
        {advancedFilters && (
          <button
            type="button"
            className={styles['filter-bar__toggle']}
            onClick={() => setExpanded(prev => !prev)}
          >
            <span>{expanded ? '收起高级搜索' : '展开高级搜索'}</span>
            {expanded ? <IconUp style={{ fontSize: 14 }} /> : <IconDown style={{ fontSize: 14 }} />}
          </button>
        )}
      </div>
    </div>
  )
}

export default FilterBar
