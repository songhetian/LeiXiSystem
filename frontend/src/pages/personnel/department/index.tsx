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
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface Department {
  id: number
  name: string
  parentDept: string
  manager: string
  employeeCount: number
  sort: number
  status: 'active' | 'inactive'
}

const mockData: Department[] = [
  { id: 1, name: '总经办', parentDept: '-', manager: '总经理', employeeCount: 5, sort: 1, status: 'active' },
  { id: 2, name: '技术部', parentDept: '总经办', manager: '技术总监', employeeCount: 30, sort: 2, status: 'active' },
  { id: 3, name: '产品部', parentDept: '总经办', manager: '产品总监', employeeCount: 12, sort: 3, status: 'active' },
  { id: 4, name: '市场部', parentDept: '总经办', manager: '市场总监', employeeCount: 15, sort: 4, status: 'active' },
  { id: 5, name: '人事部', parentDept: '总经办', manager: '人事经理', employeeCount: 8, sort: 5, status: 'active' },
  { id: 6, name: '财务部', parentDept: '总经办', manager: '财务经理', employeeCount: 6, sort: 6, status: 'active' },
  { id: 7, name: '运营部', parentDept: '总经办', manager: '运营总监', employeeCount: 10, sort: 7, status: 'active' },
  { id: 8, name: '前端组', parentDept: '技术部', manager: '前端组长', employeeCount: 10, sort: 1, status: 'active' },
  { id: 9, name: '后端组', parentDept: '技术部', manager: '后端组长', employeeCount: 15, sort: 2, status: 'active' },
  { id: 10, name: '测试组', parentDept: '技术部', manager: '测试组长', employeeCount: 5, sort: 3, status: 'active' },
]

function Department() {
  const [data, setData] = useState<Department[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()

  const columns: TableProps<Department>['columns'] = [
    {
      title: '部门名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '上级部门',
      dataIndex: 'parentDept',
      width: 120,
    },
    {
      title: '部门负责人',
      dataIndex: 'manager',
      width: 120,
    },
    {
      title: '人员数量',
      dataIndex: 'employeeCount',
      width: 100,
      render: (value: number) => (
        <Tag color="blue">{value} 人</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Department) => (
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
            content="确定要删除该部门吗？"
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

  const handleEdit = (record: Department) => {
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
        setData([...data, { id: newId, employeeCount: 0, ...values } as Department])
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
      result = result.filter((item) => item.name.includes(searchText))
    }
    if (searchStatus) {
      result = result.filter((item) => item.status === searchStatus)
    }
    setData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    setData(mockData)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="部门名称">
            <Input
              style={{ width: 200 }}
              placeholder="请输入部门名称"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              style={{ width: 120 }}
              placeholder="请选择状态"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>部门列表</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {data.length} 个部门
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增部门
          </Button>
        </div>

        <Table columns={columns} data={data} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑部门' : '新增部门'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 520 }}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="部门名称"
            field="name"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </FormItem>
          <FormItem label="上级部门" field="parentDept">
            <Select placeholder="请选择上级部门" allowClear>
              <Option value="总经办">总经办</Option>
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
            </Select>
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="部门负责人" field="manager">
                <Input placeholder="请输入负责人" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sort" initialValue={1}>
                <Input type="number" placeholder="请输入排序" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="状态" field="status" initialValue="active">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Department
