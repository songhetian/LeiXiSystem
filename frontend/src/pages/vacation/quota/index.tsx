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
  Progress,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface QuotaRecord {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  annualLeave: { total: number; used: number }
  personalLeave: { total: number; used: number }
  sickLeave: { total: number; used: number }
  compensatoryLeave: { total: number; used: number }
}

const mockData: QuotaRecord[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', annualLeave: { total: 10, used: 3 }, personalLeave: { total: 5, used: 1 }, sickLeave: { total: 5, used: 0 }, compensatoryLeave: { total: 2, used: 1 } },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', annualLeave: { total: 10, used: 2 }, personalLeave: { total: 5, used: 2 }, sickLeave: { total: 5, used: 1 }, compensatoryLeave: { total: 3, used: 0 } },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', annualLeave: { total: 8, used: 5 }, personalLeave: { total: 5, used: 3 }, sickLeave: { total: 5, used: 2 }, compensatoryLeave: { total: 1, used: 1 } },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', annualLeave: { total: 10, used: 1 }, personalLeave: { total: 5, used: 0 }, sickLeave: { total: 5, used: 0 }, compensatoryLeave: { total: 4, used: 2 } },
  { id: 5, employeeName: '钱七', employeeNo: 'EMP005', department: '人事部', annualLeave: { total: 10, used: 0 }, personalLeave: { total: 5, used: 0 }, sickLeave: { total: 5, used: 0 }, compensatoryLeave: { total: 2, used: 0 } },
]

function Quota() {
  const [data] = useState<QuotaRecord[]>(mockData)
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<QuotaRecord[]>(mockData)

  const columns: TableProps<QuotaRecord>['columns'] = [
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
      title: '年假(天)',
      width: 160,
      render: (_: any, record: QuotaRecord) => (
        <div>
          <Progress
            percent={Math.round((record.annualLeave.used / record.annualLeave.total) * 100)}
            status="normal"
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: '#86909C' }}>
            {record.annualLeave.used}/{record.annualLeave.total}
          </span>
        </div>
      ),
    },
    {
      title: '事假(天)',
      width: 160,
      render: (_: any, record: QuotaRecord) => (
        <div>
          <Progress
            percent={Math.round((record.personalLeave.used / record.personalLeave.total) * 100)}
            status="normal"
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: '#86909C' }}>
            {record.personalLeave.used}/{record.personalLeave.total}
          </span>
        </div>
      ),
    },
    {
      title: '病假(天)',
      width: 160,
      render: (_: any, record: QuotaRecord) => (
        <div>
          <Progress
            percent={Math.round((record.sickLeave.used / record.sickLeave.total) * 100)}
            status="normal"
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: '#86909C' }}>
            {record.sickLeave.used}/{record.sickLeave.total}
          </span>
        </div>
      ),
    },
    {
      title: '调休(天)',
      width: 160,
      render: (_: any, record: QuotaRecord) => (
        <div>
          <Progress
            percent={Math.round((record.compensatoryLeave.used / record.compensatoryLeave.total) * 100)}
            status="normal"
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: '#86909C' }}>
            {record.compensatoryLeave.used}/{record.compensatoryLeave.total}
          </span>
        </div>
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

  const summary = [
    { title: '年假总额度', value: '48 天', color: '#165DFF' },
    { title: '已使用', value: '11 天', color: '#FF7D00' },
    { title: '剩余', value: '37 天', color: '#00B42A' },
    { title: '使用率', value: '22.9%', color: '#86909C' },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {summary.map((item, index) => (
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
          <FormItem label="年度">
            <Select style={{ width: 110 }} defaultValue="2024">
              <Option value="2024">2024年</Option>
              <Option value="2023">2023年</Option>
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
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>假期额度</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            共 {filteredData.length} 人
          </Tag>
        </div>

        <Table
          columns={columns}
          data={filteredData}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  )
}

export default Quota
