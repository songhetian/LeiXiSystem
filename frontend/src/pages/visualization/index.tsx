import { useState, useEffect, useCallback, useRef } from 'react'
import { getDashboardStats, getAttendanceOverview } from '@/api/dashboard'
import { catchError } from '@/utils/catchError'
import { echarts } from '@/utils/echarts'
import type { EChartsOption } from '@/utils/echarts'
import styles from './style.module.css'

interface RealtimeRecord {
  time: string
  name: string
  dept: string
  type: 'in' | 'out'
  location: string
  avatar: string
}

interface DeptRank {
  dept: string
  rate: number
  count: number
}

/* ── Mock data generators ───────────────────────────────────── */

const MOCK_NAMES = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十', '钱一', '冯二', '陈明', '刘洋', '黄磊', '林峰', '许晴']
const MOCK_DEPTS = ['研发部', '市场部', '财务部', '人事部', '运营部', '产品部', '设计部', '客服部']
const MOCK_LOCATIONS = ['总部大楼A区', '总部大楼B区', '研发中心', '前台', '会议室旁', '茶水间', '总部正门']

function generateInitials(name: string): string {
  return name.charAt(0)
}

function generateMockDeptRanks(): DeptRank[] {
  return MOCK_DEPTS
    .map((dept) => ({
      dept,
      rate: +(85 + Math.random() * 15).toFixed(1),
      count: Math.floor(10 + Math.random() * 30),
    }))
    .sort((a, b) => b.rate - a.rate)
}

function generateMock30DayTrend(): { dates: string[]; counts: number[] } {
  const dates: string[] = []
  const counts: number[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    counts.push(isWeekend ? Math.floor(20 + Math.random() * 30) : Math.floor(140 + Math.random() * 50))
  }
  return { dates, counts }
}

