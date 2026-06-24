import { useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Popconfirm,
  Card,
  Grid,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconUser,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface Employee {
  id: number
  name: string
  employeeNo: string
  department: string
  position: string
  phone: string
  email: string
  entryDate: string
  status: 'active' | 'leave' | 'probation'
}

const mockData: Employee[] = [
  { id: 1, name: '张三', employeeNo: 'EMP001', department: '技术部', position: '高级工程师', phone: '13800138001', email: 'zhangsan@example.com', entryDate: '2023-01-15', status: 'active' },
  { id: 2, name: '李四', employeeNo: 'EMP002', department: '产品部', position: '产品经理', phone: '13800138002', email: 'lisi@example.com', entryDate: '2023-03-20', status: 'active' },
  { id: 3, name: '王五', employeeNo: 'EMP003', department: '市场部', position: '市场专员', phone: '13800138003', email: 'wangwu@example.com', entryDate: '2023-05-10', status: 'probation' },
  { id: 4, name: '赵六', employeeNo: 'EMP004', department: '技术部', position: '前端工程师', phone: '13800138004', email: 'zhaoliu@example.com', entryDate: '2022-08-01', status: 'active' },
  { id: 5, name: '钱七', employeeNo: 'EMP005', department: '人事部', position: '人事专员', phone: '13800138005', email: 'qianqi@example.com', entryDate: '2023-07-15', status: 'active' },
  { id: 6, name: '孙八', employeeNo: 'EMP006', department: '财务部', position: '财务主管', phone: '13800138006', email: 'sunba@example.com', entryDate: '2021-11-20', status: 'active' },
  { id: 7, name: '周九', employeeNo: 'EMP007', department: '技术部', position: '测试工程师', phone: '13800138007', email: 'zhoujiu@example.com', entryDate: '2023-09-01', status: 'leave' },
  { id: 8, name: '吴十', employeeNo: 'EMP008', department: '运营部', position: '运营主管', phone: '13800138008', email: 'wushi@example.com', entryDate: '2022-04-10', status: 'active' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '在职', color: 'green' },
  leave: { text: '离职', color: 'red' },
  probation: { text: '试用期', color: 'orange' },
}

function Employee() {
  const [data, setData] = useState<Employee[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()

  const columns: TableProps<Employee>['columns'] = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
    },
    {
      title: '岗位',
      dataIndex: 'position',
      width: 120,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
    {
      title: '入职日期',
      dataIndex: 'entryDate',
      width: 120,
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
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Employee) => (
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
            content="确定要删除该员工吗？"
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

  const handleEdit = (record: Employee) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = (id: number) => {
    setData(data.filter((item) => item.id !== id))
    Message.success('删除成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        setData(data.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        Message.success('修改成功')
      } else {
        const newId = Math.max(...data.map((d) => d.id)) + 1
        setData([...data, { id: newId, ...values } as Employee])
        Message.success('新增成功')
      }
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = () => {
    let result = mockData
    if (searchText) {
      result = result.filter(
        (item) =>
          item.name.includes(searchText) ||
          item.employeeNo.includes(searchText) ||
          item.phone.includes(searchText),
      )
    }
    if (searchDept) {
      result = result.filter((item) => item.department === searchDept)
    }
    if (searchStatus) {
      result = result.filter((item) => item.status === searchStatus)
    }
    setData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setSearchStatus(undefined)
    setData(mockData)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              style={{ width: 200 }}
              placeholder="姓名/工号/手机号"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="部门">
            <Select
              style={{ width: 150 }}
              placeholder="请选择部门"
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
              style={{ width: 120 }}
              placeholder="请选择状态"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="active">在职</Option>
              <Option value="probation">试用期</Option>
              <Option value="leave">离职</Option>
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
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>员工列表</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {data.length} 人
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增员工
          </Button>
        </div>

        <Table columns={columns} data={data} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑员工' : '新增员工'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="工号"
                field="employeeNo"
                rules={[{ required: true, message: '请输入工号' }]}
              >
                <Input placeholder="请输入工号" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="姓名"
                field="name"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="部门"
                field="department"
                rules={[{ required: true, message: '请选择部门' }]}
              >
                <Select placeholder="请选择部门">
                  <Option value="技术部">技术部</Option>
                  <Option value="产品部">产品部</Option>
                  <Option value="市场部">市场部</Option>
                  <Option value="人事部">人事部</Option>
                  <Option value="财务部">财务部</Option>
                  <Option value="运营部">运营部</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="岗位"
                field="position"
                rules={[{ required: true, message: '请输入岗位' }]}
              >
                <Input placeholder="请输入岗位" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="手机号"
                field="phone"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input placeholder="请输入手机号" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="邮箱" field="email">
                <Input placeholder="请输入邮箱" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="入职日期" field="entryDate">
                <Input placeholder="请输入入职日期" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="状态"
                field="status"
                initialValue="active"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Option value="active">在职</Option>
                  <Option value="probation">试用期</Option>
                  <Option value="leave">离职</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Employee
