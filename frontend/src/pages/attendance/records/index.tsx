import { useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  DatePicker,
  Form,
  Tag,
  Card,
  Statistic,
  Grid,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconExport,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface AttendanceRecord {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  date: string
  checkIn: string
  checkOut: string
  workHours: number
  status: 'normal' | 'late' | 'early' | 'absent' | 'leave' | 'business'
}

const statusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
  leave: { text: '请假', color: 'blue' },
  business: { text: '出差', color: 'purple' },
}

const mockData: AttendanceRecord[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', date: '2024-06-20', checkIn: '08:55', checkOut: '18:05', workHours: 9.2, status: 'normal' },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', date: '2024-06-20', checkIn: '09:15', checkOut: '18:30', workHours: 9.3, status: 'late' },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', date: '2024-06-20', checkIn: '08:58', checkOut: '17:30', workHours: 8.5, status: 'early' },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', date: '2024-06-20', checkIn: '-', checkOut: '-', workHours: 0, status: 'leave' },
  { id: 5, employeeName: '钱七', employeeNo: 'EMP005', department: '人事部', date: '2024-06-20', checkIn: '08:50', checkOut: '18:10', workHours: 9.3, status: 'normal' },
  { id: 6, employeeName: '孙八', employeeNo: 'EMP006', department: '财务部', date: '2024-06-20', checkIn: '-', checkOut: '-', workHours: 0, status: 'business' },
  { id: 7, employeeName: '吴十', employeeNo: 'EMP008', department: '运营部', date: '2024-06-20', checkIn: '09:00', checkOut: '18:00', workHours: 9, status: 'normal' },
  { id: 8, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', date: '2024-06-19', checkIn: '08:52', checkOut: '18:10', workHours: 9.3, status: 'normal' },
  { id: 9, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', date: '2024-06-19', checkIn: '08:58', checkOut: '18:05', workHours: 9.1, status: 'normal' },
  { id: 10, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', date: '2024-06-19', checkIn: '-', checkOut: '-', workHours: 0, status: 'absent' },
]

function Records() {
  const [data] = useState<AttendanceRecord[]>(mockData)
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>(mockData)

  const columns: TableProps<AttendanceRecord>['columns'] = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
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
      dataIndex: 'department',
      width: 100,
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
      title: '工时(h)',
      dataIndex: 'workHours',
      width: 90,
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

  const handleSearch = () => {
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
    if (searchStatus) {
      result = result.filter((item) => item.status === searchStatus)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setSearchStatus(undefined)
    setFilteredData(data)
  }

  const stats = [
    { title: '今日出勤', value: 115, color: '#165DFF' },
    { title: '迟到', value: 3, color: '#FF7D00' },
    { title: '早退', value: 2, color: '#FF7D00' },
    { title: '请假', value: 5, color: '#14C9C9' },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats.map((item, index) => (
          <Col span={6} key={index}>
            <Card bordered={false}>
              <Statistic title={item.title} value={data.filter(d => d.status === (index === 0 ? 'normal' : index === 1 ? 'late' : index === 2 ? 'early' : 'leave')).length} style={{ color: item.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              style={{ width: 180 }}
              placeholder="姓名/工号"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="部门">
            <Select
              style={{ width: 130 }}
              placeholder="请选择"
              value={searchDept}
              onChange={setSearchDept}
              allowClear
            >
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
            </Select>
          </FormItem>
          <FormItem label="状态">
            <Select
              style={{ width: 110 }}
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
              <Option value="business">出差</Option>
            </Select>
          </FormItem>
          <FormItem label="日期">
            <DatePicker.RangePicker style={{ width: 220 }} />
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>打卡记录</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 条
            </Tag>
          </div>
          <Button icon={<IconExport />}>导出</Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}

export default Records
