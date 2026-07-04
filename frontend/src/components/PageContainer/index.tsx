import { ReactNode } from 'react'
import { Breadcrumb, Space, Spin } from '@arco-design/web-react'
import styles from './page-container.module.css'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface PageContainerProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  extra?: ReactNode
  loading?: boolean
  onRefresh?: () => void
  children: ReactNode
  /** 是否使用白底卡片包裹，默认 true */
  card?: boolean
}

/**
 * Arco Design Pro 风格页面容器
 * 统一所有页面的布局：面包屑 + 标题行 + 内容区（白底卡片）
 */
export default function PageContainer({
  title, description, breadcrumbs, extra, loading, onRefresh, children, card = true,
}: PageContainerProps) {
  return (
    <div className={styles['lx-page']}>
      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className={styles['lx-page__breadcrumb']}>
          {breadcrumbs.map((b, i) => (
            <Breadcrumb.Item key={i} href={b.path}>{b.label}</Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}

      {/* Header Row */}
      <div className={styles['lx-page__header']}>
        <div className={styles['lx-page__title-group']}>
          <h2 className={styles['lx-page__title']}>{title}</h2>
          {description && <p className={styles['lx-page__desc']}>{description}</p>}
        </div>

        <Space>
          {extra && <div className={styles['lx-page__extra']}>{extra}</div>}
        </Space>
      </div>

      {/* Content */}
      <Spin loading={loading} tip="加载中...">
        <div className={card ? styles['lx-page__card'] : styles['lx-page__body']}>
          {children}
        </div>
      </Spin>
    </div>
  )
}
