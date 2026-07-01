import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Input,
  Button,
  Space,
  Badge,
  Tag,
  Pagination,
  Spin,
  Message,
  Modal,
} from '@arco-design/web-react'
import {
  IconNotification,
  IconFile,
  IconCalendar,
  IconSchedule,
  IconSafe,
  IconStorage,
  IconCheck,
  IconExclamation,
  IconEmpty,
  IconRefresh,
} from '@arco-design/web-react/icon'
import {
  getNotificationList,
  markNotificationRead,
  markNotificationConfirmed,
  markAllNotificationsRead,
  getNotificationDetail,
} from '@/api/notification'
import { wsClient } from '@/utils/websocket'
import type { Notification } from '@/api/notification'
import styles from './index.module.css'
const Search = Input.Search

interface CategoryItem {
  key: string
  label: string
  icon: any
  iconClass: string
}

const categories: CategoryItem[] = [
  { key: 'all', label: '全部消息', icon: IconStorage, iconClass: 'message-item__icon--system' },
  { key: 'system', label: '系统通知', icon: IconNotification, iconClass: 'message-item__icon--system' },
  { key: 'approval', label: '审批通知', icon: IconFile, iconClass: 'message-item__icon--approval' },
  { key: 'attendance', label: '考勤通知', icon: IconCalendar, iconClass: 'message-item__icon--attendance' },
  { key: 'schedule', label: '排班通知', icon: IconSchedule, iconClass: 'message-item__icon--schedule' },
  { key: 'payroll', label: '薪资通知', icon: IconSafe, iconClass: 'message-item__icon--payroll' },
]

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: '普通', color: 'gray' },
  high: { label: '高', color: 'orange' },
  urgent: { label: '紧急', color: 'red' },
}

function getTypeIcon(type: string) {
  const map: Record<string, any> = {
    system: IconNotification,
    approval: IconFile,
    attendance: IconCalendar,
    schedule: IconSchedule,
    payroll: IconSafe,
  }
  return map[type] || IconNotification
}

function getTypeIconClass(type: string) {
  const map: Record<string, string> = {
    system: 'message-item__icon--system',
    approval: 'message-item__icon--approval',
    attendance: 'message-item__icon--attendance',
    schedule: 'message-item__icon--schedule',
    payroll: 'message-item__icon--payroll',
  }
  return map[type] || 'message-item__icon--system'
}

