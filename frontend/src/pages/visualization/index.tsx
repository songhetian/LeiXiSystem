import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Grid,
  Statistic,
  Tag,
  Space,
  Progress,
  Table,
  Avatar,
  Typography,
} from '@arco-design/web-react'
import {
  IconUser,
  IconCalendar,
  IconClockCircle,
  IconUserGroup,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getDashboardStats, getAttendanceOverview } from '@/api/dashboard'
import './style.css'

const { Row, Col } = Grid
const { Title, Text } = Typography

interface DeptAttendance {
  dept: string
  rate: number
  count: number
}

interface RealtimeRecord {
  time: string
  name: string
  dept: string
  type: 'in' | 'out'
  location: string
}

function Visualization() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stats, setStats] = useState<{ totalUsers?: number; pendingApprovals?: number } | null>(null)
  const [attendanceOverview, setAttendanceOverview] = useState<{ normal?: number; attendanceRate?: number; total?: number; late?: number; early?: number; absent?: number; recentList?: { checkIn?: string; checkOut?: string; name: string; department?: string }[] } | null>(null)
  const [deptData, setDeptData] = useState<DeptAttendance[]>([])
  const [realtimeData, setRealtimeData] = useState<RealtimeRecord[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [statsRes, attendanceRes]: any = await Promise.all([
        getDashboardStats(),
        getAttendanceOverview(),
      ])
      setStats(statsRes.data)
      setAttendanceOverview(attendanceRes.data)

      const recentList = attendanceRes.data?.recentList || []
      setRealtimeData(
        recentList.map((item: any) => ({
          time: item.checkIn || item.checkOut || '--:--:--',
          name: item.name,
          dept: item.department || '-',
          type: item.checkIn ? 'in' : 'out',
          location: '办公区',
        }))
      )
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const columns: TableProps<DeptAttendance>['columns'] = [
    {
      title: '部门',
      dataIndex: 'dept',
      width: 100,
    },
    {
      title: '出勤人数',
      dataIndex: 'count',
      width: 90,
      render: (value: number) => <span className="tabular-nums">{value}人</span>,
    },
    {
      title: '出勤率',
      dataIndex: 'rate',
      render: (value: number) => (
        <Progress percent={value} className="visualization__progress" />
      ),
    },
  ]

  const statCards = [
    { title: '总人数', value: stats?.totalUsers || 0, suffix: '人', color: '#165DFF', icon: IconUserGroup },
    { title: '已出勤', value: attendanceOverview?.normal || 0, suffix: '人', color: '#00B42A', icon: IconUser },
    { title: '出勤率', value: Number(attendanceOverview?.attendanceRate || 0), suffix: '%', color: '#722ED1', icon: IconCalendar },
    { title: '待审批', value: stats?.pendingApprovals || 0, suffix: '条', color: '#FF7D00', icon: IconClockCircle },
  ]

  return (
    <div className="visualization">
      <div className="visualization__header">
        <Title heading={3} className="visualization__title-margin">
          人事考勤数据可视化
        </Title>
        <Text type="secondary">
          {currentTime.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}{' '}
          {currentTime.toLocaleTimeString('zh-CN')}
        </Text>
      </div>

      <Row gutter={16} className="visualization__row">
        {statCards.map((item, index) => {
          const IconComp = item.icon
          return (
            <Col span={6} key={index}>
              <Card bordered={false} className="visualization__stat-card">
                <Space size="large" className="visualization__stat-content">
                  <div
                    className="visualization__stat-icon"
                    style={{ background: `${item.color}15` }}
                  >
                    <IconComp style={{ fontSize: 24, color: item.color }} />
                  </div>
                  <Statistic
                    title={<span className="visualization__stat-title">{item.title}</span>}
                    value={item.value}
                    suffix={<span style={{ color: item.color }}>{item.suffix}</span>}
                  />
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Row gutter={16} className="visualization__row">
        <Col span={12}>
          <Card bordered={false} title="各部门出勤统计">
            <Table
              columns={columns}
              data={deptData}
              rowKey="dept"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card bordered={false} title="实时打卡动态">
            <Space direction="vertical" size="medium" className="visualization__record-meta">
              {realtimeData.length > 0 ? (
                realtimeData.map((item, index) => (
                  <div key={index} className="visualization__record-item">
                    <Space size="medium">
                      <Avatar size={36}>
                        <IconUser />
                      </Avatar>
                      <div>
                        <div className="visualization__record-name">
                          {item.name}
                          <Tag color="blue" size="small" className="visualization__tag-margin">
                            {item.dept}
                          </Tag>
                        </div>
                        <div className="visualization__record-location">
                          {item.location}
                        </div>
                      </div>
                    </Space>
                    <Space direction="vertical" size={4} className="visualization__record-align-right">
                      <span className="visualization__record-type">
                        {item.type === 'in' ? '上班打卡' : '下班打卡'}
                      </span>
                      <span
                        className="visualization__record-time tabular-nums"
                        style={{ color: item.type === 'in' ? '#00B42A' : '#FF7D00' }}
                      >
                        {item.time}
                      </span>
                    </Space>
                  </div>
                ))
              ) : (
                <div className="visualization__empty">暂无打卡记录</div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="visualization__row">
        <Col span={24}>
          <Card bordered={false} title="本月考勤概况">
            <Row gutter={16}>
              <Col span={6}>
                <div className="visualization__summary-item">
                  <div className="visualization__summary-value tabular-nums">
                    {attendanceOverview?.total || 0}
                  </div>
                  <div className="visualization__summary-label">今日打卡</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="visualization__summary-item">
                  <div className="tabular-nums visualization__color-success">
                    {attendanceOverview?.normal || 0}
                  </div>
                  <div className="visualization__summary-label">正常</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="visualization__summary-item">
                  <div className="tabular-nums visualization__color-warning">
                    {(attendanceOverview?.late || 0) + (attendanceOverview?.early || 0)}
                  </div>
                  <div className="visualization__summary-label">迟到/早退</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="visualization__summary-item">
                  <div className="tabular-nums visualization__color-danger">
                    {attendanceOverview?.absent || 0}
                  </div>
                  <div className="visualization__summary-label">旷工</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Visualization
