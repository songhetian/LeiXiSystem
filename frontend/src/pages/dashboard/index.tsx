import { useEffect, useState, useRef, useCallback } from 'react'
import { Table, Tag, List, Spin, Button } from '@arco-design/web-react'
import { IconUser, IconCalendar, IconFile, IconUserGroup, IconUp, IconDown, IconClockCircle } from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats, getAttendanceOverview, getDashboardTodos } from '@/api/dashboard'
import type { DashboardStats, AttendanceOverview, TodoItem } from '@/api/dashboard'
import { getTodayClockIn, clockIn } from '@/api/clock-in'
import type { TodayClockInData } from '@/api/clock-in'
import { echarts } from '@/utils/echarts'
import type { EChartsOption } from '@/utils/echarts'
import styles from './index.module.css'
import { Message, Modal, Form, Input } from '@arco-design/web-react'

const FormItem = Form.Item
const TextArea = Input.TextArea

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
}

/** Jade Green color palette for charts */
const JADE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316']

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
  const [todayClockIn, setTodayClockIn] = useState<TodayClockInData | null>(null)
  const [clockInLoading, setClockInLoading] = useState(false)
  const [fieldWorkVisible, setFieldWorkVisible] = useState(false)
  const [fieldWorkType, setFieldWorkType] = useState<'in' | 'out'>('in')
  const [fieldWorkReason, setFieldWorkReason] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Chart refs
  const trendChartRef = useRef<HTMLDivElement>(null)
  const pieChartRef = useRef<HTMLDivElement>(null)
  const barChartRef = useRef<HTMLDivElement>(null)
  const gaugeChartRef = useRef<HTMLDivElement>(null)

  // Chart instance refs
  const trendInstance = useRef<ReturnType<typeof echarts.init> | null>(null)
  const pieInstance = useRef<ReturnType<typeof echarts.init> | null>(null)
  const barInstance = useRef<ReturnType<typeof echarts.init> | null>(null)
  const gaugeInstance = useRef<ReturnType<typeof echarts.init> | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, attRes, todosRes, clockInRes] = await Promise.all([
        getDashboardStats(),
        getAttendanceOverview(),
        getDashboardTodos(),
        getTodayClockIn().catch(() => ({ data: null } as any)),
      ])
      setStats(statsRes.data)
      setAttendance(attRes.data)
      setTodos(todosRes.data)
      if (clockInRes?.data) {
        setTodayClockIn(clockInRes.data)
      }
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
            return `<div style="font-weight:500">${p.axisValue}</div><div style="color:#10B981">出勤人数: ${p.value}</div>`
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
            lineStyle: { width: 3, color: '#10B981' },
            itemStyle: { color: '#10B981' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(16,185,129,0.25)' },
                  { offset: 1, color: 'rgba(16,185,129,0.02)' },
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
        color: JADE_COLORS,
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
              { value: attendance.normal, itemStyle: { color: '#10B981' } },
              { value: attendance.late, itemStyle: { color: '#F59E0B' } },
              { value: attendance.early, itemStyle: { color: '#FACC14' } },
              { value: attendance.absent, itemStyle: { color: '#EF4444' } },
            ],
            label: {
              show: true,
              position: 'top',
              color: '#4e5969',
              fontWeight: 'bold',
              fontSize: 13,
            },
            itemStyle: {
              borderRadius: [8, 8, 0, 0],
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
                    { offset: 0, color: '#10B981' },
                    { offset: 1, color: '#059669' },
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
      trendInstance.current?.dispose()
      pieInstance.current?.dispose()
      barInstance.current?.dispose()
      gaugeInstance.current?.dispose()
    }
  }, [])

  const handleQuickCheckIn = async (type: 'in' | 'out') => {
    if (!todayClockIn) return

    if (!todayClockIn.schedule) {
      navigate('/attendance/clock-in')
      Message.info('请先选择班次再打卡')
      return
    }

    if (type === 'in' && !todayClockIn.canCheckIn) {
      Message.info('今天已打过上班卡')
      return
    }
    if (type === 'out' && !todayClockIn.canCheckOut) {
      Message.info('请先打上班卡')
      return
    }

    setClockInLoading(true)
    try {
      const res = await clockIn({ type, shiftId: todayClockIn.schedule.id })
      if (res.code === 0) {
        Message.success(type === 'in' ? '上班打卡成功' : '下班打卡成功')
        fetchData()
      } else if (res.code === 400 && res.message?.includes('不在有效打卡范围')) {
        setFieldWorkType(type)
        setFieldWorkVisible(true)
      } else {
        Message.error(res.message || '打卡失败')
      }
    } catch (err: any) {
      if (err?.message?.includes('不在有效打卡范围')) {
        setFieldWorkType(type)
        setFieldWorkVisible(true)
      }
    } finally {
      setClockInLoading(false)
    }
  }

  const handleFieldWork = async () => {
    if (!fieldWorkReason.trim()) {
      Message.warning('请填写外勤事由')
      return
    }
    setClockInLoading(true)
    try {
      const res = await clockIn({
        type: fieldWorkType,
        isFieldWork: true,
        fieldWorkReason: fieldWorkReason.trim(),
        shiftId: todayClockIn?.schedule?.id,
      })
      if (res.code === 0) {
        Message.success('外勤打卡申请已提交')
        setFieldWorkVisible(false)
        setFieldWorkReason('')
        fetchData()
      } else {
        Message.error(res.message || '提交失败')
      }
    } catch {
      // error handled by interceptor
    } finally {
      setClockInLoading(false)
    }
  }

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

  const today = new Date()
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const attendanceRate = attendance?.attendanceRate || '0%'

  return (
    <div className={styles['dashboard-wrapper']}>
      {/* Header */}
      <div className={styles['dashboard-header']}>
        <h2 className={styles['dashboard-title']}>欢迎回来</h2>
        <p className={styles['dashboard-subtitle']}>今天是工作日，祝您工作愉快！</p>
      </div>

      {/* Quick Clock-in Card */}
      {todayClockIn && (
        <div className={styles['clockin-card']}>
          <div className={styles['clockin-card__left']}>
            <div className={styles['clockin-card__time']}>
              {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className={styles['clockin-card__date']}>
              {currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </div>
            {todayClockIn.schedule && (
              <div className={styles['clockin-card__shift']}>
                <IconCalendar style={{ marginRight: 6 }} />
                {todayClockIn.schedule.shiftName} · {todayClockIn.schedule.startTime}-{todayClockIn.schedule.endTime}
                {todayClockIn.schedule.isManual && (
                  <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>(自选)</span>
                )}
              </div>
            )}
            {!todayClockIn.schedule && (
              <div className={styles['clockin-card__shift']} style={{ opacity: 0.9 }}>
                <IconCalendar style={{ marginRight: 6 }} />
                今日未排班 · 请先选择班次
              </div>
            )}
            <div className={styles['clockin-card__status']}>
              <IconClockCircle style={{ marginRight: 6 }} />
              {todayClockIn.firstIn && `上班 ${new Date(todayClockIn.firstIn).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
              {todayClockIn.lastOut && ` / 下班 ${new Date(todayClockIn.lastOut).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
              {!todayClockIn.firstIn && !todayClockIn.lastOut && (todayClockIn.schedule ? '今日待打卡' : '请选择班次')}
            </div>
          </div>
          <div className={styles['clockin-card__right']}>
            <Button
              type="primary"
              size="large"
              icon={<IconUp />}
              loading={clockInLoading}
              disabled={!todayClockIn.schedule ? false : !todayClockIn.canCheckIn}
              onClick={() => handleQuickCheckIn('in')}
              className={styles['clockin-card__btn']}
            >
              {!todayClockIn.schedule ? '选择班次' : todayClockIn.firstIn ? '已上班' : '上班打卡'}
            </Button>
            <Button
              type="outline"
              size="large"
              icon={<IconDown />}
              loading={clockInLoading}
              disabled={!todayClockIn.schedule || !todayClockIn.canCheckOut}
              onClick={() => handleQuickCheckIn('out')}
              className={styles['clockin-card__btn']}
            >
              {todayClockIn.lastOut ? '已下班' : '下班打卡'}
            </Button>
            <Button
              type="text"
              size="small"
              onClick={() => navigate('/attendance/clock-in')}
            >
              查看详情 →
            </Button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className={styles['stat-grid']}>
        <div className={styles['stat-card']} style={{ '--delay': '0.1s' } as React.CSSProperties}>
          <div className={`${styles['stat-icon']} ${styles['stat-icon--green']}`}>
            <IconUser />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats?.totalUsers ?? 0}</div>
            <div className={styles['stat-label']}>员工总数</div>
          </div>
        </div>

        <div className={styles['stat-card']} style={{ '--delay': '0.2s' } as React.CSSProperties}>
          <div className={`${styles['stat-icon']} ${styles['stat-icon--blue']}`}>
            <IconCalendar />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats?.todayAttendance ?? 0}</div>
            <div className={styles['stat-label']}>今日出勤</div>
          </div>
        </div>

        <div className={styles['stat-card']} style={{ '--delay': '0.3s' } as React.CSSProperties}>
          <div className={`${styles['stat-icon']} ${styles['stat-icon--amber']}`}>
            <IconFile />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats?.pendingApprovals ?? 0}</div>
            <div className={styles['stat-label']}>待审批</div>
          </div>
        </div>

        <div className={styles['stat-card']} style={{ '--delay': '0.4s' } as React.CSSProperties}>
          <div className={`${styles['stat-icon']} ${styles['stat-icon--purple']}`}>
            <IconUserGroup />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats?.totalDepartments ?? 0}</div>
            <div className={styles['stat-label']}>部门数量</div>
          </div>
        </div>
      </div>

      {/* Content Row */}
      <div className={styles['content-row']}>
        {/* Attendance Table */}
        <div className={styles['section-card']} style={{ '--delay': '0.25s' } as React.CSSProperties}>
          <div className={styles['section-header']}>
            <div className={styles['section-title-group']}>
              <h3 className={styles['section-title']}>今日考勤</h3>
              <span className={styles['section-date']}>{dateStr}</span>
              <span className={styles['section-tag']}>出勤率 {attendanceRate}</span>
            </div>
            <button className={styles['section-link']} onClick={() => navigate('/attendance/records')}>
              查看全部
            </button>
          </div>
          <Spin loading={loading && !attendance} style={{ display: 'block' }}>
            <Table
              columns={columns}
              data={attendance?.recentList || []}
              pagination={false}
              size="small"
              noDataElement={<div className={styles['dashboard-empty']}>暂无数据</div>}
            />
          </Spin>
        </div>

        {/* Todo List */}
        <div className={styles['section-card']} style={{ '--delay': '0.35s' } as React.CSSProperties}>
          <div className={styles['section-header']}>
            <div className={styles['section-title-group']}>
              <h3 className={styles['section-title']}>待办事项</h3>
              {todos.length > 0 && <span className={styles['count-badge']}>{todos.length}</span>}
            </div>
            <button className={styles['section-link']} onClick={() => navigate('/approval/pending')}>
              全部
            </button>
          </div>
          <div className={styles['section-body--padded']}>
            <Spin loading={loading && todos.length === 0} style={{ display: 'block' }}>
              <List
                size="small"
                dataSource={todos}
                render={(item, index) => {
                  const dotClass = index % 3 === 0 ? styles['todo-dot--primary'] : index % 3 === 1 ? styles['todo-dot--info'] : styles['todo-dot--warning']
                  return (
                    <List.Item key={`${item.type}-${item.id}`} className={styles['todo-list-item']}>
                      <span className={`${styles['todo-dot']} ${dotClass}`} />
                      <div className={styles['todo-content']}>
                        <span className={styles['todo-title']}>{item.title}</span>
                        <span className={styles['todo-type']}>{item.typeName}</span>
                      </div>
                      <span className={styles['todo-time']}>
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </List.Item>
                  )
                }}
                noDataElement={<div className={styles['dashboard-empty']}>暂无待办</div>}
              />
            </Spin>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className={styles['charts-grid']}>
        <div className={`${styles['section-card']} ${styles['chart-section']}`} style={{ '--delay': '0.4s' } as React.CSSProperties}>
          <div className={styles['section-header']}>
            <div>
              <h3 className={styles['section-title']}>出勤趋势</h3>
              <span className={styles['chart-subtitle']}>近30天出勤人数变化</span>
            </div>
          </div>
          <div className={styles['chart-body']}>
            <div ref={trendChartRef} className={styles['chart-container']} />
          </div>
        </div>

        <div className={`${styles['section-card']} ${styles['chart-section']}`} style={{ '--delay': '0.55s' } as React.CSSProperties}>
          <div className={styles['section-header']}>
            <div>
              <h3 className={styles['section-title']}>部门人力分布</h3>
              <span className={styles['chart-subtitle']}>各部门人员占比</span>
            </div>
          </div>
          <div className={styles['chart-body']}>
            <div ref={pieChartRef} className={styles['chart-container']} />
          </div>
        </div>

        <div className={`${styles['section-card']} ${styles['chart-section']}`} style={{ '--delay': '0.7s' } as React.CSSProperties}>
          <div className={styles['section-header']}>
            <div>
              <h3 className={styles['section-title']}>考勤状态</h3>
              <span className={styles['chart-subtitle']}>今日考勤状态统计</span>
            </div>
          </div>
          <div className={styles['chart-body']}>
            <div ref={barChartRef} className={styles['chart-container']} />
          </div>
        </div>

        <div className={`${styles['section-card']} ${styles['chart-section']}`} style={{ '--delay': '0.85s' } as React.CSSProperties}>
          <div className={styles['section-header']}>
            <div>
              <h3 className={styles['section-title']}>审批待办</h3>
              <span className={styles['chart-subtitle']}>待审批事项进度</span>
            </div>
          </div>
          <div className={styles['chart-body']}>
            <div ref={gaugeChartRef} className={styles['chart-container']} />
          </div>
        </div>
      </div>

      <Modal
        title="外勤打卡"
        visible={fieldWorkVisible}
        onOk={handleFieldWork}
        onCancel={() => setFieldWorkVisible(false)}
        confirmLoading={clockInLoading}
        okText="提交申请"
        cancelText="取消"
      >
        <Form layout="vertical">
          <FormItem label="打卡类型">
            <Tag color={fieldWorkType === 'in' ? 'green' : 'blue'}>
              {fieldWorkType === 'in' ? '上班外勤打卡' : '下班外勤打卡'}
            </Tag>
          </FormItem>
          <FormItem label="外勤事由" rules={[{ required: true, message: '请填写外勤事由' }]}>
            <TextArea
              placeholder="请填写外勤事由，如：客户拜访、外出办事等"
              value={fieldWorkReason}
              onChange={(v) => setFieldWorkReason(v)}
              style={{ minHeight: 100 }}
              maxLength={500}
            />
          </FormItem>
          <div style={{ fontSize: 12, color: '#86909c', marginTop: -8 }}>
            提示：外勤打卡需审批通过后才生效
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default Dashboard