function formatTime(dateStr: string) {
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

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

// 缓存 key 生成
function getCacheKey(category: string, showUnread: boolean, search: string): string {
  return `${category}:${showUnread}:${search}`
}

interface CacheData {
  list: Notification[]
  total: number
  unreadCount: number
  updatedAt: number
}

export default function MessageCenter() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<Notification | null>(null)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  // 缓存不同查询条件的数据
  const cacheRef = useRef<Map<string, CacheData>>(new Map())
  // 静默刷新定时器
  const silentRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 当前查询的缓存 key
  const currentCacheKey = useMemo(
    () => getCacheKey(activeCategory, showUnreadOnly, searchText),
    [activeCategory, showUnreadOnly, searchText]
  )

  // 加载列表数据
  const fetchList = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const params: any = { page, pageSize }
      if (activeCategory !== 'all') {
        params.type = activeCategory
      }
      if (showUnreadOnly) {
        params.isRead = false
      }
      if (searchText) {
        params.keyword = searchText
      }

      const res = await getNotificationList(params)
      if (res.code === 0) {
        const cacheKey = getCacheKey(activeCategory, showUnreadOnly, searchText)
        const cacheData: CacheData = {
          list: res.data.list,
          total: res.data.total,
          unreadCount: res.data.unreadCount || 0,
          updatedAt: Date.now(),
        }

        // 更新缓存
        cacheRef.current.set(cacheKey, cacheData)
        // 如果是当前视图或静默刷新，更新状态
        if (cacheKey === currentCacheKey || silent) {
          setNotifications(res.data.list)
          setTotal(res.data.total)
          setUnreadCount(res.data.unreadCount || 0)
        }
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeCategory, showUnreadOnly, searchText, page, pageSize, currentCacheKey])

  // 首次加载或切换条件时使用缓存
  useEffect(() => {
    const cached = cacheRef.current.get(currentCacheKey)

    if (cached && Date.now() - cached.updatedAt < 5 * 60 * 1000) {
      // 5 分钟内的缓存直接使用
      setNotifications(cached.list)
      setTotal(cached.total)
      setUnreadCount(cached.unreadCount)
      // 后台静默刷新
      fetchList(true)
    } else {
      // 无缓存或缓存过期，重新加载
      fetchList(false)
    }
  }, [currentCacheKey])

  // 手动刷新
  const handleRefresh = useCallback(() => {
    cacheRef.current.delete(currentCacheKey)
    fetchList(false)
  }, [currentCacheKey, fetchList])

  // WebSocket 实时接收新消息
  useEffect(() => {
    const handleNewNotification = (data: any) => {
      const newNotification: Notification = {
        id: data.id,
        userId: 0,
        type: data.type,
        title: data.title,
        content: data.content,
        priority: data.priority || 'normal',
        isRead: false,
        requiresConfirm: false,
        createdAt: data.createdAt || new Date().toISOString(),
        relatedId: data.relatedId,
        relatedType: data.relatedType,
      }

      // 如果是当前分类的新消息，追加到列表顶部
      if (activeCategory === 'all' || activeCategory === newNotification.type) {
        if (!showUnreadOnly) {
          setNotifications(prev => {
            // 去重
            if (prev.some(n => n.id === newNotification.id)) return prev
            return [newNotification, ...prev]
          })
          setTotal(prev => prev + 1)
        }
        setUnreadCount(prev => prev + 1)
      } else {
        // 不在当前视图，只更新未读数
        setUnreadCount(prev => prev + 1)
      }

      Message.info({
        content: (
          <div>
            <div style={{ fontWeight: 500 }}>{newNotification.title}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              {stripHtml(newNotification.content).slice(0, 50)}
            </div>
          </div>
        ),
        duration: 5,
      })
    }

    const unsubscribe = wsClient.on('notification', handleNewNotification)

    return () => {
      unsubscribe()
    }
  }, [activeCategory, showUnreadOnly])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (silentRefreshTimer.current) {
        clearTimeout(silentRefreshTimer.current)
      }
    }
  }, [])

  const handleSelectItem = async (item: Notification) => {
    setSelectedId(item.id)

    if (!item.isRead) {
      try {
        await markNotificationRead(item.id)
        setNotifications(prev =>
          prev.map(n => (n.id === item.id ? { ...n, isRead: true } : n))
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {
        // ignore
      }
    }

    setDetailLoading(true)
    try {
      const res = await getNotificationDetail(item.id)
      if (res.code === 0) {
        setDetail(res.data)
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmingId) return
    try {
      await markNotificationConfirmed(confirmingId)
      Message.success('确认成功')
      setNotifications(prev =>
        prev.map(n => (n.id === confirmingId ? { ...n, confirmedAt: new Date().toISOString() } : n))
      )
      if (detail && detail.id === confirmingId) {
        setDetail({ ...detail, confirmedAt: new Date().toISOString() })
      }
      setConfirmModalVisible(false)
      setConfirmingId(null)
    } catch {
      // ignore
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      Message.success('已全部标记为已读')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      // 清除所有缓存，强制下次刷新
      cacheRef.current.clear()
    } catch {
      // ignore
    }
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
    setPage(1)
  }

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key)
    setShowUnreadOnly(false)
    setPage(1)
    setSelectedId(null)
    setDetail(null)
  }

  return (
    <div className={styles['message-center']}>
      <div className={styles['message-center__sidebar']}>
        <div className={styles['message-center__sidebar-header']}>消息中心</div>
        <div className={styles['message-center__sidebar-list']}>
          {categories.map(cat => {
            const IconComp = cat.icon
            const isActive = activeCategory === cat.key && !showUnreadOnly
            return (
              <div
                key={cat.key}
                className={`${styles['message-center__sidebar-item']} ${isActive ? styles['message-center__sidebar-item--active'] : ''}`}
                onClick={() => handleCategoryChange(cat.key)}
              >
                <div className={styles['message-center__sidebar-item-icon']}>
                  <IconComp />
                  <span className={styles['message-center__sidebar-item-text']}>{cat.label}</span>
                </div>
              </div>
            )
          })}
          <div
            className={`${styles['message-center__sidebar-item']} ${showUnreadOnly ? styles['message-center__sidebar-item--active'] : ''}`}
            onClick={() => {
              setShowUnreadOnly(!showUnreadOnly)
              setActiveCategory('all')
              setPage(1)
              setSelectedId(null)
              setDetail(null)
            }}
          >
            <div className={styles['message-center__sidebar-item-icon']}>
              <IconExclamation />
              <span className={styles['message-center__sidebar-item-text']}>未读消息</span>
            </div>
            <Badge count={unreadCount} />
          </div>
        </div>
        <div className={styles['message-center__sidebar-footer']}>
          <Button
            type="text"
            size="small"
            long
            onClick={handleMarkAllRead}
            icon={<IconCheck />}
          >
            全部标为已读
          </Button>
        </div>
      </div>

      <div className={styles['message-center__main']}>
        <div className={styles['message-center__toolbar']}>
          <Search
            placeholder="搜索消息标题或内容"
            style={{ width: 280 }}
            allowClear
            onSearch={handleSearch}
          />
          <Space>
            <Tag color="blue">共 {total} 条</Tag>
            {unreadCount > 0 && <Tag color="red">未读 {unreadCount} 条</Tag>}
          </Space>
          <Button
            type="text"
            size="small"
            icon={<IconRefresh />}
            loading={refreshing}
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div className={styles['message-center__list']} style={{ width: 420, borderRight: '1px solid var(--color-border-2)' }}>
            <Spin loading={loading} style={{ display: 'block' }}>
              {notifications.length === 0 ? (
                <div className={styles['message-center__empty']}>
                  <div className={styles['message-center__empty-icon']}><IconEmpty /></div>
                  <div>暂无消息</div>
                  <Button size="small" onClick={handleRefresh} style={{ marginTop: 12 }}>
                    刷新试试
                  </Button>
                </div>
              ) : (
                <>
                  {notifications.map(item => {
                    const IconComp = getTypeIcon(item.type)
                    const iconClass = getTypeIconClass(item.type)
                    const priorityClass = `message-item__priority--${item.priority || 'normal'}`
                    return (
                      <div
                        key={item.id}
                        className={`${styles['message-item']} ${!item.isRead ? styles['message-item--unread'] : ''} ${selectedId === item.id ? styles['message-item--selected'] : ''}`}
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className={`${styles['message-item__priority-tag']} ${styles[priorityClass]}`} />
                        <div className={`${styles['message-item__icon']} ${styles[iconClass]}`}>
                          <IconComp />
                        </div>
                        <div className={styles['message-item__content']}>
                          <div className={styles['message-item__title-row']}>
                            <span className={styles['message-item__title']}>{item.title}</span>
                            <span className={styles['message-item__time']}>{formatTime(item.createdAt)}</span>
                          </div>
                          <div className={styles['message-item__preview']}>
                            {stripHtml(item.content)}
                          </div>
                          <div className={styles['message-item__tags']}>
                            {item.priority && item.priority !== 'normal' && (
                              <Tag color={priorityConfig[item.priority]?.color || 'gray'} size="small">
                                {priorityConfig[item.priority]?.label || item.priority}
                              </Tag>
                            )}
                            {item.requiresConfirm && !item.confirmedAt && (
                              <Tag color="red" size="small">需确认</Tag>
                            )}
                            {item.attachments && item.attachments.length > 0 && (
                              <Tag color="blue" size="small">附件</Tag>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </Spin>
            {total > 0 && (
              <div className={styles['message-center__pagination']}>
                <Pagination
                  total={total}
                  current={page}
                  pageSize={pageSize}
                  onChange={(p) => setPage(p)}
                  showTotal
                  size="small"
                />
              </div>
            )}
          </div>

          <div className={styles['message-center__detail']}>
            {detailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Spin />
              </div>
            ) : detail ? (
              <>
                <div className={styles['message-center__detail-header']}>
                  <div className={styles['message-center__detail-title']}>{detail.title}</div>
                  <div className={styles['message-center__detail-meta']}>
                    <Tag color={priorityConfig[detail.priority || 'normal']?.color || 'gray'}>
                      {priorityConfig[detail.priority || 'normal']?.label || '普通'}
                    </Tag>
                    <span>{new Date(detail.createdAt).toLocaleString('zh-CN')}</span>
                    {detail.requiresConfirm && (
                      <Tag color={detail.confirmedAt ? 'green' : 'red'}>
                        {detail.confirmedAt ? '已确认' : '需确认'}
                      </Tag>
                    )}
                  </div>
                </div>
                <div className={styles['message-center__detail-body']}>
                  <div
                    className={styles['message-center__detail-content']}
                    dangerouslySetInnerHTML={{ __html: detail.content }}
                  />
                  {detail.attachments && detail.attachments.length > 0 && (
                    <div className={styles['message-center__detail-attachments']}>
                      <div className={styles['message-center__detail-attachments-title']}>
                        附件 ({detail.attachments.length})
                      </div>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {detail.attachments.map(att => (
                          <a
                            key={att.id}
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              background: 'var(--color-fill-2)',
                              borderRadius: 4,
                              textDecoration: 'none',
                              color: 'var(--color-text-1)',
                            }}
                          >
                            <IconFile />
                            <span>{att.fileName}</span>
                            {att.fileSize && (
                              <span style={{ color: 'var(--color-text-3)', marginLeft: 'auto', fontSize: 12 }}>
                                {(att.fileSize / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </a>
                        ))}
                      </Space>
                    </div>
                  )}
                </div>
                {detail.requiresConfirm && !detail.confirmedAt && (
                  <div className={styles['message-center__detail-footer']}>
                    <Button
                      type="primary"
                      icon={<IconCheck />}
                      onClick={() => {
                        setConfirmingId(detail.id)
                        setConfirmModalVisible(true)
                      }}
                    >
                      确认已读
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles['message-center__empty']} style={{ height: '100%' }}>
                <div className={styles['message-center__empty-icon']}><IconNotification /></div>
                <div>请选择一条消息查看详情</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal focusLock
        title="确认已读"
        visible={confirmModalVisible}
        onOk={handleConfirm}
        onCancel={() => {
          setConfirmModalVisible(false)
          setConfirmingId(null)
        }}
        okText="确认"
        cancelText="取消"
      >
        <p>确认您已阅读此消息？</p>
      </Modal>
    </div>
  )
}
