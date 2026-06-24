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
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

interface ChangeRecord {
  id: number
  employeeName: string
  employeeNo: string
  type: 'transfer' | 'promotion' | 'demotion' | 'entry' | 'leave' | 'adjust'
  beforeContent: string
  afterContent: string
  changeDate: string
  operator: string
  remark: string
}

const typeMap: Record<string, { text: string; color: string }> = {
  entry: { text: '入职', color: 'green' },
  transfer: { text: '调岗', color: 'blue' },
  promotion: { text: '晋升', color: 'orange' },
  demotion: { text: '降职', color: 'red' },
  adjust: { text: '调薪', color: 'purple' },
  leave: { text: '离职', color: 'gray' },
}

const mockData: ChangeRecord[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', type: 'entry', beforeContent: '-', afterContent: '技术部-高级工程师', changeDate: '2023-01-15', operator: '人事经理', remark: '新员工入职' },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', type: 'transfer', beforeContent: '技术部-工程师', afterContent: '产品部-产品经理', changeDate: '2023-06-20', operator: '人事经理', remark: '内部转岗' },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', type: 'promotion', beforeContent: '市场部-市场专员', afterContent: '市场部-市场主管', changeDate: '2023-09-10', operator: '总经理', remark: '晋升为市场主管' },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', type: 'adjust', beforeContent: '薪资 15000', afterContent: '薪资 18000', changeDate: '2024-01-01', operator: '人事经理', remark: '年度调薪' },
  { id: 5, employeeName: '周九', employeeNo: 'EMP007', type: 'leave', beforeContent: '技术部-测试工程师', afterContent: '-', changeDate: '2024-03-15', operator: '人事经理', remark: '个人原因离职' },
  { id: 6, employeeName: '钱七', employeeNo: 'EMP005', type: 'promotion', beforeContent: '人事部-人事专员', afterContent: '人事部-人事主管', changeDate: '2024-04-01', operator: '总经理', remark: '业绩突出晋升' },
]

function Changes() {
  const [data] = useState<ChangeRecord[]>(mockData)
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<ChangeRecord[]>(mockData)

  const columns: TableProps<ChangeRecord>['columns'] = [
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
      title: '变动类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => {
        const info = typeMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '变动前',
      dataIndex: 'beforeContent',
      width: 180,
      ellipsis: true,
    },
    {
      title: '变动后',
      dataIndex: 'afterContent',
      width: 180,
      ellipsis: true,
    },
    {
      title: '变动日期',
      dataIndex: 'changeDate',
      width: 120,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
    },
    {
      title: '操作',
      width: 80,
      render: () => (
        <Button type="text" size="small" icon={<IconEye />}>
          查看
        </Button>
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
    if (searchType) {
      result = result.filter((item) => item.type === searchType)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    setFilteredData(data)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              style={{ width: 200 }}
              placeholder="姓名/工号"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="变动类型">
            <Select
              style={{ width: 150 }}
              placeholder="请选择类型"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              <Option value="entry">入职</Option>
              <Option value="transfer">调岗</Option>
              <Option value="promotion">晋升</Option>
              <Option value="demotion">降职</Option>
              <Option value="adjust">调薪</Option>
              <Option value="leave">离职</Option>
            </Select>
          </FormItem>
          <FormItem label="变动时间">
            <RangePicker style={{ width: 260 }} />
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>变动记录</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            共 {filteredData.length} 条
          </Tag>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}

export default Changes
