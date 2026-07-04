import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Select,
  DatePicker,
  Table,
  Spin,
  Statistic,
  Button,
  Progress,
  Space,
  Input,
  Tree,
  Popover,
  Grid,
  Tag,
} from '@arco-design/web-react'
import { IconSearch, IconRefresh, IconDownload, IconFilter } from '@arco-design/web-react/icon'
import dayjs, { Dayjs } from 'dayjs'
import { getAttendanceReport, ReportQuery, ChartData } from '@/api/reports'
import { getDepartmentTree, Department } from '@/api/organization'
import EChart from '@/components/EChart'
import type { EChartsOption } from 'echarts'
import styles from './style.module.css'
const { Row, Col } = Grid
const { RangePicker } = DatePicker
const { Search } = Input

interface TreeNode {
  key: string
  title: string
  children?: TreeNode[]
}

const statusOptions = [
  { label: '正常', value: 'normal' },
  { label: '迟到', value: 'late' },
  { label: '早退', value: 'early' },
  { label: '缺勤', value: 'absent' },
  { label: '请假', value: 'leave' },
]

const statusLabelMap: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early: '早退',
  absent: '缺勤',
  leave: '请假',
}

function buildTree(list: Department[]): TreeNode[] {
  const map = new Map<number, TreeNode & { parentId?: number }>()
  const roots: TreeNode[] = []
  list.forEach((item) => {
    map.set(item.id, {
      key: String(item.id),
      title: item.name,
      parentId: item.parentId,
    })
  })
  list.forEach((item) => {
    const node = map.get(item.id)!
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

interface AttendanceReportItem {
  employeeNo: string
  employeeName: string
  departmentName: string
  workDays: number
  normalDays: number
  lateDays: number
  earlyDays: number
  absentDays: number
  overtimeHours: number
  totalHours: number
  attendanceRate: number
}

interface AttendanceReportData {
  list: AttendanceReportItem[]
  departmentSummary?: any[]
  departmentRanking?: any[]
  chartData?: ChartData
  startDate: string
  endDate: string
  total: number
  totalEmployees: number
  avgAttendanceRate: number
}

const AttendanceReport: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [departmentTree, setDepartmentTree] = useState<TreeNode[]>([])
  const [selectedDeptKeys, setSelectedDeptKeys] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<Dayjs[]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [statusList, setStatusList] = useState<string[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [data, setData] = useState<AttendanceReportData | null>(null)

  const loadDepartmentTree = async () => {
    setTreeLoading(true)
    try {
      const res = await getDepartmentTree()
      if (res.code === 0) {
        setDepartmentTree(buildTree(res.data || []))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    loadDepartmentTree()
  }, [])

  const loadData = async (page = 1) => {
    setLoading(true)
    try {
      const params: ReportQuery = {
        departmentIds: selectedDeptKeys.map(Number),
        keyword: keyword || undefined,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        status: statusList.length ? statusList.join(',') : undefined,
        page,
        pageSize: pagination.pageSize,
      }
      const res = await getAttendanceReport(params)
      if (res.code === 0) {
        setData(res.data)
        setPagination((prev) => ({ ...prev, current: page, total: res.data.total || 0 }))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(1)
  }, [])

  const handleSearch = () => {
    loadData(1)
  }

  const handleReset = () => {
    setSelectedDeptKeys([])
    setKeyword('')
    setDateRange([dayjs().startOf('month'), dayjs().endOf('month')])
    setStatusList([])
    setTimeout(() => loadData(1), 0)
  }

  const handlePageChange = (page: number) => {
    loadData(page)
  }

  const totalLateDays = useMemo(() => {
    if (!data?.list) return 0
    return data.list.reduce((sum: number, item: any) => sum + (item.lateDays || 0), 0)
  }, [data])

  const totalAbsentDays = useMemo(() => {
    if (!data?.list) return 0
    return data.list.reduce((sum: number, item: any) => sum + (item.absentDays || 0), 0)
  }, [data])

  const employeeColumns = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 120 },
    { title: '部门', dataIndex: 'departmentName', width: 150 },
    { title: '应出勤', dataIndex: 'workDays', width: 100 },
    { title: '正常', dataIndex: 'normalDays', width: 80 },
    { title: '迟到', dataIndex: 'lateDays', width: 80 },
    { title: '早退', dataIndex: 'earlyDays', width: 80 },
    { title: '缺勤', dataIndex: 'absentDays', width: 80 },
    { title: '加班(h)', dataIndex: 'overtimeHours', width: 100, render: (v: number) => (v ?? 0).toFixed(2) },
    { title: '工时(h)', dataIndex: 'totalHours', width: 100, render: (v: number) => (v ?? 0).toFixed(2) },
    {
      title: '出勤率',
      dataIndex: 'attendanceRate',
      width: 120,
      render: (v: number) => (
        <Progress percent={v} size="small" className={styles['attendance-progress']} />
      ),
    },
  ]

  const dailyTrendOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.dailyTrend || []
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: list.map((item: any) => item.date || item.day || ''),
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      series: [
        {
          name: '出勤率',
          type: 'line',
          smooth: true,
          data: list.map((item: any) => item.attendanceRate ?? item.rate ?? 0),
          areaStyle: { opacity: 0.2 },
          itemStyle: { color: '#10B981' },
        },
      ],
    }
  }, [data])

  const departmentCompareOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.departmentCompare || []
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 30, bottom: 60 },
      xAxis: {
        type: 'category',
        data: list.map((item: any) => item.departmentName || item.name || ''),
        axisLabel: { fontSize: 11, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      series: [
        {
          name: '出勤率',
          type: 'bar',
          data: list.map((item: any) => item.avgAttendanceRate ?? item.rate ?? 0),
          itemStyle: { color: '#00B42A' },
          barWidth: '50%',
        },
      ],
    }
  }, [data])

  const statusPieOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.statusPie || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '考勤状态',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          data: list.map((item: any) => ({
            name: statusLabelMap[item.status || ''] || item.status || item.name || '',
            value: item.count ?? item.value ?? 0,
          })),
        },
      ],
    }
  }, [data])

  const departmentRankingOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.departmentRanking || data?.departmentRanking || []
    const sorted = [...list].sort(
      (a: any, b: any) => (b.avgAttendanceRate ?? b.rate ?? 0) - (a.avgAttendanceRate ?? a.rate ?? 0),
    )
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 100, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((item: any) => item.departmentName || item.name || ''),
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '出勤率',
          type: 'bar',
          data: sorted.map((item: any) => item.avgAttendanceRate ?? item.rate ?? 0),
          itemStyle: { color: '#722ED1' },
          barWidth: '60%',
        },
      ],
    }
  }, [data])

  const handleTreeCheck = (checkedKeys: string[]) => {
    setSelectedDeptKeys(checkedKeys)
  }

  const deptTreeContent = (
    <div className={styles['dept-tree-popover']}>
      <Spin loading={treeLoading} className={styles['tree-spin']}>
        <Tree
          checkable
          selectable={false}
          treeData={departmentTree}
          checkedKeys={selectedDeptKeys}
          onCheck={handleTreeCheck}
          size="small"
          className={styles['dept-tree']}
        />
      </Spin>
    </div>
  )

  return (
    <div className={styles['attendance-report']}>
      <Card className={styles['filter-card']}>
        <div className={styles['filter-bar']}>
          <Space size="medium" wrap>
            <Popover
              triggerProps={{ position: 'bl' }}
              content={deptTreeContent}
              trigger="click"
            >
              <Button icon={<IconFilter />} className={styles['dept-filter-btn']}>
                部门筛选
                {selectedDeptKeys.length > 0 && (
                  <Tag color="blue" className={styles['dept-filter-tag']}>
                    {selectedDeptKeys.length}
                  </Tag>
                )}
              </Button>
            </Popover>
            <Search
              placeholder="搜索员工姓名/工号"
              className={styles['search-input']}
              value={keyword}
              onChange={setKeyword}
              onSearch={handleSearch}
            />
            <RangePicker
              value={dateRange}
              onChange={(_, date) => setDateRange(date)}
              className={styles['date-range-picker']}
            />
            <Select
              mode="multiple"
              placeholder="考勤状态"
              className={styles['status-select']}
              value={statusList}
              onChange={setStatusList}
            >
              {statusOptions.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
            <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<IconRefresh />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </div>
      </Card>

      <Spin loading={loading} className={styles['page-spin']}>
        {data && (
          <>
            <Row gutter={16} className={styles['stats-row']}>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="总员工数"
                    value={data.totalEmployees || 0}
                    suffix="人"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="平均出勤率"
                    value={data.avgAttendanceRate || 0}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="迟到总次数"
                    value={totalLateDays}
                    suffix="次"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="缺勤总天数"
                    value={totalAbsentDays}
                    suffix="天"
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="考勤率趋势" className={styles['chart-card']}>
                  <EChart option={dailyTrendOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="部门对比" className={styles['chart-card']}>
                  <EChart option={departmentCompareOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="考勤状态分布" className={styles['chart-card']}>
                  <EChart option={statusPieOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="部门出勤率排名" className={styles['chart-card']}>
                  <EChart option={departmentRankingOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Card
              title="员工明细"
              className={styles['table-card']}
              extra={
                <Button icon={<IconDownload />} onClick={() => {}}>
                  导出CSV
                </Button>
              }
            >
              <Table
                columns={employeeColumns}
                data={data.list || []}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onChange: handlePageChange,
                }}
                scroll={{ x: 1200 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default AttendanceReport
