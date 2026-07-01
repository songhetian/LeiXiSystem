import { useState, useEffect, useMemo } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Form,
  Tag,
  Card,
  Statistic,
  Grid,
  Tabs,
} from '@arco-design/web-react'
import {
  IconExport,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getAttendanceMonthly } from '@/api/attendance'
import { FilterBar } from '@/components'
import styles from './stats.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface AttendanceStatsRow {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  workDays: number
  actualDays: number
  lateTimes: number
  earlyTimes: number
  absentDays: number
  leaveDays: number
  overtimeHours: number
  attendanceRate: number
}

function getDefaultMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function Stats() {
  const [data, setData] = useState<AttendanceStatsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth())

  const fetchData = async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      const res = await getAttendanceMonthly({ year, month })
      const list = (res.data || []).map((item: any) => ({
        id: item.id,
        employeeName: item.employee?.user?.realName || '-',
        employeeNo: item.employee?.employeeNo || '-',
        department: item.employee?.user?.department?.name || '-',
        workDays: Number(item.expectedWorkDays || 0),
        actualDays: Number(item.actualWorkDays || 0),
        lateTimes: Number(item.lateCount || 0),
        earlyTimes: Number(item.earlyCount || 0),
        absentDays: Number(item.absentDays || 0),
        leaveDays: Number(item.paidLeaveDays || 0) + Number(item.unpaidLeaveDays || 0),
        overtimeHours: Math.round(Number(item.overtimeMinutes || 0) / 60 * 10) / 10,
        attendanceRate: item.expectedWorkDays
          ? Math.round((Number(item.actualWorkDays) / Number(item.expectedWorkDays)) * 1000) / 10
          : 0,
      }))
      setData(list)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  const filteredData = useMemo(() => {
    let result = data
    if (searchText) {
      result = result.filter(
        (item) =>
          item.employeeName.includes(searchText) ||
          item.employeeNo.includes(searchText),
      )
    }
    if (searchDept) {
      result = result.filter((item) => item.department === searchDept)
    }
    return result
  }, [data, searchText, searchDept])

  const departments = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.department).filter(Boolean)))
  }, [data])

  const summaryStats = useMemo(() => {
    const total = filteredData.length
    const avgRate = total > 0
      ? (filteredData.reduce((sum, item) => sum + item.attendanceRate, 0) / total).toFixed(1)
      : '0'
    const totalLate = filteredData.reduce((sum, item) => sum + item.lateTimes, 0)
    const totalOvertime = filteredData.reduce((sum, item) => sum + item.overtimeHours, 0)
    const totalLeave = filteredData.reduce((sum, item) => sum + item.leaveDays, 0)

    return [
      { title: '平均出勤率', value: `${avgRate}%`, color: '#00B42A' },
      { title: '总迟到次数', value: totalLate, color: '#FF7D00' },
      { title: '总加班时长', value: `${totalOvertime}h`, color: '#165DFF' },
      { title: '总请假天数', value: totalLeave, color: '#86909C' },
    ]
  }, [filteredData])

  const columns: TableProps<AttendanceStatsRow>['columns'] = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
      fixed: 'left',
    },
    {
      title: '姓名',
      dataIndex: 'employeeName',
      width: 100,
      fixed: 'left',
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 100,
    },
    {
      title: '应出勤(天)',
      dataIndex: 'workDays',
      width: 100,
      render: (value: number) => <span className={styles['attendance-stats__tabular-nums']}>{value}</span>,
    },
    {
      title: '实出勤(天)',
      dataIndex: 'actualDays',
      width: 100,
      render: (value: number) => <span className={styles['attendance-stats__tabular-nums']}>{value}</span>,
    },
    {
      title: '迟到(次)',
      dataIndex: 'lateTimes',
      width: 90,
      render: (value: number) => (
        <Tag color={value > 0 ? 'orange' : 'green'}>{value}</Tag>
      ),
    },
    {
      title: '早退(次)',
      dataIndex: 'earlyTimes',
      width: 90,
      render: (value: number) => (
        <Tag color={value > 0 ? 'orange' : 'green'}>{value}</Tag>
      ),
    },
    {
      title: '旷工(天)',
      dataIndex: 'absentDays',
      width: 90,
      render: (value: number) => (
        <Tag color={value > 0 ? 'red' : 'green'}>{value}</Tag>
      ),
    },
    {
      title: '请假(天)',
      dataIndex: 'leaveDays',
      width: 90,
      render: (value: number) => <span className={styles['attendance-stats__tabular-nums']}>{value}</span>,
    },
    {
      title: '加班(h)',
      dataIndex: 'overtimeHours',
      width: 90,
      render: (value: number) => <span className={styles['attendance-stats__tabular-nums']}>{value}</span>,
    },
    {
      title: '出勤率',
      dataIndex: 'attendanceRate',
      width: 100,
      fixed: 'right',
      render: (value: number) => (
        <Tag color={value >= 95 ? 'green' : value >= 80 ? 'orange' : 'red'}>
          {value}%
        </Tag>
      ),
    },
  ]

  const handleSearch = () => {
    // search is done via useMemo filter on client side
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
  }

  return (
    <div className={styles['attendance-stats']}>
      <Row gutter={16} className={styles['attendance-stats__summary-row']}>
        {summaryStats.map((item, index) => (
          <Col span={6} key={index}>
            <Card bordered={false} className={styles['attendance-stats__stat-card']}>
              <Statistic title={item.title} value={item.value} className={styles['attendance-stats__stat-value']} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className={styles['attendance-stats__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['attendance-stats__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="部门">
                <Select
                  className={styles['attendance-stats__dept-select']}
                  placeholder="请选择"
                  value={searchDept}
                  onChange={setSearchDept}
                  allowClear
                >
                  {departments.map((dept) => (
                    <Option key={dept} value={dept}>{dept}</Option>
                  ))}
                </Select>
              </FormItem>
              <FormItem label="统计月份">
                <Select
                  className={styles['attendance-stats__month-select']}
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                >
                  <Option value={getDefaultMonth()}>{getDefaultMonth()}</Option>
                  <Option value="2024-06">2024年6月</Option>
                  <Option value="2024-05">2024年5月</Option>
                  <Option value="2024-04">2024年4月</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false}>
        <div className={styles['attendance-stats__table-header']}>
          <Tabs defaultActiveTab="personal">
            <TabPane key="personal" title="个人统计" />
            <TabPane key="department" title="部门统计" />
          </Tabs>
          <Button icon={<IconExport />}>导出报表</Button>
        </div>

        <Table
          loading={loading}
          columns={columns}
          data={filteredData}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )
}

export default Stats
