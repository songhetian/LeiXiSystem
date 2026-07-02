import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Select,
  DatePicker,
  Table,
  Spin,
  Statistic,
  Button,
  Space,
  Input,
  Tree,
  Popover,
  Grid,
  Tag,
} from '@arco-design/web-react'
import { IconSearch, IconRefresh, IconDownload, IconFilter } from '@arco-design/web-react/icon'
import dayjs, { Dayjs } from 'dayjs'
import { getScheduleReport, ReportQuery, ChartData, ScheduleReportResponse } from '@/api/reports'
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

const typeOptions = [
  { label: '员工统计', value: 'employee' },
  { label: '部门统计', value: 'department' },
  { label: '月度统计', value: 'monthly' },
  { label: '年度统计', value: 'yearly' },
]

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

const ScheduleReport: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [departmentTree, setDepartmentTree] = useState<TreeNode[]>([])
  const [selectedDeptKeys, setSelectedDeptKeys] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<Dayjs[]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [reportType, setReportType] = useState<'employee' | 'department' | 'monthly' | 'yearly'>('employee')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [data, setData] = useState<ScheduleReportResponse['data'] | null>(null)

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
        type: reportType,
        page,
        pageSize: pagination.pageSize,
      }
      const res = await getScheduleReport(params)
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
    setReportType('employee')
    setTimeout(() => loadData(1), 0)
  }

  const handlePageChange = (page: number) => {
    loadData(page)
  }

  const handleTreeCheck = (checkedKeys: string[]) => {
    setSelectedDeptKeys(checkedKeys)
  }

  const totalScheduleDays = useMemo(() => {
    if (!data?.list) return 0
    return data.list.reduce((sum: number, item: any) => sum + (item.totalDays || 0), 0)
  }, [data])

  const totalHours = useMemo(() => {
    if (!data?.list) return 0
    return data.list.reduce((sum: number, item: any) => sum + (item.totalHours || 0), 0)
  }, [data])

  const employeeCount = useMemo(() => {
    if (!data?.list) return 0
    return data.list.length
  }, [data])

  const avgScheduleDays = useMemo(() => {
    if (employeeCount === 0) return 0
    return Number((totalScheduleDays / employeeCount).toFixed(1))
  }, [totalScheduleDays, employeeCount])

  const employeeColumns = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 120 },
    { title: '部门', dataIndex: 'departmentName', width: 150 },
    { title: '排班天数', dataIndex: 'totalDays', width: 100 },
    { title: '总工时', dataIndex: 'totalHours', width: 100, render: (v: number) => `${v}h` },
    {
      title: '班次分布',
      dataIndex: 'shifts',
      render: (shifts: any[]) => (
        <Space>
          {shifts?.map((s: any) => (
            <Tag key={s.shiftId} color="arcoblue">
              {s.shiftName}: {s.count}天
            </Tag>
          ))}
        </Space>
      ),
    },
  ]

  const departmentColumns = [
    { title: '部门', dataIndex: 'departmentName', width: 200 },
    { title: '排班人数', dataIndex: 'employeeCount', width: 100 },
    { title: '总排班天数', dataIndex: 'totalDays', width: 120 },
    { title: '人均天数', dataIndex: 'avgDays', width: 100 },
    {
      title: '班次分布',
      dataIndex: 'shifts',
      render: (shifts: any[]) => (
        <Space>
          {shifts?.map((s: any) => (
            <Tag key={s.shiftId} color="arcoblue">
              {s.shiftName}: {s.count}次
            </Tag>
          ))}
        </Space>
      ),
    },
  ]

  const dailyColumns = [
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '星期', dataIndex: 'weekday', width: 80 },
    { title: '排班人数', dataIndex: 'total', width: 100 },
    {
      title: '班次分布',
      dataIndex: 'shiftCounts',
      render: (counts: Record<number, number>) => {
        const shiftMap = data?.shiftMap || {}
        return (
          <Space>
            {Object.entries(counts).map(([id, count]) => {
              const shift = shiftMap[Number(id)] || { name: `班次${id}` }
              return (
                <Tag key={id} color="arcoblue">
                  {shift.name}: {count}人
                </Tag>
              )
            })}
          </Space>
        )
      },
    },
  ]

  const monthlyColumns = [
    { title: '月份', dataIndex: 'monthName', width: 100 },
    { title: '排班天数', dataIndex: 'totalDays', width: 120 },
    { title: '排班人数', dataIndex: 'employeeCount', width: 120 },
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
        axisLabel: { formatter: '{value}人' },
      },
      series: [
        {
          name: '排班人数',
          type: 'line',
          smooth: true,
          data: list.map((item: any) => item.total ?? item.count ?? 0),
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
        axisLabel: { formatter: '{value}天' },
      },
      series: [
        {
          name: '排班天数',
          type: 'bar',
          data: list.map((item: any) => item.totalDays ?? item.days ?? 0),
          itemStyle: { color: '#00B42A' },
          barWidth: '50%',
        },
      ],
    }
  }, [data])

  const shiftPieOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.shiftPie || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '班次分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          data: list.map((item: any) => ({
            name: item.shiftName || item.name || '',
            value: item.count ?? item.value ?? 0,
          })),
        },
      ],
    }
  }, [data])

  const yearlyTrendOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.yearlyTrend || chartData?.monthlyTrend || []
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: list.map((item: any) => item.month || item.monthName || ''),
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}天' },
      },
      series: [
        {
          name: '排班天数',
          type: 'bar',
          data: list.map((item: any) => item.totalDays ?? item.days ?? 0),
          itemStyle: { color: '#722ED1' },
          barWidth: '50%',
        },
      ],
    }
  }, [data])

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

  const getCurrentColumns = () => {
    switch (reportType) {
      case 'employee':
        return employeeColumns
      case 'department':
        return departmentColumns
      case 'monthly':
        return dailyColumns
      case 'yearly':
        return monthlyColumns
      default:
        return employeeColumns
    }
  }

  const getTableData = () => {
    if (!data) return []
    switch (reportType) {
      case 'employee':
      case 'department':
        return data.list || []
      case 'monthly':
        return data.dailyStats || []
      case 'yearly':
        return data.monthlyData || []
      default:
        return []
    }
  }

  const handleExport = () => {
    if (!data) return

    let csvContent = ''
    const columns = getCurrentColumns()

    csvContent += columns.map((c: any) => c.title).join(',') + '\n'

    const list = getTableData()
    list.forEach((row: any) => {
      csvContent += columns
        .map((c: any) => {
          const val = row[c.dataIndex as string]
          if (c.dataIndex === 'shifts' || c.dataIndex === 'shiftCounts') {
            return JSON.stringify(val)
          }
          return val ?? ''
        })
        .join(',') + '\n'
    })

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `排班报表_${reportType}_${dayjs().format('YYYYMMDD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles['schedule-report']}>
      <Card className={styles['filter-card']}>
        <div className={styles['filter-bar']}>
          <Space size="medium" wrap>
            <Popover triggerProps={{ position: 'bl' }} content={deptTreeContent} trigger="click">
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
              placeholder="统计类型"
              className={styles['type-select']}
              value={reportType}
              onChange={setReportType}
            >
              {typeOptions.map((opt) => (
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
                  <Statistic title="排班总天数" value={totalScheduleDays} suffix="天" />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic title="员工人数" value={employeeCount} suffix="人" />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic title="人均排班天数" value={avgScheduleDays} suffix="天" />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic title="总工时" value={totalHours} suffix="h" />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="每日排班趋势" className={styles['chart-card']}>
                  <EChart option={dailyTrendOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="部门排班对比" className={styles['chart-card']}>
                  <EChart option={departmentCompareOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="班次分布" className={styles['chart-card']}>
                  <EChart option={shiftPieOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="月度趋势" className={styles['chart-card']}>
                  <EChart option={yearlyTrendOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Card
              title="数据明细"
              className={styles['table-card']}
              extra={
                <Button icon={<IconDownload />} onClick={handleExport}>
                  导出CSV
                </Button>
              }
            >
              <Table
                columns={getCurrentColumns()}
                data={getTableData()}
                pagination={
                  reportType === 'employee' || reportType === 'department'
                    ? {
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        onChange: handlePageChange,
                      }
                    : false
                }
                scroll={{ x: 1200 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default ScheduleReport
