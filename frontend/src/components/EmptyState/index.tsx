import { ReactNode } from 'react'
import { Empty, Button, Typography } from '@arco-design/web-react'
import {
  IconFile,
  IconSearch,
  IconFolder,
  IconLock,
} from '@arco-design/web-react/icon'
import './index.css'

const { Text } = Typography

export interface EmptyStateProps {
  type?: 'default' | 'search' | 'folder' | 'permission' | 'custom'
  title?: string
  description?: string
  icon?: ReactNode
  action?: {
    text: string
    onClick: () => void
  }
}

const iconMap = {
  default: IconFile,
  search: IconSearch,
  folder: IconFolder,
  permission: IconLock,
}

export function EmptyState({
  type = 'default',
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  const IconComponent = type !== 'custom' ? iconMap[type] : null

  return (
    <div className="empty-state">
      <Empty
        icon={icon || (IconComponent && <IconComponent className="empty-state__icon" />)}
        description={
          <div className="empty-state__description">
            {title && (
              <Text bold className="empty-state__title">
                {title}
              </Text>
            )}
            {description && <Text type="secondary">{description}</Text>}
            {action && (
              <Button type="primary" className="empty-state__action" onClick={action.onClick}>
                {action.text}
              </Button>
            )}
          </div>
        }
      />
    </div>
  )
}

export interface TableEmptyProps {
  loading?: boolean
  dataLength?: number
  searchKeyword?: string
  onClearSearch?: () => void
  action?: {
    text: string
    onClick: () => void
  }
}

export function TableEmpty({
  loading,
  dataLength,
  searchKeyword,
  onClearSearch,
  action,
}: TableEmptyProps) {
  if (loading) {
    return null
  }

  if (searchKeyword) {
    return (
      <EmptyState
        type="search"
        title={`未找到"${searchKeyword}"相关结果`}
        description="请尝试其他关键词或"
        action={
          onClearSearch
            ? { text: '清除搜索', onClick: onClearSearch }
            : action
        }
      />
    )
  }

  return (
    <EmptyState
      type="folder"
      title="暂无数据"
      description="还没有任何数据"
      action={action}
    />
  )
}
