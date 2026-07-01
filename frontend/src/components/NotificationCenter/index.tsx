import { useState, useEffect, useRef } from 'react'
import { Popover, List, Button, Badge, Empty, Tag, Space, Typography, Spin } from '@arco-design/web-react'
import { IconNotification, IconEmpty, IconRight } from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notification'
import type { Notification } from '@/api/notification'
import styles from './notification-center.module.css'
const { Text } = Typography

interface NotificationCenterProps {
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
}

function getTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    success: 'green',
    warning: 'orange',
    error: 'red',
    info: 'blue',
    system: 'arcoblue',
    announcement: 'purple',
    approval: 'orange',
    attendance: 'green',
  }
  return colorMap[type] || 'blue'
}

function getTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    success: '成功',
    warning: '警告',
    error: '错误',
    info: '通知',
    system: '系统',
    announcement: '公告',
    approval: '审批',
    attendance: '考勤',
  }
  return labelMap[type] || '通知'
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString()
}

export function NotificationCenter({ placement = 'bottomRight' }: NotificationCenterProps) {
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, loaded, markAsRead, markAllAsRead, fetchNotifications } = useNotificationStore()
  const [visible, setVisible] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible && !loaded) {
      fetchNotifications()
    }
  }, [visible, loaded, fetchNotifications])

  const handleItemClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
  }

  const handleViewAll = () => {
    setVisible(false)
    navigate('/notification/list')
  }

  const content = (
    <div className={styles['notification-center']}>
      <div className={styles['notification-center__header']}>
        <span className={styles['notification-center__title']}>消息通知</span>
        <Space>
          <Button type="text" size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            全部已读
          </Button>
        </Space>
      </div>
      <div className={styles['notification-center__list']} ref={listRef}>
        {loading && notifications.length === 0 ? (
          <div className={styles['notification-center__loading']}>
            <Spin size={20} />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            icon={<IconEmpty style={{ fontSize: 48 }} />}
            description="暂无通知消息"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <List size="small" bordered={false}>
            {notifications.slice(0, 10).map((item) => (
              <List.Item
                key={item.id}
                className={`${styles['notification-center__item']} ${!item.isRead ? styles['notification-center__item--unread'] : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <div className={styles['notification-center__item-content']}>
                  <div className={styles['notification-center__item-header']}>
                    <Tag color={getTypeColor(item.type)} size="small">
                      {getTypeLabel(item.type)}
                    </Tag>
                    <Text type="secondary" className={styles['notification-center__item-time']}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </div>
                  <div className={styles['notification-center__item-title']}>{item.title}</div>
                  <div className={styles['notification-center__item-body']}>{item.content}</div>
                </div>
                {!item.isRead && <div className={styles['notification-center__dot']} />}
              </List.Item>
            ))}
          </List>
        )}
      </div>
      {notifications.length > 0 && (
        <div className={styles['notification-center__footer']}>
          <Button type="text" size="small" onClick={handleViewAll}>
            查看全部 <IconRight style={{ fontSize: 12 }} />
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      position={placement}
      className={styles['notification-center__popover']}
      onVisibleChange={setVisible}
    >
      <Badge count={unreadCount} dot={unreadCount > 99}>
        <span className={styles['layout-header__icon']} role="status" aria-live="polite" aria-label={`消息通知${unreadCount > 0 ? `，${unreadCount}条未读` : ''}`}>
          <IconNotification />
        </span>
      </Badge>
    </Popover>
  )
}

export default NotificationCenter
