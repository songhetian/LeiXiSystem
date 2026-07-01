import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, Table, Tag, List, Typography, Space, Spin } from '@arco-design/web-react'
import Row from '@arco-design/web-react/es/Grid/row'
import Col from '@arco-design/web-react/es/Grid/col'
import {
  IconUser,
  IconCalendar,
  IconFile,
  IconUserGroup,
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats, getAttendanceOverview, getDashboardTodos } from '@/api/dashboard'
import type { DashboardStats, AttendanceOverview, TodoItem } from '@/api/dashboard'
import { echarts } from '@/utils/echarts'
import type { EChartsOption } from '@/utils/echarts'
import styles from './index.module.css'
const { Title, Text } = Typography

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
}

/** Arco Design color palette for charts */
const ARCO_COLORS = ['#165DFF', '#14C9C9', '#F7BA1E', '#F77234', '#9FDB1D', '#D91AD9', '#36CFC9', '#F0884D']

/** Generate mock 30-day attendance trend data */
function generateAttendanceTrend(todayCount: number) {
  const dates: string[] = []
  const counts: number[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${month}-${day}`)
    if (i === 0) {
      counts.push(todayCount)
    } else {
      // Simulate realistic fluctuation around the current count
      const base = Math.max(todayCount - 5, 20)
      const variance = Math.floor(Math.sin(i * 0.7) * 8 + Math.cos(i * 1.3) * 5)
      counts.push(Math.max(base + variance, 10))
    }
  }
  return { dates, counts }
}

/** Mock department headcount data */
const MOCK_DEPARTMENTS = [
  { name: '技术部', value: 45 },
  { name: '产品部', value: 18 },
  { name: '市场部', value: 22 },
  { name: '人事部', value: 12 },
  { name: '财务部', value: 10 },
  { name: '运营部', value: 25 },
  { name: '设计部', value: 15 },
]

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)

  // Chart refs
  const trendChartRef = useRef<HTMLDivElement>(null)
  const pieChartRef = useRef<HTMLDivElement>(null)
  const barChartRef = useRef<HTMLDivElement>(null)
  const gaugeChartRef = useRef<HTMLDivElement>(null)

  // Chart instance refs for cleanup and resize
  const trendInstance = useRef<ReturnType<typeof echarts.init> | null>(null)
  const pieInstance = useRef<ReturnType<typeof echarts.init> | null>(null)
  const barInstance = useRef<ReturnType<typeof echarts.init> | null>(null)
  const gaugeInstance = useRef<ReturnType<typeof echarts.init> | null>(null)

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

  /** Initialize / update charts when data is ready */
  const initCharts = useCallback(() => {
    // 1. Attendance Trend Line Chart
    if (trendChartRef.current && stats) {
      if (!trendInstance.current) {
        trendInstance.current = echarts.init(trendChartRef.current)
      }
      const trend = generateAttendanceTrend(stats.todayAttendance)
      const trendOption: EChartsOption = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: '#e5e6eb',
          textStyle: { color: '#1d2129' },
          formatter: (params: any) => {
            const p = params[0]
            return `<div style="font-weight:500">${p.axisValue}</div><div style="color:#165DFF">出勤人数: ${p.value}</div>`
          },
        },
        grid: { top: 30, right: 20, bottom: 30, left: 50 },
        xAxis: {
          type: 'category',
          data: trend.dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#e5e6eb' } },
          axisLabel: { color: '#86909c', fontSize: 11 },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: '#f2f3f5', type: 'dashed' } },
          axisLabel: { color: '#86909c', fontSize: 11 },
        },
        series: [
          {
            type: 'line',
            data: trend.counts,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: false,
            lineStyle: { width: 3, color: '#165DFF' },
            itemStyle: { color: '#165DFF' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(22,93,255,0.25)' },
                  { offset: 1, color: 'rgba(22,93,255,0.02)' },
                ],
              },
            },
            emphasis: {
              focus: 'series',
              itemStyle: { borderWidth: 2, borderColor: '#fff' },
            },
          },
        ],
      }
      trendInstance.current.setOption(trendOption, true)
    }

    // 2. Department Headcount Pie Chart
    if (pieChartRef.current) {
      if (!pieInstance.current) {
        pieInstance.current = echarts.init(pieChartRef.current)
      }
      const pieOption: EChartsOption = {
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: '#e5e6eb',
          textStyle: { color: '#1d2129' },
          formatter: '{b}: {c}人 ({d}%)',
        },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'center',
          textStyle: { color: '#4e5969', fontSize: 12 },
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 12,
        },
        color: ARCO_COLORS,
        series: [
          {
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['40%', '50%'],
            avoidLabelOverlap: false,
            label: {
              show: true,
              formatter: '{d}%',
              fontSize: 11,
              color: '#4e5969',
            },
            labelLine: { length: 10, length2: 8 },
            emphasis: {
              scaleSize: 6,
              label: { show: true, fontSize: 13, fontWeight: 'bold' },
            },
            data: MOCK_DEPARTMENTS.map((d) => ({ name: d.name, value: d.value })),
          },
        ],
      }
      pieInstance.current.setOption(pieOption, true)
    }

    // 3. Attendance Status Bar Chart
    if (barChartRef.current && attendance) {
      if (!barInstance.current) {
        barInstance.current = echarts.init(barChartRef.current)
      }
      const barOption: EChartsOption = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: '#e5e6eb',
          textStyle: { color: '#1d2129' },
          axisPointer: { type: 'shadow' },
        },
        grid: { top: 30, right: 20, bottom: 30, left: 50 },
        xAxis: {
          type: 'category',
          data: ['正常', '迟到', '早退', '旷工'],
          axisLine: { lineStyle: { color: '#e5e6eb' } },
          axisLabel: { color: '#4e5969', fontSize: 13 },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: '#f2f3f5', type: 'dashed' } },
          axisLabel: { color: '#86909c', fontSize: 11 },
        },
        series: [
          {
            type: 'bar',
            barWidth: '40%',
            data: [
              { value: attendance.normal, itemStyle: { color: '#00B42A' } },
              { value: attendance.late, itemStyle: { color: '#FF7D00' } },
              { value: attendance.early, itemStyle: { color: '#FACC14' } },
              { value: attendance.absent, itemStyle: { color: '#F53F3F' } },
            ],
            label: {
              show: true,
              position: 'top',
              color: '#4e5969',
              fontWeight: 'bold',
              fontSize: 13,
            },
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
            },
          },
        ],
      }
      barInstance.current.setOption(barOption, true)
    }

    // 4. Pending Approvals Gauge Chart
    if (gaugeChartRef.current && stats) {
      if (!gaugeInstance.current) {
        gaugeInstance.current = echarts.init(gaugeChartRef.current)
      }
      const maxVal = Math.max(100, Math.ceil(stats.pendingApprovals * 1.5 / 10) * 10)
      const gaugeOption: EChartsOption = {
        series: [
          {
            type: 'gauge',
            startAngle: 220,
            endAngle: -40,
            min: 0,
            max: maxVal,
            radius: '90%',
            progress: {
              show: true,
              width: 18,
              roundCap: true,
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [
                    { offset: 0, color: '#165DFF' },
                    { offset: 1, color: '#14C9C9' },
                  ],
                },
              },
            },
            pointer: { show: false },
            axisLine: {
              lineStyle: { width: 18, color: [[1, '#f2f3f5']] },
              roundCap: true,
            },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            title: {
              show: true,
              offsetCenter: [0, '30%'],
              fontSize: 14,
              color: '#86909c',
            },
            detail: {
              valueAnimation: true,
              fontSize: 36,
              fontWeight: 'bold',
              offsetCenter: [0, '-5%'],
              formatter: '{value}',
              color: '#1d2129',
            },
            data: [{ value: stats.pendingApprovals, name: '待审批事项' }],
          },
        ],
      }
      gaugeInstance.current.setOption(gaugeOption, true)
    }
  }, [stats, attendance])

  // Initialize charts once data is available
  useEffect(() => {
    initCharts()
  }, [initCharts])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      trendInstance.current?.resize()
      pieInstance.current?.resize()
      barInstance.current?.resize()
      gaugeInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      // Cleanup chart instances on unmount
      trendInstance.current?.dispose()
      pieInstance.current?.dispose()
      barInstance.current?.dispose()
      gaugeInstance.current?.dispose()
    }
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
    <div className={styles['dashboard-wrapper']}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* 欢迎标题 */}
        <div className={styles['dashboard-header']}>
          <Title heading={4} className={styles['dashboard-title']}>
            欢迎回来
          </Title>
          <Text className={styles['dashboard-subtitle']}>
            今天是工作日，祝您工作愉快！
          </Text>
        </div>

        {/* 统计卡片 - 使用新样式 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats} className={styles['stat-card']}>
              <div className={styles['stat-icon']}>
                <IconUser />
              </div>
              <div className={styles['stat-card-body']}>
                <div className={styles['stat-value']}>{stats?.totalUsers ?? 0}</div>
                <div className={styles['stat-title']}>员工总数</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats} className={`${styles['stat-card']} ${styles['stat-card--success']}`}>
              <div className={styles['stat-icon']} style={{ background: 'rgba(var(--success-6), 0.08)', color: 'rgb(var(--success-6))' }}>
                <IconCalendar />
              </div>
              <div className={styles['stat-card-body']}>
                <div className={styles['stat-value']}>{stats?.todayAttendance ?? 0}</div>
                <div className={styles['stat-title']}>今日出勤</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats} className={`${styles['stat-card']} ${styles['stat-card--warning']}`}>
              <div className={styles['stat-icon']} style={{ background: 'rgba(var(--warning-6), 0.08)', color: 'rgb(var(--warning-6))' }}>
                <IconFile />
              </div>
              <div className={styles['stat-card-body']}>
                <div className={styles['stat-value']}>{stats?.pendingApprovals ?? 0}</div>
                <div className={styles['stat-title']}>待审批</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} loading={loading && !stats} className={styles['stat-card']}>
              <div className={styles['stat-icon']}>
                <IconUserGroup />
              </div>
              <div className={styles['stat-card-body']}>
                <div className={styles['stat-value']}>{stats?.totalDepartments ?? 0}</div>
                <div className={styles['stat-title']}>部门数量</div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 内容区域 */}
        <Row gutter={16}>
          <Col span={16}>
            <Card
              bordered={false}
              title="今日考勤概览"
              extra={<a onClick={() => navigate('/attendance/records')}>查看全部</a>}
              loading={loading && !attendance}
              className={styles['content-card']}
            >
              <Table
                columns={columns}
                data={attendance?.recentList || []}
                pagination={false}
                size="small"
                noDataElement={<div className={styles['dashboard-empty']}>暂无数据</div>}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card
              bordered={false}
              title="待办事项"
              extra={<a onClick={() => navigate('/approval/pending')}>全部</a>}
              className={styles['content-card']}
            >
              <Spin loading={loading && todos.length === 0}>
                <List
                  size="small"
                  dataSource={todos}
                  render={(item) => (
                    <List.Item key={`${item.type}-${item.id}`} className={styles['todo-list-item']}>
                      <List.Item.Meta
                        title={<span className={styles['todo-list-item__title']}>{item.title}</span>}
                        description={<span className={styles['todo-list-item__desc']}>{item.typeName}</span>}
                      />
                      <Text className={styles['todo-list-item__time']}>
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </Text>
                    </List.Item>
                  )}
                  noDataElement={<div className={styles['dashboard-empty']}>暂无待办</div>}
                />
              </Spin>
            </Card>
          </Col>
        </Row>

        {/* 图表区域 - 2x2 布局 */}
        <Row gutter={16}>
          <Col span={12}>
            <Card bordered={false} title="出勤趋势" className={styles['chart-card']}>
              <div ref={trendChartRef} className={styles['chart-container']} />
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered={false} title="部门人力分布" className={styles['chart-card']}>
              <div ref={pieChartRef} className={styles['chart-container']} />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card bordered={false} title="考勤状态" className={styles['chart-card']}>
              <div ref={barChartRef} className={styles['chart-container']} />
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered={false} title="审批待办" className={styles['chart-card']}>
              <div ref={gaugeChartRef} className={styles['chart-container']} />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  )
}

export default Dashboard
