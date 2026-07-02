import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Form,
  Tag,
  Card,
  Statistic,
  Grid,
  Spin,
} from '@arco-design/web-react'
import {
  IconExport,
  IconDownload,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import type { Dayjs } from 'dayjs'
import { getAttendanceRecords, getAttendanceStats } from '@/api/attendance'
import type { AttendanceRecord } from '@/api/attendance'
import { FilterBar, TableHeader, DepartmentSelect } from '@/components'
import styles from './records.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
  leave: { text: '请假', color: 'blue' },
  business: { text: '出差', color: 'purple' },
}

function Records() {
  const [data, setData] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<number | undefined>()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [searchAttendanceType, setSearchAttendanceType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    late: 0,
    early: 0,
    absent: 0,
    leave: 0,
    attendanceRate: '0',
  })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getAttendanceRecords({
        page,
        pageSize,
        keyword: searchText || undefined,
        departmentId: searchDept,
        status: searchStatus,
        startDate: dateRange[0]?.format('YYYY-MM-DD'),
        endDate: dateRange[1]?.format('YYYY-MM-DD'),
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const res = await getAttendanceStats({
        departmentId: searchDept,
      })
      setStats(res.data)
    } catch {
      // error handled by interceptor
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize)
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
    fetchStats()
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setSearchStatus(undefined)
    setSearchAttendanceType(undefined)
    setDateRange([])
    fetchData(1, pagination.pageSize)
    fetchStats()
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  const columns: TableProps<AttendanceRecord>['columns'] = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'employeeName',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 100,
    },
    {
      title: '上班打卡',
      dataIndex: 'checkIn',
      width: 110,
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: '下班打卡',
      dataIndex: 'checkOut',
      width: 110,
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: '工时(h)',
      dataIndex: 'workHours',
      width: 90,
      render: (value: number | null | undefined) => (
        <span className={styles['attendance-records__work-hours']}>{value ?? 0}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
  ]

  const statsData = [
    { title: '今日出勤', value: stats.normal, color: '#10B981' },
    { title: '迟到', value: stats.late, color: '#FF7D00' },
    { title: '早退', value: stats.early, color: '#FF7D00' },
    { title: '请假', value: stats.leave, color: '#14C9C9' },
  ]

  return (
    <div className={styles['attendance-records']}>
      <Row gutter={16} className={styles['attendance-records__stats-row']}>
        {statsData.map((item, index) => (
          <Col span={6} key={index}>
            <Card bordered={false}>
              <Spin loading={statsLoading}>
                <Statistic title={item.title} value={item.value} className={styles['attendance-records__statistic-value']} style={{ "--statistic-value-color": item.color } as React.CSSProperties} />
              </Spin>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className={styles['attendance-records__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['attendance-records__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="部门">
                <DepartmentSelect
                  value={searchDept}
                  onChange={(val) => setSearchDept(val as number | undefined)}
                  placeholder="请选择部门"
                />
              </FormItem>
              <FormItem label="考勤状态">
                <Select
                  className={styles['attendance-records__status-select']}
                  placeholder="请选择"
                  value={searchStatus}
                  onChange={setSearchStatus}
                  allowClear
                >
                  <Option value="normal">正常</Option>
                  <Option value="late">迟到</Option>
                  <Option value="early">早退</Option>
                  <Option value="absent">旷工</Option>
                  <Option value="leave">请假</Option>
                </Select>
              </FormItem>
              <FormItem label="考勤类型">
                <Select
                  placeholder="请选择考勤类型"
                  value={searchAttendanceType}
                  onChange={setSearchAttendanceType}
                  allowClear
                >
                  <Option value="daily">日常</Option>
                  <Option value="overtime">加班</Option>
                  <Option value="business">出差</Option>
                  <Option value="leave">请假</Option>
                </Select>
              </FormItem>
              <FormItem label="日期">
                <RangePicker
                  className={styles['attendance-records__date-picker']}
                  value={dateRange}
                  onChange={(_, date) => setDateRange(date)}
                />
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false} className={styles['attendance-records__table-card']}>
        <TableHeader
          title="打卡记录"
          total={pagination.total}
          totalText="条"
          extra={<Button type="secondary" icon={<IconDownload />}>导出</Button>}
        />

        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>
    </div>
  )
}

export default Records
