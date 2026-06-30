import { ReactNode } from 'react'
import { Spin, Typography } from '@arco-design/web-react'
import './index.css'

const { Text } = Typography

export interface LoadingOverlayProps {
  loading?: boolean
  tip?: string
  children?: ReactNode
  fullscreen?: boolean
}

export function LoadingOverlay({
  loading = true,
  tip,
  children,
  fullscreen = false,
}: LoadingOverlayProps) {
  if (!loading) {
    return <>{children}</>
  }

  const content = (
    <div className={`loading-overlay${fullscreen ? ' loading-overlay--fullscreen' : ''}`}>
      <Spin size={32} />
      {tip && (
        <Text type="secondary" className="loading-overlay__tip">
          {tip}
        </Text>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="loading-fullscreen">
        {content}
      </div>
    )
  }

  return content
}

export interface PageLoadingProps {
  tip?: string
}

export function PageLoading({ tip = '页面加载中...' }: PageLoadingProps) {
  return (
    <div className="page-loading">
      <Spin size={40} />
      <Text type="secondary">{tip}</Text>
    </div>
  )
}

export interface SkeletonProps {
  rows?: number
  height?: number | string
  active?: boolean
}

export function Skeleton({ rows = 3, height = 40, active = true }: SkeletonProps) {
  return (
    <div className="skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={active ? 'skeleton-row skeleton-row--active' : 'skeleton-row'}
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            marginBottom: index < rows - 1 ? 12 : 0,
          }}
        />
      ))}
    </div>
  )
}
