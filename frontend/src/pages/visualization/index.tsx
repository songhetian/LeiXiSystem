import { useState, useEffect } from 'react'
import {
  Card,
  Grid,
  Statistic,
  Tag,
  Space,
  Progress,
  Table,
  Avatar,
} from '@arco-design/web-react'
import {
  IconUser,
  IconCalendar,
  IconClockCircle,
  IconUserGroup,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid

interface DeptAttendance {
  dept: string
  rate: number
  count: number
}

const deptData: DeptAttendance[] = [
  { dept: '技术部', rate: 98.5, count: 80 },
  { dept: '产品部', rate: 97.2, count: 35 },
  { dept: '市场部', rate: 96.8, count: 30 },
  { dept: '人事部', rate: 99.1, count: 12 },
  { dept: '财务部', rate: 97.5, count: 8 },
  { dept: '运营部', rate: 95.6, count: 25 },
]

interface RealtimeRecord {
  time: string
  name: string
  dept: string
  type: 'in' | 'out'
  location: string
}

const realtimeData: RealtimeRecord[] = [
  { time: '09:01:23', name: '张三', dept: '技术部', type: 'in', location: 'A栋1楼' },
  { time: '09:00:45', name: '李四', dept: '产品部', type: 'in', location: 'A栋1楼' },
  { time: '08:59:30', name: '王五', dept: '市场部', type: 'in', location: 'B栋1楼' },
  { time: '08:58:12', name: '赵六', dept: '技术部', type: 'in', location: 'A栋1楼' },
  { time: '08:57:05', name: '钱七', dept: '人事部', type: 'in', location: 'B栋2楼' },
]

function Visualization() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

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
      render: (value: number) => <span style={{ fontWeight: 600 }}>{value}人</span>,
    },
    {
      title: '出勤率',
      dataIndex: 'rate',
      render: (value: number) => (
        <Progress percent={value} style={{ width: '100%', maxWidth: 150 }} />
      ),
    },
  ]

  const stats = [
    { title: '总人数', value: 190, suffix: '人', color: '#165DFF', icon: IconUserGroup },
    { title: '已出勤', value: 186, suffix: '人', color: '#00B42A', icon: IconUser },
    { title: '出勤率', value: 97.9, suffix: '%', color: '#722ED1', icon: IconCalendar },
    { title: '平均工时', value: 8.2, suffix: 'h', color: '#FF7D00', icon: IconClockCircle },
  ]

  return (
    <div
      style={{
        padding: 20,
        minHeight: 'calc(100vh - 120px)',
        background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#fff', fontSize: 32, marginBottom: 8 }}>
          人事考勤数据可视化大屏
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>
          {currentTime.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}{' '}
          {currentTime.toLocaleTimeString('zh-CN')}
        </p>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats.map((item, index) => {
          const IconComp = item.icon
          return (
            <Col span={6} key={index}>
              <Card
                bordered={false}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 12,
                }}
              >
                <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `${item.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComp style={{ fontSize: 24, color: item.color }} />
                  </div>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.title}</span>}
                    value={item.value}
                    suffix={<span style={{ color: item.color }}>{item.suffix}</span>}
                    style={{ color: '#fff' }}
                  />
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            bordered={false}
            title={<span style={{ color: '#fff' }}>各部门出勤率</span>}
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              border: 'none',
            }}
          >
            <Table
              columns={columns}
              data={deptData}
              rowKey="dept"
              pagination={false}
              style={{ color: '#fff' }}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card
            bordered={false}
            title={<span style={{ color: '#fff' }}>实时打卡动态</span>}
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
            }}
          >
            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
              {realtimeData.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 8,
                  }}
                >
                  <Space size="medium">
                    <Avatar size={36}>
                      <IconUser />
                    </Avatar>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>
                        {item.name}
                        <Tag color="blue" size="small" style={{ marginLeft: 8 }}>
                          {item.dept}
                        </Tag>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        {item.location}
                      </div>
                    </div>
                  </Space>
                  <Space direction="vertical" size={4} style={{ textAlign: 'right' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                      {item.type === 'in' ? '上班打卡' : '下班打卡'}
                    </span>
                    <span style={{ color: item.type === 'in' ? '#00B42A' : '#FF7D00', fontWeight: 600 }}>
                      {item.time}
                    </span>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            bordered={false}
            title={<span style={{ color: '#fff' }}>本月考勤概况</span>}
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
            }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 36, fontWeight: 700, marginBottom: 4 }}>15</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>正常工作日</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#00B42A', fontSize: 36, fontWeight: 700, marginBottom: 4 }}>12.5</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>总加班(小时)</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#FF7D00', fontSize: 36, fontWeight: 700, marginBottom: 4 }}>5</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>迟到次数</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#165DFF', fontSize: 36, fontWeight: 700, marginBottom: 4 }}>2</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>请假天数</div>
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
