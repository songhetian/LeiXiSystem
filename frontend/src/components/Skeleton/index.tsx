import { Skeleton } from '@arco-design/web-react'
import styles from './index.module.css'
interface TableSkeletonProps {
  /** 列数 */
  columns?: number
  /** 行数 */
  rows?: number
  /** 是否显示表头 */
  showHeader?: boolean
  /** 是否显示操作列 */
  showActions?: boolean
  /** 表头高度 */
  headerHeight?: number
  /** 行高度 */
  rowHeight?: number
}

/**
 * 表格骨架屏组件
 *
 * @example
 * <TableSkeleton columns={5} rows={8} />
 */
export function TableSkeleton({
  columns = 5,
  rows = 8,
  showHeader = true,
  showActions = true,
  headerHeight = 48,
  rowHeight = 56,
}: TableSkeletonProps) {
  const actualColumns = showActions ? columns + 1 : columns

  return (
    <div className={styles['table-skeleton']}>
      {/* 表头 */}
      {showHeader && (
        <div className={styles['table-skeleton__header']} style={{ height: headerHeight }}>
          {Array.from({ length: actualColumns }).map((_, i) => (
            <Skeleton.Text key={i} style={{ width: i === actualColumns - 1 && showActions ? '100px' : '80%' }} />
          ))}
        </div>
      )}

      {/* 表体 */}
      <div className={styles['table-skeleton__body']}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className={styles['table-skeleton__row']} style={{ height: rowHeight }}>
            {Array.from({ length: actualColumns }).map((_, colIndex) => (
              <div key={colIndex} className={styles['table-skeleton__cell']}>
                {colIndex === 0 ? (
                  <Skeleton.Text style={{ width: '40px' }} />
                ) : colIndex === actualColumns - 1 && showActions ? (
                  <div className={styles['table-skeleton__actions']}>
                    <Skeleton.Text style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                    <Skeleton.Text style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                  </div>
                ) : (
                  <Skeleton.Text style={{ width: colIndex % 3 === 0 ? '100%' : '60%' }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

interface FilterBarSkeletonProps {
  /** 筛选项数量 */
  filters?: number
  /** 是否显示操作按钮 */
  showActions?: boolean
}

/**
 * 筛选栏骨架屏组件
 *
 * @example
 * <FilterBarSkeleton filters={3} />
 */
export function FilterBarSkeleton({
  filters = 3,
  showActions = true,
}: FilterBarSkeletonProps) {
  return (
    <div className={styles['filter-bar-skeleton']}>
      <div className={styles['filter-bar-skeleton__filters']}>
        {Array.from({ length: filters }).map((_, i) => (
          <div key={i} className={styles['filter-bar-skeleton__filter']}>
            <Skeleton.Text style={{ width: '60px', height: '14px' }} />
            <Skeleton.Text style={{ width: '180px', height: '32px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
      {showActions && (
        <div className={styles['filter-bar-skeleton__actions']}>
          <Skeleton.Text style={{ width: '64px', height: '32px', borderRadius: '4px' }} />
          <Skeleton.Text style={{ width: '64px', height: '32px', borderRadius: '4px' }} />
        </div>
      )}
    </div>
  )
}

interface CardSkeletonProps {
  /** 是否显示标题 */
  showTitle?: boolean
  /** 内容行数 */
  rows?: number
  /** 是否显示统计卡片样式 */
  showStats?: boolean
  /** 统计项数量 */
  statsCount?: number
}

/**
 * 卡片骨架屏组件
 *
 * @example
 * <CardSkeleton showStats statsCount={4} />
 */
export function CardSkeleton({
  showTitle = true,
  rows = 3,
  showStats = false,
  statsCount = 4,
}: CardSkeletonProps) {
  return (
    <div className={styles['card-skeleton']}>
      {showTitle && (
        <div className={styles['card-skeleton__header']}>
          <Skeleton.Text style={{ width: '120px', height: '20px' }} />
        </div>
      )}

      {showStats ? (
        <div className={styles['card-skeleton__stats']}>
          {Array.from({ length: statsCount }).map((_, i) => (
            <div key={i} className={styles['card-skeleton__stat']}>
              <Skeleton.Text style={{ width: '60px', height: '14px' }} />
              <Skeleton.Text style={{ width: '80px', height: '32px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles['card-skeleton__content']}>
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton.Text
              key={i}
              style={{ width: i === 0 ? '80%' : '60%', height: '16px' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface PageHeaderSkeletonProps {
  /** 是否显示描述 */
  showDescription?: boolean
  /** 是否显示操作按钮 */
  showActions?: boolean
}

/**
 * 页面头部骨架屏组件
 */
export function PageHeaderSkeleton({
  showDescription = true,
  showActions = true,
}: PageHeaderSkeletonProps) {
  return (
    <div className={styles['page-header-skeleton']}>
      <div className={styles['page-header-skeleton__row']}>
        <div className={styles['page-header-skeleton__title']}>
          <Skeleton.Text style={{ width: '120px', height: '24px' }} />
        </div>
        <div className={styles['page-header-skeleton__extra']}>
          {showActions && (
            <>
              <Skeleton.Text style={{ width: '80px', height: '32px', borderRadius: '4px' }} />
              <Skeleton.Text style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
            </>
          )}
        </div>
      </div>
      {showDescription && (
        <Skeleton.Text style={{ width: '300px', height: '14px', marginTop: '8px' }} />
      )}
    </div>
  )
}

export default TableSkeleton