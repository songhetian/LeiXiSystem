import { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Space,
  Grid,
  Statistic,
  Select,
  Form,
  Button,
  Tabs,
  Calendar,
  Badge,
} from '@arco-design/web-react'
import {
  IconCalendar,
  IconClockCircle,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface MyAttendanceRecord {
  id: number
  date: string
  dayOfWeek: string
  shift: string
  checkIn: string
  checkOut: string
  workHours: number
  status: 'normal' | 'late' | 'early' | 'absent' | 'leave' | 'weekend'
}

const mockRecords: MyAttendanceRecord[] = [
  { id: 1, date: '2024-06-24', dayOfWeek: '周一', shift: '标准早班', checkIn: '08:55', checkOut: '18:10', workHours: 8.25, status: 'normal' },
  { id: 2, date: '2024-06-21', dayOfWeek: '周五', shift: '标准早班', checkIn: '09:12', checkOut: '18:05', workHours: 7.8, status: 'late' },
  { id: 3, date: '2024-06-20', dayOfWeek: '周四', shift: '标准早班', checkIn: '08:50', checkOut: '17:30', workHours: 7.5, status: 'early' },
  { id: 4, date: '2024-06-19', dayOfWeek: '周三', shift: '标准早班', checkIn: '09:00', checkOut: '18:00', workHours: 8, status: 'normal' },
  { id: 5, date: '2024-06-18', dayOfWeek: '周二', shift: '标准早班', checkIn: '08:58', checkOut: '18:02', workHours: 8.07, status: 'normal' },
  { id: 6, date: '2024-06-17', dayOfWeek: '周一', shift: '标准早班', checkIn: '09:05', checkOut: '18:00', workHours: 7.92, status: 'late' },
  { id: 7, date: '2024-06-16', dayOfWeek: '周日', shift: '休息', checkIn: '-', checkOut: '-', workHours: 0, status: 'weekend' },
  { id: 8, date: '2024-06-15', dayOfWeek: '周六', shift: '休息', checkIn: '-', checkOut: '-', workHours: 0, status: 'weekend' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
  leave: { text: '请假', color: 'blue' },
  weekend: { text: '休息', color: 'gray' },
}

function MyAttendance() {
  const [month, setMonth] = useState('2024-06')
  const [activeTab, setActiveTab] = useState('calendar')

  const columns: TableProps<MyAttendanceRecord>['columns'] = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
    },
    {
      title: '星期',
      dataIndex: 'dayOfWeek',
      width: 80,
    },
    {
      title: '班次',
      dataIndex: 'shift',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '上班打卡',
      dataIndex: 'checkIn',
      width: 110,
    },
    {
      title: '下班打卡',
      dataIndex: 'checkOut',
      width: 110,
    },
    {
      title: '工时',
      dataIndex: 'workHours',
      width: 100,
      render: (value: number) => `${value} 小时`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
  ]

  const stats = [
    { title: '出勤天数', value: 19, unit: '天', color: '#00B42A', icon: IconCalendar },
    { title: '迟到', value: 2, unit: '次', color: '#FF7D00', icon: IconClockCircle },
    { title: '早退', value: 1, unit: '次', color: '#FF7D00', icon: IconClockCircle },
    { title: '请假', value: 1, unit: '天', color: '#165DFF', icon: IconCalendar },
  ]

  const dateCellRender = (date: any) => {
    const day = date.getDay()
    if (day === 0 || day === 6) {
      return <Badge status="default" text="休" />
    }
    return <Badge status="success" text="✓" />
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
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

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="月份">
            <Select style={{ width: 150 }} value={month} onChange={setMonth}>
              <Option value="2024-06">2024年6月</Option>
              <Option value="2024-05">2024年5月</Option>
              <Option value="2024-04">2024年4月</Option>
            </Select>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="calendar" title="日历视图" />
          <TabPane key="list" title="明细列表" />
        </Tabs>

        {activeTab === 'calendar' ? (
          <Calendar
            dateRender={dateCellRender}
            panel={false}
            defaultValue={new Date(2024, 5, 1)}
          />
        ) : (
          <Table
            columns={columns}
            data={mockRecords}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  )
}

export default MyAttendance
