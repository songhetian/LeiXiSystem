import { useEffect, useState } from 'react'
import { Card, Table, Tag, Statistic, List, Typography, Space, Spin } from '@arco-design/web-react'
import Row from '@arco-design/web-react/es/Grid/row'
import Col from '@arco-design/web-react/es/Grid/col'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats, getAttendanceOverview, getDashboardTodos } from '@/api/dashboard'
import type { DashboardStats, AttendanceOverview, TodoItem } from '@/api/dashboard'
import './index.css'

const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
}

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, attRes, todosRes] = await Promise.all([
        getDashboardStats(),
        getAttendanceOverview(),
        getDashboardTodos(),
      ])
      setStats(statsRes.data)
      setAttendance(attRes.data)
      setTodos(todosRes.data)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
    },
    {
      title: '今日状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '打卡时间',
      dataIndex: 'checkIn',
      width: 120,
      render: (value?: string) => value || '-',
    },
  ]

  return (
    <div className="dashboard-wrapper">
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Title heading={4} className="dashboard-title">
            欢迎回来 👋
          </Title>
          <Text type="secondary">今天是工作日，祝您工作愉快！</Text>
        </div>

        <Row gutter={16}>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats}>
              <Statistic title="员工总数" value={stats?.totalUsers ?? 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats}>
              <Statistic title="今日出勤" value={stats?.todayAttendance ?? 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats}>
              <Statistic title="待审批" value={stats?.pendingApprovals ?? 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats}>
              <Statistic title="部门数量" value={stats?.totalDepartments ?? 0} />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={16}>
            <Card
              bordered={false}
              title="今日考勤概览"
              extra={<a onClick={() => navigate('/attendance/records')}>查看全部</a>}
              loading={loading && !attendance}
            >
              <Table
                columns={columns}
                data={attendance?.recentList || []}
                pagination={false}
                size="small"
                noDataElement={<div className="dashboard-empty">暂无数据</div>}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} title="待办事项" extra={<a onClick={() => navigate('/approval/pending')}>全部</a>}>
              <Spin loading={loading && todos.length === 0}>
                <List
                  size="small"
                  dataSource={todos}
                  render={(item) => (
                    <List.Item key={`${item.type}-${item.id}`}>
                      <List.Item.Meta
                        title={item.title}
                        description={item.typeName}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </Text>
                    </List.Item>
                  )}
                noDataElement={<div className="dashboard-empty">暂无待办</div>}
                />
              </Spin>
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  )
}

export default Dashboard
