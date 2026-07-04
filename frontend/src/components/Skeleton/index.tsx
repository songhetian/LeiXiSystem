import { CSSProperties } from 'react'
import styles from './index.module.css'

interface SkeletonTextProps {
  style?: CSSProperties
  className?: string
}

export function SkeletonText({ style, className = '' }: SkeletonTextProps) {
  return (
    <div
      className={`${styles['skeleton-text']} ${className}`}
      style={style}
    />
  )
}

interface SkeletonImageProps {
  style?: CSSProperties
  className?: string
}

export function SkeletonImage({ style, className = '' }: SkeletonImageProps) {
  return (
    <div
      className={`${styles['skeleton-image']} ${className}`}
      style={style}
    />
  )
}

interface TableSkeletonProps {
  columns?: number
  rows?: number
  showHeader?: boolean
  showActions?: boolean
  headerHeight?: number
  rowHeight?: number
}

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
      {showHeader && (
        <div className={styles['table-skeleton__header']} style={{ height: headerHeight }}>
          {Array.from({ length: actualColumns }).map((_, i) => (
            <SkeletonText key={i} style={{ width: i === actualColumns - 1 && showActions ? '100px' : '80%', height: '16px' }} />
          ))}
        </div>
      )}

      <div className={styles['table-skeleton__body']}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className={styles['table-skeleton__row']} style={{ height: rowHeight }}>
            {Array.from({ length: actualColumns }).map((_, colIndex) => (
              <div key={colIndex} className={styles['table-skeleton__cell']}>
                {colIndex === 0 ? (
                  <SkeletonText style={{ width: '40px', height: '16px' }} />
                ) : colIndex === actualColumns - 1 && showActions ? (
                  <div className={styles['table-skeleton__actions']}>
                    <SkeletonText style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                    <SkeletonText style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                  </div>
                ) : (
                  <SkeletonText style={{ width: colIndex % 3 === 0 ? '100%' : '60%', height: '16px' }} />
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
  filters?: number
  showActions?: boolean
}

export function FilterBarSkeleton({
  filters = 3,
  showActions = true,
}: FilterBarSkeletonProps) {
  return (
    <div className={styles['filter-bar-skeleton']}>
      <div className={styles['filter-bar-skeleton__filters']}>
        {Array.from({ length: filters }).map((_, i) => (
          <div key={i} className={styles['filter-bar-skeleton__filter']}>
            <SkeletonText style={{ width: '60px', height: '14px' }} />
            <SkeletonText style={{ width: '180px', height: '32px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
      {showActions && (
        <div className={styles['filter-bar-skeleton__actions']}>
          <SkeletonText style={{ width: '64px', height: '32px', borderRadius: '4px' }} />
          <SkeletonText style={{ width: '64px', height: '32px', borderRadius: '4px' }} />
        </div>
      )}
    </div>
  )
}

interface CardSkeletonProps {
  showTitle?: boolean
  rows?: number
  showStats?: boolean
  statsCount?: number
}

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
          <SkeletonText style={{ width: '120px', height: '20px' }} />
        </div>
      )}

      {showStats ? (
        <div className={styles['card-skeleton__stats']}>
          {Array.from({ length: statsCount }).map((_, i) => (
            <div key={i} className={styles['card-skeleton__stat']}>
              <SkeletonText style={{ width: '60px', height: '14px' }} />
              <SkeletonText style={{ width: '80px', height: '32px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles['card-skeleton__content']}>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonText
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
  showDescription?: boolean
  showActions?: boolean
}

export function PageHeaderSkeleton({
  showDescription = true,
  showActions = true,
}: PageHeaderSkeletonProps) {
  return (
    <div className={styles['page-header-skeleton']}>
      <div className={styles['page-header-skeleton__row']}>
        <div className={styles['page-header-skeleton__title']}>
          <SkeletonText style={{ width: '120px', height: '24px' }} />
        </div>
        <div className={styles['page-header-skeleton__extra']}>
          {showActions && (
            <>
              <SkeletonText style={{ width: '80px', height: '32px', borderRadius: '4px' }} />
              <SkeletonText style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
            </>
          )}
        </div>
      </div>
      {showDescription && (
        <SkeletonText style={{ width: '300px', height: '14px', marginTop: '8px' }} />
      )}
    </div>
  )
}

export default TableSkeleton
