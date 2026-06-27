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
  Tree,
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

interface Permission {
  id: number
  name: string
  code: string
  type: 'menu' | 'button' | 'api'
  parentId: number | null
  path?: string
  icon?: string
  sort: number
  status: 'active' | 'inactive'
  createTime: string
}

const mockData: Permission[] = [
  { id: 1, name: '仪表盘', code: 'dashboard', type: 'menu', parentId: null, path: '/dashboard', icon: 'IconDashboard', sort: 1, status: 'active', createTime: '2024-01-01' },
  { id: 2, name: '查看仪表盘', code: 'dashboard:view', type: 'button', parentId: 1, sort: 1, status: 'active', createTime: '2024-01-01' },
  { id: 3, name: '人员管理', code: 'personnel', type: 'menu', parentId: null, path: '/personnel', icon: 'IconUserGroup', sort: 2, status: 'active', createTime: '2024-01-01' },
  { id: 4, name: '查看', code: 'personnel:view', type: 'button', parentId: 3, sort: 1, status: 'active', createTime: '2024-01-01' },
  { id: 5, name: '新增', code: 'personnel:add', type: 'button', parentId: 3, sort: 2, status: 'active', createTime: '2024-01-01' },
  { id: 6, name: '编辑', code: 'personnel:edit', type: 'button', parentId: 3, sort: 3, status: 'active', createTime: '2024-01-01' },
  { id: 7, name: '删除', code: 'personnel:delete', type: 'button', parentId: 3, sort: 4, status: 'active', createTime: '2024-01-01' },
  { id: 8, name: '公司架构', code: 'organization', type: 'menu', parentId: null, path: '/organization', icon: 'IconUser', sort: 3, status: 'active', createTime: '2024-01-01' },
  { id: 9, name: 'RBAC权限', code: 'rbac', type: 'menu', parentId: null, path: '/rbac', icon: 'IconSafe', sort: 4, status: 'active', createTime: '2024-01-01' },
  { id: 10, name: '考勤打卡核算', code: 'attendance', type: 'menu', parentId: null, path: '/attendance', icon: 'IconCalendar', sort: 5, status: 'active', createTime: '2024-01-01' },
]

const typeMap: Record<string, { text: string; color: string }> = {
  menu: { text: '菜单', color: 'blue' },
  button: { text: '按钮', color: 'green' },
  api: { text: '接口', color: 'orange' },
}

function PermissionPage() {
  const [data] = useState<Permission[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<Permission[]>(mockData)

  const columns: TableProps<Permission>['columns'] = [
    {
      title: '权限名称',
      dataIndex: 'name',
      width: 180,
    },
    {
      title: '权限编码',
      dataIndex: 'code',
      width: 180,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (value: string) => {
        const info = typeMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '路由路径',
      dataIndex: 'path',
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 70,
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
      title: '创建时间',
      dataIndex: 'createTime',
      width: 120,
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Permission) => (
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
            content="确定要删除该权限吗？"
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

  const handleEdit = (record: Permission) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = (id: number) => {
    setFilteredData(filteredData.filter((item) => item.id !== id))
    Message.success('删除成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        setFilteredData(filteredData.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        Message.success('修改成功')
      } else {
        const newId = Math.max(...data.map((d) => d.id)) + 1
        const newRecord = {
          id: newId,
          createTime: new Date().toLocaleDateString(),
          ...values,
        } as Permission
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
      <Row gutter={16}>
        <Col span={5}>
          <Card bordered={false} style={{ height: '100%' }}>
            <div style={{ marginBottom: 12, fontWeight: 600 }}>权限结构</div>
            <Tree
              treeData={[
                {
                  key: 'all',
                  title: '全部权限',
                  children: data.filter(d => d.parentId === null).map(d => ({
                    key: String(d.id),
                    title: d.name,
                    children: data.filter(c => c.parentId === d.id).map(c => ({
                      key: String(c.id),
                      title: c.name,
                    })),
                  })),
                },
              ]}
              defaultExpandedKeys={['all']}
            />
          </Card>
        </Col>
        <Col span={19}>
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Form layout="inline">
              <FormItem label="权限名称">
                <Input
                  style={{ width: 180 }}
                  placeholder="请输入名称/编码"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="类型">
                <Select
                  style={{ width: 120 }}
                  placeholder="请选择"
                  value={searchType}
                  onChange={setSearchType}
                  allowClear
                >
                  <Option value="menu">菜单</Option>
                  <Option value="button">按钮</Option>
                  <Option value="api">接口</Option>
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
                <span style={{ fontSize: 16, fontWeight: 600 }}>权限列表</span>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  共 {filteredData.length} 条
                </Tag>
              </div>
              <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
                新增权限
              </Button>
            </div>

            <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingId ? '编辑权限' : '新增权限'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="权限名称"
                field="name"
                rules={[{ required: true, message: '请输入权限名称' }]}
              >
                <Input placeholder="请输入权限名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="权限编码"
                field="code"
                rules={[{ required: true, message: '请输入权限编码' }]}
              >
                <Input placeholder="请输入权限编码" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="权限类型"
                field="type"
                initialValue="menu"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select>
                  <Option value="menu">菜单</Option>
                  <Option value="button">按钮</Option>
                  <Option value="api">接口</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sort" initialValue={1}>
                <Input type="number" placeholder="请输入排序" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="路由路径" field="path">
            <Input placeholder="请输入路由路径，如 /dashboard" />
          </FormItem>
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

export default PermissionPage
