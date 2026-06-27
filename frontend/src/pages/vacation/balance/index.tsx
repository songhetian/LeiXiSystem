import { useState } from 'react'
import {
  Card,
  Input,
  Select,
  Form,
  Space,
  Tag,
  Button,
  Table,
  Grid,
  Progress,
  Avatar,
  Descriptions,
  Message,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconUser,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface LeaveBalance {
  type: string
  total: number
  used: number
  balance: number
  unit: string
  color: string
}

interface EmployeeLeave {
  id: number
  name: string
  employeeNo: string
  department: string
  avatar?: string
  balances: LeaveBalance[]
}

const mockData: EmployeeLeave[] = [
  {
    id: 1,
    name: '张三',
    employeeNo: 'EMP001',
    department: '技术部',
    balances: [
      { type: '年假', total: 10, used: 3, balance: 7, unit: '天', color: '#165DFF' },
      { type: '事假', total: 5, used: 1, balance: 4, unit: '天', color: '#FF7D00' },
      { type: '病假', total: 5, used: 0, balance: 5, unit: '天', color: '#00B42A' },
      { type: '调休', total: 2, used: 1, balance: 1, unit: '天', color: '#722ED1' },
    ],
  },
]

function Balance() {
  const [employeeNo, setEmployeeNo] = useState('EMP001')
  const [employeeName, setEmployeeName] = useState('张三')
  const [currentData] = useState<EmployeeLeave>(mockData[0])

  const handleSearch = () => {
    Message.success('查询成功')
  }

  const handleReset = () => {
    setEmployeeNo('')
    setEmployeeName('')
  }

  const columns: TableProps<LeaveBalance>['columns'] = [
    {
      title: '假期类型',
      dataIndex: 'type',
      width: 120,
      render: (value: string, record) => (
        <Tag color={record.color}>{value}</Tag>
      ),
    },
    {
      title: '总额度',
      dataIndex: 'total',
      width: 100,
      render: (value: number, record) => `${value} ${record.unit}`,
    },
    {
      title: '已使用',
      dataIndex: 'used',
      width: 100,
      render: (value: number, record) => `${value} ${record.unit}`,
    },
    {
      title: '剩余',
      dataIndex: 'balance',
      width: 100,
      render: (value: number, record) => (
        <span style={{ fontWeight: 600, color: record.color }}>
          {value} {record.unit}
        </span>
      ),
    },
    {
      title: '使用进度',
      dataIndex: 'progress',
      render: (_: any, record) => (
        <Progress
          percent={Math.round((record.used / record.total) * 100)}
          color={record.color}
          style={{ width: '100%', maxWidth: 200 }}
        />
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="工号">
            <Input
              style={{ width: 150 }}
              placeholder="请输入工号"
              value={employeeNo}
              onChange={setEmployeeNo}
              allowClear
            />
          </FormItem>
          <FormItem label="姓名">
            <Input
              style={{ width: 150 }}
              placeholder="请输入姓名"
              value={employeeName}
              onChange={setEmployeeName}
              allowClear
            />
          </FormItem>
          <FormItem label="年度">
            <Select style={{ width: 120 }} defaultValue="2024">
              <Option value="2024">2024年</Option>
              <Option value="2023">2023年</Option>
            </Select>
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                查询
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Row gutter={16}>
        <Col span={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Avatar size={80} style={{ marginBottom: 16 }}>
              <IconUser style={{ fontSize: 40 }} />
            </Avatar>
            <h3 style={{ marginBottom: 4 }}>{currentData.name}</h3>
            <Tag color="blue">{currentData.employeeNo}</Tag>
            <div style={{ marginTop: 8, color: '#86909C' }}>
              {currentData.department}
            </div>
          </Card>
        </Col>

        <Col span={18}>
          <Card bordered={false}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>假期余额</span>
            </div>
            <Table
              columns={columns}
              data={currentData.balances}
              rowKey="type"
              pagination={false}
            />
          </Card>

          <Card bordered={false} style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>额度概览</div>
            <Row gutter={16}>
              {currentData.balances.map((item, index) => (
                <Col span={6} key={index}>
                  <Card bordered style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 600, color: item.color, marginBottom: 4 }}>
                      {item.balance}
                    </div>
                    <div style={{ color: '#86909C', fontSize: 12 }}>{item.type}剩余({item.unit})</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Balance