function generateMockApprovalTrend(): { dates: string[]; counts: number[] } {
  const dates: string[] = []
  const counts: number[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`)
    counts.push(Math.floor(3 + Math.random() * 15))
  }
  return { dates, counts }
}

function generateMockExceptions(): { name: string; value: number }[] {
  return [
    { name: '迟到', value: 28 },
    { name: '早退', value: 12 },
    { name: '旷工', value: 5 },
    { name: '缺卡', value: 18 },
    { name: '请假', value: 32 },
  ]
}

function generateMockScheduleCoverage(): { indicator: { name: string; max: number }[]; values: number[] } {
  return {
    indicator: [
      { name: '周一', max: 100 },
      { name: '周二', max: 100 },
      { name: '周三', max: 100 },
      { name: '周四', max: 100 },
      { name: '周五', max: 100 },
    ],
    values: [92, 88, 95, 90, 85],
  }
}

function generateRealtimeFeed(count: number): RealtimeRecord[] {
  const records: RealtimeRecord[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const t = new Date(now.getTime() - i * 60000 * Math.floor(1 + Math.random() * 5))
    const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]
    records.push({
      time: t.toTimeString().slice(0, 8),
      name,
      dept: MOCK_DEPTS[Math.floor(Math.random() * MOCK_DEPTS.length)],
      type: Math.random() > 0.3 ? 'in' : 'out',
      location: MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)],
      avatar: generateInitials(name),
    })
  }
  return records
}

/* ── Helper: format time ────────────────────────────────────── */

function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

/* ── Component ──────────────────────────────────────────────── */

function Visualization() {
  /* State */
  const [clock, setClock] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [totalEmployees, setTotalEmployees] = useState(186)
  const [todayAttended, setTodayAttended] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState(95.2)
  const [pendingApprovals, setPendingApprovals] = useState(7)
  const [deptRanks, setDeptRanks] = useState<DeptRank[]>(generateMockDeptRanks)
  const [feedData, setFeedData] = useState<RealtimeRecord[]>(() => generateRealtimeFeed(15))
  const [feedIndex, setFeedIndex] = useState(0)
  const [trendData] = useState(generateMock30DayTrend)
  const [approvalTrend] = useState(generateMockApprovalTrend)
  const [exceptions] = useState(generateMockExceptions)
  const [scheduleCoverage] = useState(generateMockScheduleCoverage)
  const [monthlySummary, setMonthlySummary] = useState({
    workdays: 22,
    avgAttendance: 168,
    lateCount: 28,
    absentCount: 5,
  })

  /* Refs for charts and containers */
  const gaugeRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const trendRef = useRef<HTMLDivElement>(null)
  const approvalRef = useRef<HTMLDivElement>(null)
  const pieRef = useRef<HTMLDivElement>(null)
  const radarRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  const gaugeChart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const barChart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const trendChart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const approvalChart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const pieChart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const radarChart = useRef<ReturnType<typeof echarts.init> | null>(null)

  /* Clock tick every second */
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  /* Auto-scroll feed every 3 seconds */
  useEffect(() => {
    const timer = setInterval(() => {
      setFeedIndex((prev) => prev + 1)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  /* Scroll the feed container */
  useEffect(() => {
    if (feedRef.current) {
      const el = feedRef.current
      const itemHeight = 72
      const maxScroll = el.scrollHeight - el.clientHeight
      const target = feedIndex * itemHeight
      el.scrollTo({ top: Math.min(target, maxScroll > 0 ? maxScroll : 0), behavior: 'smooth' })
      // Reset index when reaching bottom
      if (maxScroll > 0 && target >= maxScroll) {
        setFeedIndex(0)
        el.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }, [feedIndex])

  /* Data load */
  const loadData = useCallback(async () => {
    try {
      const [statsRes, attendanceRes]: any = await Promise.all([
        getDashboardStats(),
        getAttendanceOverview(),
      ])

      const stats = statsRes?.data
      const attendance = attendanceRes?.data

      if (stats) {
        setTotalEmployees(stats.totalUsers || 186)
        setPendingApprovals(stats.pendingApprovals ?? 7)
      }
      if (attendance) {
        const rate = parseFloat(String(attendance.attendanceRate || '95.2'))
        setAttendanceRate(rate)
        setTodayAttended(attendance.normal || attendance.total || 168)

        // Build real feed data from API if available
        const recentList = attendance.recentList || []
        if (recentList.length > 0) {
          setFeedData(
            recentList.map((item: any) => ({
              time: item.checkIn || item.checkOut || '--:--:--',
              name: item.name || '未知',
              dept: item.department || '-',
              type: item.checkIn ? ('in' as const) : ('out' as const),
              location: '办公区',
              avatar: generateInitials(item.name || '员'),
            }))
          )
        }

        // Build dept ranks from recentList department grouping
        if (recentList.length > 0) {
          const deptMap: Record<string, number> = {}
          recentList.forEach((item: any) => {
            const dept = item.department || '未知部门'
            deptMap[dept] = (deptMap[dept] || 0) + 1
          })
          const total = recentList.length
          const ranks: DeptRank[] = Object.entries(deptMap)
            .map(([dept, count]) => ({
              dept,
              count,
              rate: +((count / total) * 100).toFixed(1),
            }))
            .sort((a, b) => b.rate - a.rate)
          if (ranks.length > 0) {
            setDeptRanks(ranks)
          }
        }

        if (attendance.total && attendance.normal) {
          setMonthlySummary((prev) => ({
            ...prev,
            avgAttendance: attendance.normal,
            lateCount: (attendance.late || 0) + (attendance.early || 0),
            absentCount: attendance.absent || 0,
          }))
        }
      }
    } catch (e) {
      catchError(e, { component: 'Visualization', operation: '加载仪表盘数据' })
    }
  }, [])

  /* 30-second auto-refresh */
  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [loadData])

  /* ── Chart init helpers ──────────────────────────────────── */

  const initChart = useCallback(
    (
      ref: React.RefObject<HTMLDivElement | null>,
      chartInstance: React.MutableRefObject<ReturnType<typeof echarts.init> | null>,
      option: EChartsOption,
    ) => {
      if (!ref.current) return
      if (chartInstance.current) {
        chartInstance.current.dispose()
      }
      const chart = echarts.init(ref.current)
      chart.setOption(option)
      chartInstance.current = chart
      return chart
    },
    [],
  )

  /* Gauge chart — attendance rate */
  useEffect(() => {
    const option: EChartsOption = {
      series: [
        {
          type: 'gauge',
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max: 100,
          radius: '90%',
          pointer: { show: false },
          progress: {
            show: true,
            width: 18,
            roundCap: true,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: '#00d4ff' },
                  { offset: 1, color: '#0066ff' },
                ],
              },
            },
          },
          axisLine: { lineStyle: { width: 18, color: [[1, 'rgba(0,212,255,0.15)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 36,
            fontWeight: 'bold',
            color: '#00d4ff',
            offsetCenter: [0, '10%'],
            formatter: '{value}%',
          },
          data: [{ value: attendanceRate }],
        },
      ],
    }
    initChart(gaugeRef, gaugeChart, option)
  }, [attendanceRate, initChart])

  /* Bar chart — department ranking */
  useEffect(() => {
    const option: EChartsOption = {
      grid: { left: 80, right: 20, top: 10, bottom: 10 },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: {
        type: 'category',
        data: deptRanks.map((d) => d.dept).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8aa3bf', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: deptRanks.map((d) => d.rate).reverse(),
          barWidth: 12,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#0066ff' },
                { offset: 1, color: '#00d4ff' },
              ],
            },
          },
          label: {
            show: true,
            position: 'right',
            color: '#00d4ff',
            fontSize: 11,
            formatter: '{c}%',
          },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,25,41,0.9)',
        borderColor: '#0066ff',
        textStyle: { color: '#fff' },
      },
    }
    initChart(barRef, barChart, option)
  }, [deptRanks, initChart])

  /* Area chart — 30-day trend */
  useEffect(() => {
    const option: EChartsOption = {
      grid: { left: 45, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: trendData.dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#1a3a5c' } },
        axisLabel: { color: '#5a7a9a', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLine: { show: false },
        axisLabel: { color: '#5a7a9a', fontSize: 10 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,25,41,0.9)',
        borderColor: '#0066ff',
        textStyle: { color: '#fff' },
      },
      series: [
        {
          type: 'line',
          data: trendData.counts,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#00d4ff', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0,212,255,0.35)' },
                { offset: 1, color: 'rgba(0,212,255,0.02)' },
              ],
            },
          },
        },
      ],
    }
    initChart(trendRef, trendChart, option)
  }, [trendData, initChart])

  /* Line chart — approval trend 7 days */
  useEffect(() => {
    const option: EChartsOption = {
      grid: { left: 35, right: 15, top: 15, bottom: 25 },
      xAxis: {
        type: 'category',
        data: approvalTrend.dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#1a3a5c' } },
        axisLabel: { color: '#5a7a9a', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLine: { show: false },
        axisLabel: { color: '#5a7a9a', fontSize: 10 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,25,41,0.9)',
        borderColor: '#722ED1',
        textStyle: { color: '#fff' },
      },
      series: [
        {
          type: 'line',
          data: approvalTrend.counts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#7c5cff', width: 2 },
          itemStyle: { color: '#7c5cff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(124,92,255,0.3)' },
                { offset: 1, color: 'rgba(124,92,255,0.02)' },
              ],
            },
          },
        },
      ],
    }
    initChart(approvalRef, approvalChart, option)
  }, [approvalTrend, initChart])

  /* Pie chart — exception distribution */
  useEffect(() => {
    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10,25,41,0.9)',
        borderColor: '#0066ff',
        textStyle: { color: '#fff' },
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#8aa3bf', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#0a1929', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, color: '#fff', fontSize: 13, fontWeight: 'bold' },
          },
          data: exceptions.map((item, i) => ({
            ...item,
            itemStyle: {
              color: ['#ff6b6b', '#ffa940', '#ffec3d', '#73d13d', '#36cfc9'][i],
            },
          })),
        },
      ],
    }
    initChart(pieRef, pieChart, option)
  }, [exceptions, initChart])

  /* Radar chart — schedule coverage */
  useEffect(() => {
    const option: EChartsOption = {
      radar: {
        indicator: scheduleCoverage.indicator,
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: '#8aa3bf', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: scheduleCoverage.values,
              name: '排班覆盖率',
              areaStyle: { color: 'rgba(0,212,255,0.2)' },
              lineStyle: { color: '#00d4ff', width: 2 },
              itemStyle: { color: '#00d4ff' },
            },
          ],
        },
      ],
      tooltip: {
        backgroundColor: 'rgba(10,25,41,0.9)',
        borderColor: '#0066ff',
        textStyle: { color: '#fff' },
      },
    }
    initChart(radarRef, radarChart, option)
  }, [scheduleCoverage, initChart])

  /* Resize handler */
  useEffect(() => {
    const handleResize = () => {
      const charts = [gaugeChart, barChart, trendChart, approvalChart, pieChart, radarChart]
      charts.forEach((ref) => {
        if (ref.current) ref.current.resize()
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      const charts = [gaugeChart, barChart, trendChart, approvalChart, pieChart, radarChart]
      charts.forEach((ref) => {
        if (ref.current) {
          ref.current.dispose()
          ref.current = null
        }
      })
    }
  }, [])

  /* Fullscreen toggle */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  /* Listen for fullscreen change */
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  /* Stat cards config */
  const statCards = [
    { title: '总人数', value: totalEmployees, suffix: '人', color: '#00d4ff', trend: '+2' },
    { title: '今日出勤', value: todayAttended, suffix: '人', color: '#00e676', trend: '+5' },
    { title: '出勤率', value: attendanceRate, suffix: '%', color: '#7c5cff', trend: '+0.3%' },
    { title: '待审批', value: pendingApprovals, suffix: '条', color: '#ffa940', trend: '-2' },
  ]

  return (
    <div className={styles.dashboard}>
      {/* Fullscreen toggle */}
      <button className={styles.fullscreenBtn} onClick={toggleFullscreen} title={isFullscreen ? '退出全屏' : '全屏'}>
        {isFullscreen ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        )}
      </button>

      <div className={styles.grid}>
        {/* ── LEFT COLUMN ─────────────────────────────────── */}
        <div className={styles.column}>
          {/* Gauge */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>出勤率仪表盘</div>
            <div ref={gaugeRef} className={styles.chartGauge} />
          </div>

          {/* Department ranking */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>部门出勤排行</div>
            <div ref={barRef} className={styles.chartBar} />
          </div>

          {/* Realtime feed */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>实时签到流水</div>
            <div ref={feedRef} className={styles.feedContainer}>
              {feedData.length > 0 ? (
                feedData.map((item, index) => (
                  <div key={index} className={styles.feedItem}>
                    <div className={styles.feedAvatar}>{item.avatar}</div>
                    <div className={styles.feedInfo}>
                      <div className={styles.feedName}>
                        {item.name}
                        <span className={styles.feedTag}>{item.dept}</span>
                      </div>
                      <div className={styles.feedLocation}>{item.location}</div>
                    </div>
                    <div className={styles.feedRight}>
                      <span className={item.type === 'in' ? styles.feedTypeIn : styles.feedTypeOut}>
                        {item.type === 'in' ? '上班' : '下班'}
                      </span>
                      <span className={styles.feedTime}>{item.time}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.feedEmpty}>暂无打卡记录</div>
              )}
            </div>
          </div>
        </div>

        {/* ── CENTER COLUMN ───────────────────────────────── */}
        <div className={styles.columnCenter}>
          {/* Header */}
          <div className={styles.centerHeader}>
            <h1 className={styles.mainTitle}>雷犀人事数据大屏</h1>
            <div className={styles.clockRow}>
              <span className={styles.clockDate}>{formatDate(clock)}</span>
              <span className={styles.clockTime}>{formatClock(clock)}</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className={styles.statRow}>
            {statCards.map((card, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.statValue} style={{ color: card.color }}>
                  {card.value}
                  <span className={styles.statSuffix}>{card.suffix}</span>
                </div>
                <div className={styles.statLabel}>
                  {card.title}
                  <span
                    className={card.trend.startsWith('+') ? styles.trendUp : styles.trendDown}
                  >
                    {card.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 30-day trend */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>30天出勤趋势</div>
            <div ref={trendRef} className={styles.chartTrend} />
          </div>

          {/* Monthly summary */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>月度汇总</div>
            <div className={styles.monthlyRow}>
              <div className={styles.monthlyItem}>
                <div className={styles.monthlyValue}>{monthlySummary.workdays}</div>
                <div className={styles.monthlyLabel}>工作日</div>
              </div>
              <div className={styles.monthlyItem}>
                <div className={`${styles.monthlyValue} ${styles.cyan}`}>{monthlySummary.avgAttendance}</div>
                <div className={styles.monthlyLabel}>平均出勤</div>
              </div>
              <div className={styles.monthlyItem}>
                <div className={`${styles.monthlyValue} ${styles.orange}`}>{monthlySummary.lateCount}</div>
                <div className={styles.monthlyLabel}>迟到/早退</div>
              </div>
              <div className={styles.monthlyItem}>
                <div className={`${styles.monthlyValue} ${styles.red}`}>{monthlySummary.absentCount}</div>
                <div className={styles.monthlyLabel}>旷工</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────── */}
        <div className={styles.column}>
          {/* Approval trend */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>审批待办趋势</div>
            <div ref={approvalRef} className={styles.chartSmall} />
          </div>

          {/* Exception distribution */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>考勤异常分布</div>
            <div ref={pieRef} className={styles.chartSmall} />
          </div>

          {/* Schedule coverage */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>排班覆盖率</div>
            <div ref={radarRef} className={styles.chartSmall} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Visualization
