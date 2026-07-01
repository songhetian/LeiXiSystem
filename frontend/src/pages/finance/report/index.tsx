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
import { getFinanceReport, ReportQuery, ChartData } from '@/api/reports'
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

const FinanceReport: React.FC = () => {
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
  const [data, setData] = useState<{
    summary?: {
      totalSalary?: number
      totalReimbursement?: number
      totalExpense?: number
      employeeCount?: number
    }
    departmentSummary?: {
      departmentName?: string
      employeeCount?: number
      totalSalary?: number
      totalReimbursement?: number
      totalExpense?: number
    }[]
    chartData?: {
      expensePie?: { name?: string; type?: string; value?: number; amount?: number }[]
      departmentCompare?: {
        departmentName?: string
        name?: string
        totalSalary?: number
        totalReimbursement?: number
        salary?: number
        reimbursement?: number
      }[]
      monthlyTrend?: {
        month?: string
        date?: string
        totalSalary?: number
        totalReimbursement?: number
        totalExpense?: number
        salary?: number
        reimbursement?: number
        expense?: number
      }[]
    }
  } | null>(null)

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
      const res = await getFinanceReport(params)
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

  const departmentColumns = [
    { title: '部门', dataIndex: 'departmentName', width: 200 },
    { title: '员工数', dataIndex: 'employeeCount', width: 100 },
    { title: '工资总额', dataIndex: 'totalSalary', width: 150, render: (v: number) => `¥${(v ?? 0).toFixed(2)}` },
    { title: '报销总额', dataIndex: 'totalReimbursement', width: 150, render: (v: number) => `¥${(v ?? 0).toFixed(2)}` },
    { title: '总支出', dataIndex: 'totalExpense', width: 150, render: (v: number) => `¥${(v ?? 0).toFixed(2)}` },
    {
      title: '人均支出',
      dataIndex: 'avgExpense',
      width: 150,
      render: (_: number, record: any) => {
        const avg = record.employeeCount ? record.totalExpense / record.employeeCount : 0
        return `¥${avg.toFixed(2)}`
      },
    },
  ]

  const expensePieOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.expensePie || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '支出构成',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          data: list.map((item: any) => ({
            name: item.name || item.type || '',
            value: item.value ?? item.amount ?? 0,
          })),
          color: ['#165DFF', '#00B42A'],
        },
      ],
    }
  }, [data])

  const departmentCompareOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.departmentCompare || data?.departmentSummary || []
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['工资', '报销'], top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: list.map((item: any) => item.departmentName || item.name || ''),
        axisLabel: { fontSize: 11, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '¥{value}' },
      },
      series: [
        {
          name: '工资',
          type: 'bar',
          stack: 'total',
          data: list.map((item: any) => item.totalSalary ?? item.salary ?? 0),
          itemStyle: { color: '#165DFF' },
          barWidth: '50%',
        },
        {
          name: '报销',
          type: 'bar',
          stack: 'total',
          data: list.map((item: any) => item.totalReimbursement ?? item.reimbursement ?? 0),
          itemStyle: { color: '#00B42A' },
          barWidth: '50%',
        },
      ],
    }
  }, [data])

  const monthlyTrendOption: EChartsOption = useMemo(() => {
    const chartData = data?.chartData as ChartData | undefined
    const list = chartData?.monthlyTrend || []
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['工资', '报销', '总支出'], top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: list.map((item: any) => item.month || item.date || ''),
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '¥{value}' },
      },
      series: [
        {
          name: '工资',
          type: 'line',
          smooth: true,
          data: list.map((item: any) => item.totalSalary ?? item.salary ?? 0),
          itemStyle: { color: '#165DFF' },
        },
        {
          name: '报销',
          type: 'line',
          smooth: true,
          data: list.map((item: any) => item.totalReimbursement ?? item.reimbursement ?? 0),
          itemStyle: { color: '#00B42A' },
        },
        {
          name: '总支出',
          type: 'line',
          smooth: true,
          data: list.map((item: any) => item.totalExpense ?? item.expense ?? 0),
          itemStyle: { color: '#F53F3F' },
        },
      ],
    }
  }, [data])

  const deptAvgExpenseOption: EChartsOption = useMemo(() => {
    const list = data?.departmentSummary || []
    const sorted = [...list].map((item: any) => ({
      ...item,
      avgExpense: item.employeeCount ? item.totalExpense / item.employeeCount : 0,
    })).sort((a: any, b: any) => b.avgExpense - a.avgExpense)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: ¥{c}' },
      grid: { left: 100, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: '¥{value}' },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((item: any) => item.departmentName || item.name || ''),
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '人均支出',
          type: 'bar',
          data: sorted.map((item: any) => item.avgExpense),
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

  const handleExport = () => {
    if (!data?.departmentSummary) return

    let csvContent = '部门,员工数,工资总额,报销总额,总支出,人均支出\n'
    data.departmentSummary.forEach((row: any) => {
      const avgExpense = row.employeeCount ? row.totalExpense / row.employeeCount : 0
      csvContent += `${row.departmentName},${row.employeeCount},${row.totalSalary.toFixed(2)},${row.totalReimbursement.toFixed(2)},${row.totalExpense.toFixed(2)},${avgExpense.toFixed(2)}\n`
    })

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `财务报表_${dateRange?.[0]?.format('YYYYMMDD')}_${dateRange?.[1]?.format('YYYYMMDD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles['finance-report']}>
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
                    title="工资总额"
                    value={data.summary?.totalSalary || 0}
                    prefix="¥"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="报销总额"
                    value={data.summary?.totalReimbursement || 0}
                    prefix="¥"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="总支出"
                    value={data.summary?.totalExpense || 0}
                    prefix="¥"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="员工人数"
                    value={data.summary?.employeeCount || 0}
                    suffix="人"
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="支出构成" className={styles['chart-card']}>
                  <EChart option={expensePieOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="部门支出对比" className={styles['chart-card']}>
                  <EChart option={departmentCompareOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="月度支出趋势" className={styles['chart-card']}>
                  <EChart option={monthlyTrendOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="部门人均支出" className={styles['chart-card']}>
                  <EChart option={deptAvgExpenseOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Card
              title="部门支出明细"
              className={styles['table-card']}
              extra={
                <Button icon={<IconDownload />} onClick={handleExport}>
                  导出CSV
                </Button>
              }
            >
              <Table
                columns={departmentColumns}
                data={data.departmentSummary || []}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onChange: handlePageChange,
                }}
                scroll={{ x: 1000 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default FinanceReport
