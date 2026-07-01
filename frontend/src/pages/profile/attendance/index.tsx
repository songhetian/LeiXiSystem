import { useState, useEffect } from 'react'
import styles from './index.module.css'
import {
  Card,
  Table,
  Tag,
  Grid,
  Statistic,
  Select,
  Form,
  Tabs,
  Calendar,
  Badge,
  Spin,
} from '@arco-design/web-react'
import {
  IconCalendar,
  IconClockCircle,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import type { Dayjs } from 'dayjs'
import { getAttendanceRecords } from '@/api/attendance'
import type { AttendanceRecord } from '@/api/attendance'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
  leave: { text: '请假', color: 'blue' },
  weekend: { text: '休息', color: 'gray' },
}

function MyAttendance() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchRecords = async (month: string) => {
    setLoading(true)
    try {
      const [year, monthNum] = month.split('-')
      const startDate = `${year}-${monthNum}-01`
      const endDate = `${year}-${monthNum}-${new Date(parseInt(year), parseInt(monthNum), 0).getDate()}`
      const res = await getAttendanceRecords({
        page: 1,
        pageSize: 50,
        startDate,
        endDate,
      })
      setRecords(res.data.list || [])
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords(currentMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  const normalCount = records.filter((r) => r.status === 'normal').length
  const lateCount = records.filter((r) => r.status === 'late').length
  const earlyCount = records.filter((r) => r.status === 'early').length
  const absentCount = records.filter((r) => r.status === 'absent').length

  const columns: TableProps<AttendanceRecord>['columns'] = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
    },
    {
      title: '班次',
      dataIndex: 'shiftName',
      width: 120,
      render: (value?: string) => (value ? <Tag color="blue">{value}</Tag> : '-'),
    },
    {
      title: '上班打卡',
      dataIndex: 'checkIn',
      width: 110,
      render: (value?: string) => value || '-',
    },
    {
      title: '下班打卡',
      dataIndex: 'checkOut',
      width: 110,
      render: (value?: string) => value || '-',
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

  const stats = [
    { title: '出勤天数', value: normalCount, unit: '天', color: '#00B42A', icon: IconCalendar },
    { title: '迟到', value: lateCount, unit: '次', color: '#FF7D00', icon: IconClockCircle },
    { title: '早退', value: earlyCount, unit: '次', color: '#FF7D00', icon: IconClockCircle },
    { title: '旷工', value: absentCount, unit: '天', color: '#F53F3F', icon: IconCalendar },
  ]

  const recordMap = new Map(
    records.map((r) => [new Date(r.date).toDateString(), r]),
  )

  const dateCellRender = (date: Dayjs) => {
    const record = recordMap.get(date.toDate().toDateString())
    const day = date.day()
    const isWeekend = day === 0 || day === 6

    if (record) {
      const info = statusMap[record.status]
      return <Badge status={info?.color === 'green' ? 'success' : info?.color === 'orange' ? 'warning' : info?.color === 'red' ? 'error' : 'default'} text={info?.text || record.status} />
    }

    if (isWeekend) {
      return <Badge status="default" text="休" />
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date.toDate() > today) {
      return <Badge status="default" text="-" />
    }

    return <Badge status="default" text="-" />
  }

  const monthOptions = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthOptions.push({ value: val, label: `${d.getFullYear()}年${d.getMonth() + 1}月` })
  }

  return (
    <div className={styles['profile-attendance']}>
      <Row gutter={16} className={styles['profile-attendance__toolbar']}>
        {stats.map((item, index) => (
          <Col span={6} key={index}>
            <Card bordered={false}>
              <Statistic
                title={item.title}
                value={item.value}
                suffix={item.unit}
                style={{ color: item.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className={styles['profile-attendance__toolbar']}>
        <Form layout="inline">
          <FormItem label="月份">
            <Select className={styles['profile-attendance__select-month']} value={currentMonth} onChange={setCurrentMonth}>
              {monthOptions.map((m) => (
                <Option key={m.value} value={m.value}>
                  {m.label}
                </Option>
              ))}
            </Select>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="calendar" title="日历视图" />
          <TabPane key="list" title="明细列表" />
        </Tabs>

        <Spin loading={loading}>
          {activeTab === 'calendar' ? (
            <Calendar
              dateRender={dateCellRender}
              panel={false}
              defaultValue={new Date(parseInt(currentMonth.split('-')[0]), parseInt(currentMonth.split('-')[1]) - 1, 1)}
            />
          ) : (
            <Table
              columns={columns}
              data={records}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              noDataElement={<div className={styles['profile-attendance__empty']}>暂无考勤记录</div>}
            />
          )}
        </Spin>
      </Card>
    </div>
  )
}

export default MyAttendance
