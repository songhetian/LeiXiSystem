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
import { getAttendanceDetail, ReportQuery } from '@/api/reports'
import { getDepartmentTree, Department } from '@/api/organization'
import './style.css'

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

const statusColorMap: Record<string, string> = {
  normal: 'green',
  late: 'orange',
  early: 'orange',
  absent: 'red',
  leave: 'blue',
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

interface AttendanceDetailItem {
  employeeNo: string
  employeeName: string
  departmentName: string
  date: string
  status: string
  checkIn?: string
  checkOut?: string
  workHours?: number
  lateMinutes?: number
  earlyMinutes?: number
  absentMinutes?: number
  overtimeMinutes?: number
}

interface AttendanceDetailData {
  list: AttendanceDetailItem[]
  total: number
  page: number
  pageSize: number
  startDate: string
  endDate: string
}

const AttendanceDetailReport: React.FC = () => {
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
  const [data, setData] = useState<AttendanceDetailData | null>(null)

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
      const res = await getAttendanceDetail(params)
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

  const stats = useMemo(() => {
    if (!data?.list) return { totalRecords: 0, normalDays: 0, lateDays: 0, absentDays: 0 }
    let normalDays = 0
    let lateDays = 0
    let absentDays = 0
    data.list.forEach((item: any) => {
      if (item.status === 'normal') normalDays++
      if (item.status === 'late') lateDays++
      if (item.status === 'absent') absentDays++
    })
    return {
      totalRecords: data.total || 0,
      normalDays,
      lateDays,
      absentDays,
    }
  }, [data])

  const columns = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 150 },
    { title: '日期', dataIndex: 'date', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={statusColorMap[v] || 'gray'}>{statusLabelMap[v] || v}</Tag>
      ),
    },
    { title: '上班打卡', dataIndex: 'checkIn', width: 100 },
    { title: '下班打卡', dataIndex: 'checkOut', width: 100 },
    {
      title: '工作时长(h)',
      dataIndex: 'workHours',
      width: 110,
      render: (v: number) => (v ?? 0).toFixed(2),
    },
    {
      title: '迟到分钟',
      dataIndex: 'lateMinutes',
      width: 100,
      render: (v: number) => (v ?? 0),
    },
    {
      title: '早退分钟',
      dataIndex: 'earlyMinutes',
      width: 100,
      render: (v: number) => (v ?? 0),
    },
    {
      title: '缺勤分钟',
      dataIndex: 'absentMinutes',
      width: 100,
      render: (v: number) => (v ?? 0),
    },
    {
      title: '加班分钟',
      dataIndex: 'overtimeMinutes',
      width: 100,
      render: (v: number) => (v ?? 0),
    },
  ]

  const handleTreeCheck = (checkedKeys: string[]) => {
    setSelectedDeptKeys(checkedKeys)
  }

  const handleExport = () => {
    if (!data?.list) return

    const headers = [
      '工号',
      '姓名',
      '部门',
      '日期',
      '状态',
      '上班打卡',
      '下班打卡',
      '工作时长(h)',
      '迟到分钟',
      '早退分钟',
      '缺勤分钟',
      '加班分钟',
    ]
    let csvContent = headers.join(',') + '\n'

    data.list.forEach((row: any) => {
      const values = [
        row.employeeNo || '',
        row.employeeName || '',
        row.departmentName || '',
        row.date || '',
        statusLabelMap[row.status] || row.status || '',
        row.checkIn || '',
        row.checkOut || '',
        (row.workHours ?? 0).toFixed(2),
        row.lateMinutes ?? 0,
        row.earlyMinutes ?? 0,
        row.absentMinutes ?? 0,
        row.overtimeMinutes ?? 0,
      ]
      csvContent += values.join(',') + '\n'
    })

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const start = dateRange?.[0]?.format('YYYYMMDD') || ''
    const end = dateRange?.[1]?.format('YYYYMMDD') || ''
    a.download = `员工考勤明细报表_${start}_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deptTreeContent = (
    <div className="dept-tree-popover">
      <Spin loading={treeLoading} className="tree-spin">
        <Tree
          checkable
          selectable={false}
          treeData={departmentTree}
          checkedKeys={selectedDeptKeys}
          onCheck={handleTreeCheck}
          size="small"
          className="dept-tree"
        />
      </Spin>
    </div>
  )

  return (
    <div className="attendance-detail-report">
      <Card className="filter-card">
        <div className="filter-bar">
          <Space size="medium" wrap>
            <Popover
              triggerProps={{ position: 'bl' }}
              content={deptTreeContent}
              trigger="click"
            >
              <Button icon={<IconFilter />} className="dept-filter-btn">
                部门筛选
                {selectedDeptKeys.length > 0 && (
                  <Tag color="blue" className="dept-filter-tag">
                    {selectedDeptKeys.length}
                  </Tag>
                )}
              </Button>
            </Popover>
            <Search
              placeholder="搜索员工姓名/工号"
              className="search-input"
              value={keyword}
              onChange={setKeyword}
              onSearch={handleSearch}
            />
            <RangePicker
              value={dateRange}
              onChange={(_, date) => setDateRange(date)}
              className="date-range-picker"
            />
            <Select
              mode="multiple"
              placeholder="考勤状态"
              className="status-select"
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

      <Spin loading={loading} className="page-spin">
        {data && (
          <>
            <Row gutter={16} className="stats-row">
              <Col span={6}>
                <Card className="stat-card">
                  <Statistic
                    title="总记录数"
                    value={stats.totalRecords}
                    suffix="条"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card">
                  <Statistic
                    title="正常天数"
                    value={stats.normalDays}
                    suffix="天"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card">
                  <Statistic
                    title="迟到天数"
                    value={stats.lateDays}
                    suffix="天"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card">
                  <Statistic
                    title="缺勤天数"
                    value={stats.absentDays}
                    suffix="天"
                  />
                </Card>
              </Col>
            </Row>

            <Card
              title="考勤明细"
              className="table-card"
              extra={
                <Button icon={<IconDownload />} onClick={handleExport}>
                  导出CSV
                </Button>
              }
            >
              <Table
                columns={columns}
                data={data.list || []}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onChange: handlePageChange,
                }}
                scroll={{ x: 1400 }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default AttendanceDetailReport
