import { useState } from 'react'
import {
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Popconfirm,
  Card,
  Grid,
  Switch,
  Select,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const Option = Select.Option
const FormItem = Form.Item

interface LeaveType {
  id: number
  name: string
  code: string
  totalDays: number
  unit: 'day' | 'hour'
  isCarryOver: boolean
  carryOverDays: number
  isPaid: boolean
  sort: number
  status: 'active' | 'inactive'
  description: string
}

const mockData: LeaveType[] = [
  { id: 1, name: '年假', code: 'ANNUAL', totalDays: 10, unit: 'day', isCarryOver: true, carryOverDays: 3, isPaid: true, sort: 1, status: 'active', description: '员工每年享有的带薪年休假' },
  { id: 2, name: '事假', code: 'PERSONAL', totalDays: 5, unit: 'day', isCarryOver: false, carryOverDays: 0, isPaid: false, sort: 2, status: 'active', description: '因个人事务需请假的假期' },
  { id: 3, name: '病假', code: 'SICK', totalDays: 5, unit: 'day', isCarryOver: false, carryOverDays: 0, isPaid: true, sort: 3, status: 'active', description: '因病需休息的假期，需提供医院证明' },
  { id: 4, name: '婚假', code: 'MARRIAGE', totalDays: 3, unit: 'day', isCarryOver: false, carryOverDays: 0, isPaid: true, sort: 4, status: 'active', description: '员工结婚享有的假期' },
  { id: 5, name: '产假', code: 'MATERNITY', totalDays: 98, unit: 'day', isCarryOver: false, carryOverDays: 0, isPaid: true, sort: 5, status: 'active', description: '女员工生育享有的假期' },
  { id: 6, name: '丧假', code: 'BEREAVEMENT', totalDays: 3, unit: 'day', isCarryOver: false, carryOverDays: 0, isPaid: true, sort: 6, status: 'active', description: '直系亲属去世享有的假期' },
  { id: 7, name: '调休', code: 'COMPENSATORY', totalDays: 0, unit: 'day', isCarryOver: true, carryOverDays: 0, isPaid: true, sort: 7, status: 'active', description: '加班后可调休的假期' },
]

function Types() {
  const [data, setData] = useState<LeaveType[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState<LeaveType[]>(mockData)

  const columns: TableProps<LeaveType>['columns'] = [
    {
      title: '假期名称',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '假期编码',
      dataIndex: 'code',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '年度配额',
      width: 120,
      render: (_: any, record: LeaveType) => (
        <span>{record.totalDays} {record.unit === 'day' ? '天' : '小时'}</span>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      render: (value: string) => (
        <Tag>{value === 'day' ? '按天' : '按小时'}</Tag>
      ),
    },
    {
      title: '带薪',
      dataIndex: 'isPaid',
      width: 80,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'orange'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '可结转',
      dataIndex: 'isCarryOver',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'blue' : 'gray'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '结转天数',
      dataIndex: 'carryOverDays',
      width: 90,
      render: (value: number) => `${value}天`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: LeaveType) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            content="确定要删除该假期类型吗？"
            onOk={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setVisible(true)
  }

  const handleEdit = (record: LeaveType) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = (id: number) => {
    setData(data.filter((item) => item.id !== id))
    setFilteredData(filteredData.filter((item) => item.id !== id))
    Message.success('删除成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        setData(data.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        setFilteredData(filteredData.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        Message.success('修改成功')
      } else {
        const newId = Math.max(...data.map((d) => d.id)) + 1
        const newRecord = {
          id: newId,
          ...values,
        } as LeaveType
        setData([...data, newRecord])
        setFilteredData([...filteredData, newRecord])
        Message.success('新增成功')
      }
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = () => {
    let result = data
    if (searchText) {
      result = result.filter(
        (item) =>
          item.name.includes(searchText) ||
          item.code.includes(searchText),
      )
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setFilteredData(data)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="假期名称">
            <Input
              style={{ width: 200 }}
              placeholder="请输入名称/编码"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>假期类型</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 种
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增类型
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑假期类型' : '新增假期类型'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="假期名称"
                field="name"
                rules={[{ required: true, message: '请输入假期名称' }]}
              >
                <Input placeholder="请输入假期名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="假期编码"
                field="code"
                rules={[{ required: true, message: '请输入假期编码' }]}
              >
                <Input placeholder="请输入假期编码" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="年度配额" field="totalDays" initialValue={0}>
                <Input type="number" placeholder="请输入配额" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="计算单位" field="unit" initialValue="day">
                <Select placeholder="请选择">
                  <Option value="day">天</Option>
                  <Option value="hour">小时</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="是否带薪" field="isPaid" initialValue={true}>
                <Switch />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="可结转下年" field="isCarryOver" initialValue={false}>
                <Switch />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Types
