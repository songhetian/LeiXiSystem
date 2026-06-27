import { useState } from 'react'
import {
  Card,
  List,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Form,
  Message,
  Tabs,
  Badge,
  Avatar,
  Divider,
} from '@arco-design/web-react'
import {
  IconNotification,
  IconMessage,
  IconCalendar,
  IconFile,
  IconCheck,
} from '@arco-design/web-react/icon'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface Notification {
  id: number
  title: string
  content: string
  type: 'system' | 'approval' | 'attendance' | 'announcement'
  isRead: boolean
  time: string
}

const mockData: Notification[] = [
  { id: 1, title: '考勤异常提醒', content: '您今天有1次迟到记录，请及时处理。', type: 'attendance', isRead: false, time: '10分钟前' },
  { id: 2, title: '审批通过通知', content: '您的请假申请已通过审批。', type: 'approval', isRead: false, time: '30分钟前' },
  { id: 3, title: '系统公告', content: '6月25日系统将进行维护升级，预计1小时。', type: 'system', isRead: true, time: '2小时前' },
  { id: 4, title: '报销审批提醒', content: '您有一笔报销申请等待审批。', type: 'approval', isRead: true, time: '昨天' },
  { id: 5, title: '排班更新通知', content: '您下周的排班已更新，请查看。', type: 'attendance', isRead: true, time: '2天前' },
  { id: 6, title: '年假提醒', content: '您今年还有7天年假未使用。', type: 'system', isRead: true, time: '3天前' },
]

const typeConfig: Record<string, { text: string; color: string; icon: any }> = {
  system: { text: '系统', color: 'blue', icon: IconNotification },
  approval: { text: '审批', color: 'orange', icon: IconFile },
  attendance: { text: '考勤', color: 'green', icon: IconCalendar },
  announcement: { text: '公告', color: 'purple', icon: IconMessage },
}

function ListPage() {
  const [data, setData] = useState<Notification[]>(mockData)
  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')

  const unreadCount = data.filter((d) => !d.isRead).length

  const handleRead = (id: number) => {
    setData(data.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
  }

  const handleReadAll = () => {
    setData(data.map((item) => ({ ...item, isRead: true })))
    Message.success('已全部标记为已读')
  }

  const filteredData = data.filter((item) => {
    if (activeTab !== 'all' && item.type !== activeTab) return false
    if (searchText && !item.title.includes(searchText)) return false
    return true
  })

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="all" title={`全部 (${data.length})`} />
          <TabPane key="unread" title={<Badge count={unreadCount}><span>未读</span></Badge>} />
          <TabPane key="system" title="系统" />
          <TabPane key="approval" title="审批" />
          <TabPane key="attendance" title="考勤" />
        </Tabs>
      </Card>

      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Form layout="inline">
            <FormItem>
              <Input.Search
                style={{ width: 250 }}
                placeholder="搜索消息"
                value={searchText}
                onChange={setSearchText}
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

        <List
          dataSource={filteredData}
          render={(item) => {
            const config = typeConfig[item.type]
            const IconComp = config.icon
            return (
              <List.Item
                style={{
                  opacity: item.isRead ? 0.7 : 1,
                  background: item.isRead ? 'transparent' : 'var(--color-fill-2)',
                  marginBottom: 8,
                  borderRadius: 8,
                  padding: '12px 16px',
                }}
                onClick={() => handleRead(item.id)}
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
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <span>{item.content}</span>
                      <span style={{ color: '#86909C', fontSize: 12 }}>{item.time}</span>
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      </Card>
    </div>
  )
}

export default ListPage
