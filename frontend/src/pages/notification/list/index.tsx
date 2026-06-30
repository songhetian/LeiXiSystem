import { useState, useEffect } from 'react'
import './index.css';
import {
  Card,
  List,
  Button,
  Tag,
  Space,
  Input,
  Form,
  Message,
  Tabs,
  Badge,
  Avatar,
  Spin,
} from '@arco-design/web-react'
import {
  IconNotification,
  IconMessage,
  IconCalendar,
  IconFile,
  IconCheck,
} from '@arco-design/web-react/icon'
import { getNotificationList, markNotificationRead, markAllNotificationsRead } from '@/api/notification'
import type { Notification } from '@/api/notification'

const FormItem = Form.Item
const TabPane = Tabs.TabPane

const typeConfig: Record<string, { text: string; color: string; icon: any }> = {
  system: { text: '系统', color: 'blue', icon: IconNotification },
  approval: { text: '审批', color: 'orange', icon: IconFile },
  attendance: { text: '考勤', color: 'green', icon: IconCalendar },
  announcement: { text: '公告', color: 'purple', icon: IconMessage },
}

function ListPage() {
  const [data, setData] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (activeTab === 'unread') params.isRead = false
      else if (activeTab !== 'all') params.type = activeTab

      const res = await getNotificationList(params)
      let list = res.data.list
      if (searchText) {
        list = list.filter(
          (item) =>
            item.title.includes(searchText) || item.content.includes(searchText),
        )
      }
      setData(list)
      setUnreadCount(res.data.unreadCount)
      setPagination({
        current: page,
        pageSize,
        total: res.data.total,
      })
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleRead = async (id: number) => {
    try {
      await markNotificationRead(id)
      setData(data.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
      if (unreadCount > 0) setUnreadCount(unreadCount - 1)
    } catch {
      // error handled by interceptor
    }
  }

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead()
      setData(data.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
      Message.success('已全部标记为已读')
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  return (
    <div className="notification-list">
      <Card bordered={false} className="notification-list__card">
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="all" title={`全部 (${pagination.total})`} />
          <TabPane
            key="unread"
            title={
              <Badge count={unreadCount}>
                <span>未读</span>
              </Badge>
            }
          />
          <TabPane key="system" title="系统" />
          <TabPane key="approval" title="审批" />
          <TabPane key="attendance" title="考勤" />
        </Tabs>
      </Card>

      <Card bordered={false}>
        <div className="notification-list__toolbar">
          <Form layout="inline">
            <FormItem>
              <Input.Search
                className="notification-list__search"
                placeholder="搜索消息"
                value={searchText}
                onChange={setSearchText}
                onSearch={handleSearch}
                allowClear
              />
            </FormItem>
          </Form>
          <Space size="small">
            <Button type="text" icon={<IconCheck />} onClick={handleReadAll}>
              全部已读
            </Button>
          </Space>
        </div>

        <Spin loading={loading}>
          <List
            dataSource={data}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              size: 'small',
              onChange: (page, pageSize) => fetchData(page, pageSize),
            }}
            render={(item) => {
              const config = typeConfig[item.type] || {
                text: item.type,
                color: 'gray',
                icon: IconNotification,
              }
              const IconComp = config.icon
              return (
                <List.Item
                  style={{
                    opacity: item.isRead ? 0.7 : 1,
                    background: item.isRead ? 'transparent' : 'var(--color-fill-2)',
                    marginBottom: 8,
                    borderRadius: 8,
                    padding: '12px 16px',
                    cursor: 'pointer',
                  }}
                  onClick={() => !item.isRead && handleRead(item.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        <IconComp />
                      </Avatar>
                    }
                    title={
                      <Space size="small">
                        {item.title}
                        {!item.isRead && <Badge color="#F53F3F" />}
                        <Tag color={config.color} size="small">
                          {config.text}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4} className="notification-list__space-full">
                        <span>{item.content}</span>
                        <span className="notification-list__time">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )
            }}
            noDataElement={<div className="notification-list__empty">暂无消息</div>}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default ListPage
