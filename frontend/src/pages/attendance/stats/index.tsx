import { useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Form,
  Tag,
  Card,
  Statistic,
  Grid,
  Tabs,
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
const TabPane = Tabs.TabPane

interface AttendanceStats {
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

const mockData: AttendanceStats[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', workDays: 22, actualDays: 22, lateTimes: 0, earlyTimes: 0, absentDays: 0, leaveDays: 0, overtimeHours: 12.5, attendanceRate: 100 },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', workDays: 22, actualDays: 21, lateTimes: 2, earlyTimes: 1, absentDays: 0, leaveDays: 1, overtimeHours: 8, attendanceRate: 95.5 },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', workDays: 22, actualDays: 20, lateTimes: 3, earlyTimes: 0, absentDays: 1, leaveDays: 2, overtimeHours: 4, attendanceRate: 90.9 },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', workDays: 22, actualDays: 21, lateTimes: 1, earlyTimes: 0, absentDays: 0, leaveDays: 1, overtimeHours: 15, attendanceRate: 95.5 },
  { id: 5, employeeName: '钱七', employeeNo: 'EMP005', department: '人事部', workDays: 22, actualDays: 22, lateTimes: 0, earlyTimes: 0, absentDays: 0, leaveDays: 0, overtimeHours: 2, attendanceRate: 100 },
  { id: 6, employeeName: '孙八', employeeNo: 'EMP006', department: '财务部', workDays: 22, actualDays: 21, lateTimes: 0, earlyTimes: 0, absentDays: 0, leaveDays: 1, overtimeHours: 0, attendanceRate: 95.5 },
  { id: 7, employeeName: '吴十', employeeNo: 'EMP008', department: '运营部', workDays: 22, actualDays: 22, lateTimes: 1, earlyTimes: 0, absentDays: 0, leaveDays: 0, overtimeHours: 6, attendanceRate: 100 },
]

function Stats() {
  const [data] = useState<AttendanceStats[]>(mockData)
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<AttendanceStats[]>(mockData)

  const columns: TableProps<AttendanceStats>['columns'] = [
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
    },
    {
      title: '实出勤(天)',
      dataIndex: 'actualDays',
      width: 100,
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
    },
    {
      title: '加班(h)',
      dataIndex: 'overtimeHours',
      width: 90,
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
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setFilteredData(data)
  }

  const summaryStats = [
    { title: '平均出勤率', value: '96.8%', color: '#00B42A' },
    { title: '总迟到次数', value: 7, color: '#FF7D00' },
    { title: '总加班时长', value: '47.5h', color: '#165DFF' },
    { title: '总请假天数', value: 5, color: '#86909C' },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {summaryStats.map((item, index) => (
          <Col span={6} key={index}>
            <Card bordered={false}>
              <Statistic title={item.title} value={item.value} style={{ color: item.color }} />
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
          <FormItem label="统计月份">
            <Select style={{ width: 130 }} defaultValue="2024-06">
              <Option value="2024-06">2024年6月</Option>
              <Option value="2024-05">2024年5月</Option>
              <Option value="2024-04">2024年4月</Option>
            </Select>
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
          <Tabs defaultActiveTab="personal">
            <TabPane key="personal" title="个人统计" />
            <TabPane key="department" title="部门统计" />
          </Tabs>
          <Button icon={<IconExport />}>导出报表</Button>
        </div>

        <Table
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
