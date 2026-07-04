import { useState, useEffect, useRef } from 'react'
import { Popover, List, Button, Badge, Empty, Typography, Spin } from '@arco-design/web-react'
import { IconNotification, IconEmpty, IconRight } from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notification'
import type { Notification } from '@/api/notification'
import styles from './notification-center.module.css'
const { Text } = Typography

interface NotificationCenterProps {
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | 'lt' | 'lb' | 'rt' | 'rb'
}

function getTypeClass(type: string): string {
  const classMap: Record<string, string> = {
    success: styles['notification-center__item-type--success'],
    warning: styles['notification-center__item-type--warning'],
    error: styles['notification-center__item-type--error'],
    info: styles['notification-center__item-type--info'],
    system: styles['notification-center__item-type--system'],
    announcement: styles['notification-center__item-type--announcement'],
    approval: styles['notification-center__item-type--approval'],
    attendance: styles['notification-center__item-type--attendance'],
  }
  return classMap[type] || styles['notification-center__item-type--info']
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

export function NotificationCenter({ placement = 'br' }: NotificationCenterProps) {
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className={styles['notification-center__title']}>消息通知</span>
          {unreadCount > 0 && (
            <span className={styles['notification-center__badge-count']}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className={styles['notification-center__actions']}>
          <Button
            type="text"
            size="mini"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className={styles['notification-center__mark-all']}
          >
            全部已读
          </Button>
        </div>
      </div>
      <div className={styles['notification-center__list']} ref={listRef}>
        {loading && notifications.length === 0 ? (
          <div className={styles['notification-center__loading']}>
            <Spin size={24} />
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles['notification-center__empty']}>
            <Empty
              icon={<IconEmpty style={{ fontSize: 56, color: 'var(--text-color-disabled)' }} />}
              description={
                <Text type="secondary" style={{ fontSize: 13 }}>暂无通知消息</Text>
              }
            />
          </div>
        ) : (
          <List size="small" bordered={false} split={false}>
            {notifications.slice(0, 10).map((item) => (
              <List.Item
                key={item.id}
                className={`${styles['notification-center__item']} ${!item.isRead ? styles['notification-center__item--unread'] : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <div className={styles['notification-center__item-content']}>
                  <div className={styles['notification-center__item-header']}>
                    <span className={`${styles['notification-center__item-type']} ${getTypeClass(item.type)}`}>
                      {getTypeLabel(item.type)}
                    </span>
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
          <Button
            type="text"
            size="small"
            onClick={handleViewAll}
            className={styles['notification-center__footer-btn']}
          >
            查看全部通知 <IconRight style={{ fontSize: 12 }} />
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
        <span
          className={styles['layout-header__icon']}
          role="status"
          aria-live="polite"
          aria-label={`消息通知${unreadCount > 0 ? `，${unreadCount}条未读` : ''}`}
        >
          <IconNotification />
        </span>
      </Badge>
    </Popover>
  )
}

export default NotificationCenter
