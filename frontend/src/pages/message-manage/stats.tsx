import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Tabs,
  Space,
  DatePicker,
  Statistic,
  Grid,
  Empty,
} from '@arco-design/web-react'
import {
  IconMessage,
  IconEye,
  IconCalendar,
} from '@arco-design/web-react/icon'
import {
  getMessageStatsOverview,
  getMessageStatsBySender,
} from '@/api/messageStats'
import { PageHeader } from '@/components'
import styles from './stats.module.css'
const TabPane = Tabs.TabPane
const RangePicker = DatePicker.RangePicker
const { Row, Col } = Grid

export default function MessageStats() {
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewData, setOverviewData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const [senderList, setSenderList] = useState<any[]>([])
  const [senderTotal, setSenderTotal] = useState(0)
  const [senderLoading, setSenderLoading] = useState(false)
  const [senderPage, setSenderPage] = useState(1)
  const [senderPageSize, setSenderPageSize] = useState(10)

  const [timeData, setTimeRange] = useState<any[]>([])
  const [_timeLoading] = useState(false)

  const fetchOverview = async () => {
    setOverviewLoading(true)
    try {
      const res = await getMessageStatsOverview()
      if (res.code === 0) {
        setOverviewData(res.data)
      }
    } finally {
      setOverviewLoading(false)
    }
  }

  const fetchSenderStats = async () => {
    setSenderLoading(true)
    try {
      const res = await getMessageStatsBySender({
        page: senderPage,
        pageSize: senderPageSize,
      })
      if (res.code === 0) {
        setSenderList(res.data.list)
        setSenderTotal(res.data.total)
      }
    } finally {
      setSenderLoading(false)
    }
  }

  useEffect(() => {
    fetchOverview()
    fetchSenderStats()
  }, [])

  useEffect(() => {
    fetchSenderStats()
  }, [senderPage, senderPageSize])

  const typeColorMap: Record<string, string> = {
    system: 'blue',
    approval: 'orange',
    attendance: 'green',
    schedule: 'purple',
    payroll: 'gold',
  }

  const typeLabelMap: Record<string, string> = {
    system: '系统通知',
    approval: '审批通知',
    attendance: '考勤通知',
    schedule: '排班通知',
    payroll: '薪资通知',
  }

  const overviewColumns = [
    {
      title: '消息类型',
      dataIndex: 'type',
      render: (v: string) => (
        <Tag color={typeColorMap[v] || 'gray'}>
          {typeLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '发送数量',
      dataIndex: 'count',
      render: (v: number) => <strong>{v}</strong>,
    },
  ]

  const senderColumns = [
    {
      title: '发送人',
      dataIndex: 'senderName',
      width: 150,
    },
    {
      title: '任务数',
      dataIndex: 'taskCount',
      width: 100,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: '总发送人数',
      dataIndex: 'totalSent',
      width: 120,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: '阅读数',
      dataIndex: 'totalRead',
      width: 100,
      render: (v: number) => <Tag color="green">{v}</Tag>,
    },
    {
      title: '阅读率',
      dataIndex: 'readRate',
      render: (_: any, record: any) => {
        const rate = record.totalSent > 0
          ? Math.round((record.totalRead / record.totalSent) * 100)
          : 0
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              flex: 1,
              height: 6,
              background: 'var(--color-fill-3)',
              borderRadius: 3,
              overflow: 'hidden',
              maxWidth: 120,
            }}>
              <div style={{
                width: `${rate}%`,
                height: '100%',
                background: 'var(--color-primary-5)',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{rate}%</span>
          </div>
        )
      },
    },
  ]

  const maxSent = Math.max(...timeData.map(d => d.sent), 1)

  return (
    <div className={styles['message-stats']}>
      <PageHeader title="消息统计" description="查看消息发送、阅读、用户活跃度等统计数据。" />

      <Tabs activeTab={activeTab} onChange={setActiveTab} style={{ marginTop: 16 }}>
        <TabPane key="overview" title="总览统计" />
        <TabPane key="by-time" title="趋势分析" />
        <TabPane key="by-sender" title="发送人排行" />
      </Tabs>

      {activeTab === 'overview' && (
        <div style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic
                  title="总发送量"
                  value={overviewData?.totalSent || 0}
                  prefix={<IconMessage />}
                  loading={overviewLoading}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic
                  title="已阅读"
                  value={overviewData?.totalRead || 0}
                  prefix={<IconEye />}
                  loading={overviewLoading}
                  style={{ color: 'var(--color-green-6)' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic
                  title="未阅读"
                  value={overviewData?.unread || 0}
                  prefix={<IconMessage />}
                  loading={overviewLoading}
                  style={{ color: 'var(--color-orange-6)' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic
                  title="整体阅读率"
                  value={`${overviewData?.readRate || 0}%`}
                  prefix={<IconCalendar />}
                  loading={overviewLoading}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card bordered={false} title="按类型分布">
                <Table
                  loading={overviewLoading}
                  columns={overviewColumns as any}
                  data={overviewData?.byType || []}
                  pagination={false}
                  size="small"
                  border={false}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card bordered={false} title="按优先级分布">
                <Table
                  loading={overviewLoading}
                  columns={[
                    {
                      title: '优先级',
                      dataIndex: 'priority',
                      render: (v: string) => {
                        const map: Record<string, { label: string; color: string }> = {
                          normal: { label: '普通', color: 'gray' },
                          high: { label: '高', color: 'orange' },
                          urgent: { label: '紧急', color: 'red' },
                        }
                        const info = map[v] || { label: v, color: 'gray' }
                        return <Tag color={info.color}>{info.label}</Tag>
                      },
                    },
                    {
                      title: '数量',
                      dataIndex: 'count',
                      render: (v: number) => <strong>{v}</strong>,
                    },
                  ] as any}
                  data={overviewData?.byPriority || []}
                  pagination={false}
                  size="small"
                  border={false}
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {activeTab === 'by-time' && (
        <div style={{ marginTop: 16 }}>
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Space>
              <span>选择时间范围：</span>
              <RangePicker
                style={{ width: 300 }}
                onChange={setTimeRange as any}
              />
            </Space>
          </Card>

          <Card bordered={false} title="发送趋势">
            {timeData.length === 0 ? (
              <Empty description="请选择时间范围查看趋势" />
            ) : (
              <div style={{ padding: '20px 0' }}>
                {timeData.map((item: any) => (
                  <div key={item.date} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}>
                    <div style={{ width: 100, fontSize: 13, color: 'var(--color-text-2)' }}>
                      {item.date}
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        flex: 1,
                        height: 24,
                        background: 'var(--color-fill-2)',
                        borderRadius: 4,
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${(item.sent / maxSent) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--color-primary-4), var(--color-primary-6))',
                          borderRadius: 4,
                          transition: 'width 0.3s',
                        }} />
                        <span style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--color-text-1)',
                        }}>
                          {item.sent} 条
                        </span>
                      </div>
                    </div>
                    <div style={{ width: 80, textAlign: 'right', fontSize: 12 }}>
                      <Tag color="green">{item.readRate}%</Tag>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'by-sender' && (
        <div style={{ marginTop: 16 }}>
          <Card bordered={false}>
            <Table
              loading={senderLoading}
              columns={senderColumns as any}
              data={senderList}
              pagination={{
                current: senderPage,
                pageSize: senderPageSize,
                total: senderTotal,
                onChange: (p, ps) => {
                  setSenderPage(p)
                  setSenderPageSize(ps)
                },
                showTotal: true,
              }}
              border={false}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
