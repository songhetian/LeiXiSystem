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

interface Position {
  id: number
  name: string
  department: string
  level: string
  description: string
  sort: number
  status: 'active' | 'inactive'
}

const mockData: Position[] = [
  { id: 1, name: '总经理', department: '总经办', level: 'P10', description: '公司整体运营管理', sort: 1, status: 'active' },
  { id: 2, name: '技术总监', department: '技术部', level: 'P9', description: '技术团队管理和技术架构', sort: 1, status: 'active' },
  { id: 3, name: '高级工程师', department: '技术部', level: 'P7', description: '负责核心模块开发', sort: 2, status: 'active' },
  { id: 4, name: '前端工程师', department: '技术部', level: 'P6', description: '负责前端页面开发', sort: 3, status: 'active' },
  { id: 5, name: '后端工程师', department: '技术部', level: 'P6', description: '负责后端接口开发', sort: 4, status: 'active' },
  { id: 6, name: '测试工程师', department: '技术部', level: 'P5', description: '负责软件测试工作', sort: 5, status: 'active' },
  { id: 7, name: '产品总监', department: '产品部', level: 'P9', description: '产品战略和团队管理', sort: 1, status: 'active' },
  { id: 8, name: '产品经理', department: '产品部', level: 'P7', description: '负责产品规划和设计', sort: 2, status: 'active' },
  { id: 9, name: '人事经理', department: '人事部', level: 'P7', description: '负责人力资源管理', sort: 1, status: 'active' },
  { id: 10, name: '人事专员', department: '人事部', level: 'P5', description: '负责人事事务处理', sort: 2, status: 'active' },
]

function PositionPage() {
  const [data, setData] = useState<Position[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()

  const columns: TableProps<Position>['columns'] = [
    {
      title: '岗位名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      width: 120,
    },
    {
      title: '职级',
      dataIndex: 'level',
      width: 80,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '岗位描述',
      dataIndex: 'description',
      ellipsis: true,
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
      render: (_: any, record: Position) => (
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
            content="确定要删除该岗位吗？"
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

  const handleEdit = (record: Position) => {
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
        setData([...data, { id: newId, ...values } as Position])
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
    if (searchDept) {
      result = result.filter((item) => item.department === searchDept)
    }
    setData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setData(mockData)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="岗位名称">
            <Input
              style={{ width: 200 }}
              placeholder="请输入岗位名称"
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
              <Option value="总经办">总经办</Option>
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>岗位列表</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {data.length} 个岗位
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增岗位
          </Button>
        </div>

        <Table columns={columns} data={data} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑岗位' : '新增岗位'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={520}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="岗位名称"
            field="name"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input placeholder="请输入岗位名称" />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="所属部门"
                field="department"
                rules={[{ required: true, message: '请选择部门' }]}
              >
                <Select placeholder="请选择部门">
                  <Option value="总经办">总经办</Option>
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
              <FormItem label="职级" field="level">
                <Select placeholder="请选择职级">
                  <Option value="P10">P10</Option>
                  <Option value="P9">P9</Option>
                  <Option value="P8">P8</Option>
                  <Option value="P7">P7</Option>
                  <Option value="P6">P6</Option>
                  <Option value="P5">P5</Option>
                  <Option value="P4">P4</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="岗位描述" field="description">
            <Input.TextArea placeholder="请输入岗位描述" rows={3} />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="排序" field="sort" initialValue={1}>
                <Input type="number" placeholder="请输入排序" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default PositionPage