import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Select,
  Table,
  Spin,
  Statistic,
  Button,
  Space,
  Tree,
  Popover,
  Grid,
  Tag,
} from '@arco-design/web-react'
import { IconSearch, IconRefresh, IconDownload, IconFilter, IconArrowUp, IconArrowDown } from '@arco-design/web-react/icon'
import dayjs from 'dayjs'
import { getAttendanceTrend, ReportQuery } from '@/api/reports'
import { getDepartmentTree, Department } from '@/api/organization'
import EChart from '@/components/EChart'
import type { EChartsOption } from 'echarts'
import styles from './style.module.css'
const { Row, Col } = Grid
const Option = Select.Option

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

const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

interface YearOverYearItem {
  month: number
  thisYearRate: number
  lastYearRate: number
}

interface MonthOverMonthItem {
  month: number
  rate: number
  change: number
  lastMonthRate: number
}

interface TrendReportData {
  year: number
  thisYear: {
    total: number
    normal: number
    avgAttendanceRate: number
  }
  lastYear: {
    total: number
    normal: number
    avgAttendanceRate: number
  }
  yearOverYear: YearOverYearItem[]
  monthOverMonth: MonthOverMonthItem[]
}

const TrendAnalysisReport: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [departmentTree, setDepartmentTree] = useState<TreeNode[]>([])
  const [selectedDeptKeys, setSelectedDeptKeys] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year())
  const [data, setData] = useState<TrendReportData | null>(null)

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year()
    const years = []
    for (let i = currentYear - 5; i <= currentYear; i++) {
      years.push(i)
    }
    return years
  }, [])

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

  const loadData = async () => {
    setLoading(true)
    try {
      const params: ReportQuery = {
        departmentIds: selectedDeptKeys.map(Number),
        year: selectedYear,
      }
      const res = await getAttendanceTrend(params)
      if (res.code === 0) {
        setData(res.data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSearch = () => {
    loadData()
  }

  const handleReset = () => {
    setSelectedDeptKeys([])
    setSelectedYear(dayjs().year())
    setTimeout(() => loadData(), 0)
  }

  const yearOverYearData = useMemo(() => data?.yearOverYear || [], [data])
  const monthOverMonthData = useMemo(() => data?.monthOverMonth || [], [data])

  const stats = useMemo(() => {
    const thisYearAvg = data?.thisYear?.avgAttendanceRate ?? 0
    const lastYearAvg = data?.lastYear?.avgAttendanceRate ?? 0
    const yearOverYearChange = thisYearAvg - lastYearAvg
    const monthOverMonthChange = monthOverMonthData.length
      ? monthOverMonthData[monthOverMonthData.length - 1]?.change ?? 0
      : 0
    return {
      thisYearAvg: Number(thisYearAvg.toFixed(2)),
      lastYearAvg: Number(lastYearAvg.toFixed(2)),
      yearOverYearChange: Number(yearOverYearChange.toFixed(2)),
      monthOverMonthChange: Number(monthOverMonthChange.toFixed(2)),
    }
  }, [data, monthOverMonthData])

  const yearOverYearOption: EChartsOption = useMemo(() => {
    const months = monthNames
    const thisYearData = new Array(12).fill(0)
    const lastYearData = new Array(12).fill(0)

    yearOverYearData.forEach((item: any) => {
      const month = (item.month ?? 1) - 1
      thisYearData[month] = item.thisYearRate ?? 0
      lastYearData[month] = item.lastYearRate ?? 0
    })

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['今年', '去年'], top: 0 },
      grid: { left: 50, right: 20, top: 50, bottom: 40 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      series: [
        {
          name: '今年',
          type: 'bar',
          data: thisYearData,
          itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] },
          barWidth: '30%',
        },
        {
          name: '去年',
          type: 'bar',
          data: lastYearData,
          itemStyle: { color: '#9CA3AF', borderRadius: [4, 4, 0, 0] },
          barWidth: '30%',
        },
      ],
    }
  }, [yearOverYearData])

  const monthOverMonthOption: EChartsOption = useMemo(() => {
    const months = monthOverMonthData.map((item: any) => `${item.month}月` || '')
    const rates = monthOverMonthData.map((item: any) => item.rate ?? 0)

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0]
          const item = monthOverMonthData[data.dataIndex]
          let changeText = ''
          if (item?.change > 0) {
            changeText = `<br/>环比: +${item.change}%`
          } else if (item?.change < 0) {
            changeText = `<br/>环比: ${item.change}%`
          }
          return `${data.name}<br/>出勤率: ${data.value}%${changeText}`
        },
      },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: months,
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
          data: rates,
          areaStyle: {
            opacity: 0.2,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#10B981' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.1)' },
              ],
            },
          },
          itemStyle: { color: '#10B981' },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 8,
        },
      ],
    }
  }, [monthOverMonthData])

  const tableData = useMemo(() => {
    return yearOverYearData.map((item: any, index: number) => {
      const monthItem = monthOverMonthData[index] || {}
      const thisYearRate = item.thisYearRate ?? 0
      const lastYearRate = item.lastYearRate ?? 0
      const yearDiff = Number((thisYearRate - lastYearRate).toFixed(2))
      const yearChangeRate = lastYearRate
        ? Number(((yearDiff / lastYearRate) * 100).toFixed(2))
        : 0
      const lastMonthRate = monthItem.lastMonthRate ?? 0
      const monthDiff = monthItem.change ?? 0
      return {
        month: `${item.month}月`,
        thisYearRate,
        lastYearRate,
        yearDiff,
        yearChangeRate,
        lastMonthRate,
        monthDiff,
      }
    })
  }, [yearOverYearData, monthOverMonthData])

  const columns = [
    { title: '月份', dataIndex: 'month', width: 100 },
    { title: '今年出勤率(%)', dataIndex: 'thisYearRate', width: 140 },
    { title: '去年出勤率(%)', dataIndex: 'lastYearRate', width: 140 },
    {
      title: '同比差值',
      dataIndex: 'yearDiff',
      width: 120,
      render: (v: number) => (
        <span className={v >= 0 ? 'trend-analysis-report stat-positive' : 'trend-analysis-report stat-negative'}>
          {v >= 0 ? '+' : ''}{v}
        </span>
      ),
    },
    {
      title: '同比变化率',
      dataIndex: 'yearChangeRate',
      width: 130,
      render: (v: number) => (
        <span className={v >= 0 ? 'trend-analysis-report stat-positive' : 'trend-analysis-report stat-negative'}>
          {v >= 0 ? '+' : ''}{v}%
        </span>
      ),
    },
    { title: '上月出勤率(%)', dataIndex: 'lastMonthRate', width: 140 },
    {
      title: '环比差值',
      dataIndex: 'monthDiff',
      width: 120,
      render: (v: number) => (
        <span className={v >= 0 ? 'trend-analysis-report stat-positive' : 'trend-analysis-report stat-negative'}>
          {v >= 0 ? '+' : ''}{v}
        </span>
      ),
    },
  ]

  const handleTreeCheck = (checkedKeys: string[]) => {
    setSelectedDeptKeys(checkedKeys)
  }

  const handleExport = () => {
    if (!tableData.length) return

    const headers = [
      '月份',
      '今年出勤率(%)',
      '去年出勤率(%)',
      '同比差值',
      '同比变化率(%)',
      '上月出勤率(%)',
      '环比差值',
    ]
    let csvContent = headers.join(',') + '\n'

    tableData.forEach((row: any) => {
      const values = [
        row.month,
        row.thisYearRate,
        row.lastYearRate,
        row.yearDiff,
        row.yearChangeRate,
        row.lastMonthRate,
        row.monthDiff,
      ]
      csvContent += values.join(',') + '\n'
    })

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `同比环比分析报表_${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
    <div className={styles['trend-analysis-report']}>
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
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              className={styles['year-select']}
            >
              {yearOptions.map((year) => (
                <Option key={year} value={year}>
                  {year}年
                </Option>
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
                    title="今年平均出勤率"
                    value={stats.thisYearAvg}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="去年平均出勤率"
                    value={stats.lastYearAvg}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="同比变化"
                    value={Math.abs(stats.yearOverYearChange)}
                    suffix="%"
                    prefix={
                      stats.yearOverYearChange >= 0 ? (
                        <IconArrowUp className={styles['trend-analysis-report'] + ' ' + styles['icon-up']} />
                      ) : (
                        <IconArrowDown className={styles['trend-analysis-report'] + ' ' + styles['icon-down']} />
                      )
                    }
                    
                      
                    
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="环比变化"
                    value={Math.abs(stats.monthOverMonthChange)}
                    suffix="%"
                    prefix={
                      stats.monthOverMonthChange >= 0 ? (
                        <IconArrowUp className={styles['trend-analysis-report'] + ' ' + styles['icon-up']} />
                      ) : (
                        <IconArrowDown className={styles['trend-analysis-report'] + ' ' + styles['icon-down']} />
                      )
                    }
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className={styles['charts-row']}>
              <Col span={12}>
                <Card title="同比对比" className={styles['chart-card']}>
                  <EChart option={yearOverYearOption} className={styles['chart-container']} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="环比趋势" className={styles['chart-card']}>
                  <EChart option={monthOverMonthOption} className={styles['chart-container']} />
                </Card>
              </Col>
            </Row>

            <Card
              title="明细数据"
              className={styles['table-card']}
              extra={
                <Button icon={<IconDownload />} onClick={handleExport}>
                  导出CSV
                </Button>
              }
            >
              <Table
                columns={columns}
                data={tableData}
                pagination={false}
                scroll={{ x: 1000 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default TrendAnalysisReport
