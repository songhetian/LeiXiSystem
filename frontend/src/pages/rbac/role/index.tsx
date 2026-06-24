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
  Tree,
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

interface Role {
  id: number
  name: string
  code: string
  description: string
  userCount: number
  status: 'active' | 'inactive'
  createTime: string
}

const mockData: Role[] = [
  { id: 1, name: '超级管理员', code: 'SUPER_ADMIN', description: '系统最高权限，拥有所有功能的访问权限', userCount: 2, status: 'active', createTime: '2024-01-01 00:00' },
  { id: 2, name: '系统管理员', code: 'ADMIN', description: '负责系统管理和配置', userCount: 5, status: 'active', createTime: '2024-01-01 00:00' },
  { id: 3, name: '人事主管', code: 'HR_MANAGER', description: '负责人力资源管理', userCount: 3, status: 'active', createTime: '2024-01-15 10:00' },
  { id: 4, name: '人事专员', code: 'HR_STAFF', description: '负责人事事务处理', userCount: 8, status: 'active', createTime: '2024-01-15 10:30' },
  { id: 5, name: '部门经理', code: 'DEPT_MANAGER', description: '负责部门日常管理和审批', userCount: 15, status: 'active', createTime: '2024-02-01 09:00' },
  { id: 6, name: '普通员工', code: 'EMPLOYEE', description: '普通员工基础权限', userCount: 120, status: 'active', createTime: '2024-01-01 00:00' },
  { id: 7, name: '财务人员', code: 'FINANCE', description: '负责财务相关工作', userCount: 6, status: 'inactive', createTime: '2024-03-01 14:00' },
]

const permissionTreeData = [
  {
    key: 'dashboard',
    title: '仪表盘',
    children: [
      { key: 'dashboard:view', title: '查看仪表盘' },
    ],
  },
  {
    key: 'personnel',
    title: '人员管理',
    children: [
      { key: 'personnel:view', title: '查看' },
      { key: 'personnel:add', title: '新增' },
      { key: 'personnel:edit', title: '编辑' },
      { key: 'personnel:delete', title: '删除' },
    ],
  },
  {
    key: 'organization',
    title: '公司架构',
    children: [
      { key: 'organization:view', title: '查看' },
      { key: 'organization:add', title: '新增' },
      { key: 'organization:edit', title: '编辑' },
      { key: 'organization:delete', title: '删除' },
    ],
  },
  {
    key: 'rbac',
    title: 'RBAC权限',
    children: [
      { key: 'rbac:view', title: '查看' },
      { key: 'rbac:add', title: '新增' },
      { key: 'rbac:edit', title: '编辑' },
      { key: 'rbac:delete', title: '删除' },
    ],
  },
  {
    key: 'attendance',
    title: '考勤打卡核算',
    children: [
      { key: 'attendance:view', title: '查看' },
      { key: 'attendance:export', title: '导出' },
      { key: 'attendance:checkin', title: '打卡管理' },
    ],
  },
]

function Role() {
  const [data, setData] = useState<Role[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [permVisible, setPermVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState<Role[]>(mockData)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const columns: TableProps<Role>['columns'] = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 140,
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      width: 140,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '角色描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      width: 80,
      render: (value: number) => (
        <span style={{ fontWeight: 600 }}>{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: Role) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconUser />}
            onClick={() => handlePermission(record)}
          >
            权限
          </Button>
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
            content="确定要删除该角色吗？"
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

  const handleEdit = (record: Role) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handlePermission = (record: Role) => {
    setCurrentRole(record)
    setCheckedKeys(['dashboard:view', 'personnel:view'])
    setPermVisible(true)
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
          userCount: 0,
          createTime: new Date().toLocaleString(),
          ...values,
        } as Role
        setData([...data, newRecord])
        setFilteredData([...filteredData, newRecord])
        Message.success('新增成功')
      }
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handlePermOk = () => {
    Message.success('权限保存成功')
    setPermVisible(false)
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
          <FormItem label="角色名称">
            <Input
              style={{ width: 200 }}
              placeholder="请输入角色名称"
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>角色列表</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 个角色
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增角色
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑角色' : '新增角色'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="角色名称"
                field="name"
                rules={[{ required: true, message: '请输入角色名称' }]}
              >
                <Input placeholder="请输入角色名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="角色编码"
                field="code"
                rules={[{ required: true, message: '请输入角色编码' }]}
              >
                <Input placeholder="请输入角色编码" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="角色描述" field="description">
            <Input.TextArea placeholder="请输入角色描述" rows={3} />
          </FormItem>
          <FormItem label="状态" field="status" initialValue="active">
            <Input placeholder="状态" />
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title={`配置权限 - ${currentRole?.name}`}
        visible={permVisible}
        onOk={handlePermOk}
        onCancel={() => setPermVisible(false)}
        width={520}
      >
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={setCheckedKeys as any}
          treeData={permissionTreeData}
          defaultExpandAll
        />
      </Modal>
    </div>
  )
}

export default Role
