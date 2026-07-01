import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
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
import { getLeaveOvertimeReport, ReportQuery, ChartData } from '@/api/reports'
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

interface LeaveOvertimeItem {
  employeeNo: string
  employeeName: string
  departmentName: string
  leaveDays: number
  overtimeHours: number
  leaveTypes: Record<string, number>
}

interface LeaveOvertimeReportData {
  list: LeaveOvertimeItem[]
  chartData?: ChartData
  startDate: string
  endDate: string
  total: number
  totalLeaveDays: number
  totalOvertimeHours: number
}

const LeaveOvertimeReport: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [departmentTree, setDepartmentTree] = useState<TreeNode[]>([])
  const [selectedDeptKeys, setSelectedDeptKeys] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<Dayjs[]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [data, setData] = useState<LeaveOvertimeReportData | null>(null)

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
        page,
        pageSize: pagination.pageSize,
      }
      const res = await getLeaveOvertimeReport(params)
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
    setTimeout(() => loadData(1), 0)
  }

  const handlePageChange = (page: number) => {
    loadData(page)
  }

  const employeeCount = useMemo(() => {
    return data?.total || 0
  }, [data])

  const avgLeaveDays = useMemo(() => {
    if (!data?.totalLeaveDays || !employeeCount) return 0
    return (data.totalLeaveDays / employeeCount).toFixed(2)
  }, [data, employeeCount])

  const employeeColumns = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 120 },
    { title: '部门', dataIndex: 'departmentName', width: 150 },
    { title: '请假天数', dataIndex: 'leaveDays', width: 100, render: (v: number) => (v ?? 0).toFixed(2) },
    { title: '加班工时(h)', dataIndex: 'overtimeHours', width: 110, render: (v: number) => (v ?? 0).toFixed(2) },
    {
      title: '请假类型分布',
      dataIndex: 'leaveTypes',
      render: (types: Record<string, number>) => (
        <Space wrap size="small">
          {types && Object.entries(types).map(([type, days]) => (
            <Tag key={type} color="orange">
              {type}: {Number(days).toFixed(2)}天
            </Tag>
          ))}
        </Space>
      ),
    },
  ]

  const leaveTypePieOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.leaveTypePie || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}天 ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '请假类型',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          data: list.map((item: any) => ({
            name: item.type || item.name || '',
            value: item.days ?? item.value ?? 0,
          })),
        },
      ],
    }
  }, [data])

  const overtimeTypePieOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.overtimeTypePie || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}h ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '加班类型',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          data: list.map((item: any) => ({
            name: item.type || item.name || '',
            value: item.hours ?? item.value ?? 0,
          })),
        },
      ],
    }
  }, [data])

  const departmentCompareOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.departmentCompare || []
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['请假天数', '加班工时'], top: 0 },
      grid: { left: 50, right: 50, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: list.map((item: any) => item.departmentName || item.name || ''),
        axisLabel: { fontSize: 11, rotate: 30 },
      },
      yAxis: [
        {
          type: 'value',
          name: '请假天数',
          position: 'left',
          axisLabel: { formatter: '{value}天' },
        },
        {
          type: 'value',
          name: '加班工时',
          position: 'right',
          axisLabel: { formatter: '{value}h' },
        },
      ],
      series: [
        {
          name: '请假天数',
          type: 'bar',
          yAxisIndex: 0,
          data: list.map((item: any) => item.leaveDays ?? item.days ?? 0),
          itemStyle: { color: '#F53F3F' },
          barWidth: '35%',
        },
        {
          name: '加班工时',
          type: 'bar',
          yAxisIndex: 1,
          data: list.map((item: any) => item.overtimeHours ?? item.hours ?? 0),
          itemStyle: { color: '#165DFF' },
          barWidth: '35%',
        },
      ],
    }
  }, [data])

  const monthlyTrendOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.monthlyTrend || []
    if (!list.length) {
      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0 },
        grid: { left: 50, right: 20, top: 40, bottom: 40 },
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value', axisLabel: { formatter: '{value}天' } },
        series: [],
      }
    }
    const months = list.map((item: any) => item.month || item.name || '')
    const leaveTypes = Object.keys(list[0] || {}).filter(
      (key) => key !== 'month' && key !== 'name' && key !== 'total',
    )
    const colorPalette = ['#F53F3F', '#FF7D00', '#FF9A2E', '#F7BA1E', '#00B42A', '#14C9C9', '#165DFF', '#722ED1']
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: leaveTypes, top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}天' },
      },
      series: leaveTypes.map((type, index) => ({
        name: type,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: list.map((item: any) => item[type] ?? 0),
        itemStyle: { color: colorPalette[index % colorPalette.length] },
      })),
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

  const handleExport = () => {
    if (!data?.list) return

    let csvContent = '工号,姓名,部门,请假天数,加班工时\n'
    data.list.forEach((row: any) => {
      csvContent += `${row.employeeNo},${row.employeeName},${row.departmentName},${(row.leaveDays ?? 0).toFixed(2)},${(row.overtimeHours ?? 0).toFixed(2)}\n`
    })

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const start = dateRange?.[0]?.format('YYYYMMDD') || ''
    const end = dateRange?.[1]?.format('YYYYMMDD') || ''
    a.download = `加班请假统计报表_${start}_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles['leave-overtime-report']}>
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
                    title="请假总天数"
                    value={(data.totalLeaveDays || 0).toFixed(2)}
                    suffix="天"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="加班总工时"
                    value={(data.totalOvertimeHours || 0).toFixed(2)}
                    suffix="h"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="涉及员工数"
                    value={employeeCount}
                    suffix="人"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="人均请假天数"
                    value={avgLeaveDays}
                    suffix="天"
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="请假类型分布" className={styles['chart-card']}>
                  <EChart option={leaveTypePieOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="加班类型分布" className={styles['chart-card']}>
                  <EChart option={overtimeTypePieOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="部门对比" className={styles['chart-card']}>
                  <EChart option={departmentCompareOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="月度趋势" className={styles['chart-card']}>
                  <EChart option={monthlyTrendOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Card
              title="员工明细"
              className={styles['table-card']}
              extra={
                <Button icon={<IconDownload />} onClick={handleExport}>
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

export default LeaveOvertimeReport
