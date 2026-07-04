import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  DatePicker,
  Table,
  Spin,
  Statistic,
  Button,
  Space,
  Tree,
  Popover,
  Grid,
  Tag,
  Progress,
} from '@arco-design/web-react'
import { IconSearch, IconRefresh, IconDownload, IconFilter } from '@arco-design/web-react/icon'
import dayjs, { Dayjs } from 'dayjs'
import { getAttendanceRanking, ReportQuery } from '@/api/reports'
import { getDepartmentTree, Department } from '@/api/organization'
import EChart from '@/components/EChart'
import type { EChartsOption } from 'echarts'
import styles from './style.module.css'
const { Row, Col } = Grid
const { RangePicker } = DatePicker

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

interface DepartmentRankingItem {
  departmentName: string
  employeeCount: number
  totalWorkDays: number
  normalDays: number
  lateDays: number
  earlyDays: number
  absentDays: number
  attendanceRate: number
}

interface DepartmentRankingData {
  list: DepartmentRankingItem[]
  startDate: string
  endDate: string
  total: number
}

const DepartmentRankingReport: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [departmentTree, setDepartmentTree] = useState<TreeNode[]>([])
  const [selectedDeptKeys, setSelectedDeptKeys] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<Dayjs[]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [data, setData] = useState<DepartmentRankingData | null>(null)

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
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      }
      const res = await getAttendanceRanking(params)
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
    setDateRange([dayjs().startOf('month'), dayjs().endOf('month')])
    setTimeout(() => loadData(), 0)
  }

  const stats = useMemo(() => {
    const list = data?.list || []
    if (!list.length) {
      return {
        totalDepartments: 0,
        avgAttendanceRate: 0,
        maxAttendanceRate: 0,
        minAttendanceRate: 0,
      }
    }
    const rates = list.map((item: any) => item.attendanceRate ?? 0)
    const avg = rates.reduce((sum: number, rate: number) => sum + rate, 0) / rates.length
    return {
      totalDepartments: list.length,
      avgAttendanceRate: Number(avg.toFixed(2)),
      maxAttendanceRate: Math.max(...rates),
      minAttendanceRate: Math.min(...rates),
    }
  }, [data])

  const sortedList = useMemo(() => {
    const list = data?.list || []
    return [...list].sort(
      (a: any, b: any) => (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0),
    )
  }, [data])

  const rankingChartOption: EChartsOption = useMemo(() => {
    const list = sortedList
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 30, top: 30, bottom: 40 },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: list.map((item: any) => item.departmentName || item.name || ''),
        axisLabel: { fontSize: 12 },
        inverse: false,
      },
      series: [
        {
          name: '出勤率',
          type: 'bar',
          data: list.map((item: any) => item.attendanceRate ?? 0),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#10B981' },
                { offset: 1, color: '#4080FF' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            fontSize: 12,
          },
        },
      ],
    }
  }, [sortedList])

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => {
        const rank = index + 1
        let color = ''
        if (rank === 1) color = '#FF7D00'
        else if (rank === 2) color = '#86909C'
        else if (rank === 3) color = '#FF7D00'
        return (
          <span className={styles['department-ranking__rank']} style={{ color, fontWeight: rank <= 3 ? 600 : 400 }}>
            {rank}
          </span>
        )
      },
    },
    { title: '部门名称', dataIndex: 'departmentName', width: 180 },
    { title: '员工数', dataIndex: 'employeeCount', width: 100 },
    { title: '总工作日', dataIndex: 'totalWorkDays', width: 100 },
    { title: '正常天数', dataIndex: 'normalDays', width: 100 },
    { title: '迟到天数', dataIndex: 'lateDays', width: 100 },
    { title: '早退天数', dataIndex: 'earlyDays', width: 100 },
    { title: '缺勤天数', dataIndex: 'absentDays', width: 100 },
    {
      title: '出勤率',
      dataIndex: 'attendanceRate',
      width: 160,
      render: (v: number) => (
        <Progress percent={v} size="small" className={styles['attendance-progress']} />
      ),
    },
  ]

  const handleTreeCheck = (checkedKeys: string[]) => {
    setSelectedDeptKeys(checkedKeys)
  }

  const handleExport = () => {
    if (!sortedList.length) return

    const headers = [
      '排名',
      '部门名称',
      '员工数',
      '总工作日',
      '正常天数',
      '迟到天数',
      '早退天数',
      '缺勤天数',
      '出勤率(%)',
    ]
    let csvContent = headers.join(',') + '\n'

    sortedList.forEach((row: any, index: number) => {
      const values = [
        index + 1,
        row.departmentName || row.name || '',
        row.employeeCount ?? 0,
        row.totalWorkDays ?? 0,
        row.normalDays ?? 0,
        row.lateDays ?? 0,
        row.earlyDays ?? 0,
        row.absentDays ?? 0,
        row.attendanceRate ?? 0,
      ]
      csvContent += values.join(',') + '\n'
    })

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const start = dateRange?.[0]?.format('YYYYMMDD') || ''
    const end = dateRange?.[1]?.format('YYYYMMDD') || ''
    a.download = `部门考勤排名报表_${start}_${end}.csv`
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
    <div className={styles['department-ranking-report']}>
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
                    title="部门总数"
                    value={stats.totalDepartments}
                    suffix="个"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="平均出勤率"
                    value={stats.avgAttendanceRate}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="最高出勤率"
                    value={stats.maxAttendanceRate}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className={styles['stat-card']}>
                  <Statistic
                    title="最低出勤率"
                    value={stats.minAttendanceRate}
                    suffix="%"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="部门出勤率排名" className={styles['chart-card']}>
              <EChart option={rankingChartOption} className={styles['chart-container']} />
            </Card>

            <Card
              title="排名明细"
              className={styles['table-card']}
              extra={
                <Button icon={<IconDownload />} onClick={handleExport}>
                  导出CSV
                </Button>
              }
            >
              <Table
                columns={columns}
                data={sortedList}
                pagination={false}
                scroll={{ x: 1200 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default DepartmentRankingReport
