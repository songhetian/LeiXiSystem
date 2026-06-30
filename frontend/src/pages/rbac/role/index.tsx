import { useState, useEffect } from 'react'
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
  Spin,
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
import { getRoles, createRole, updateRole, deleteRole, getPermissionsTree } from '@/api/rbac'
import type { Role, Permission } from '@/api/rbac'
import './style.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

function RolePage() {
  const [data, setData] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [permVisible, setPermVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [permissionTree, setPermissionTree] = useState<Permission[]>([])
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getRoles({
        page,
        pageSize,
        keyword: searchText || undefined,
      })
      setData(res.data.list)
      setPagination({
        current: res.data.page,
        pageSize: res.data.pageSize,
        total: res.data.total,
      })
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissionTree = async () => {
    try {
      const res = await getPermissionsTree()
      setPermissionTree(res.data)
    } catch {
      // error handled by interceptor
    }
  }

  useEffect(() => {
    fetchData()
    fetchPermissionTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: TableProps<Role>['columns'] = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 140,
    },
    {
      title: '角色级别',
      dataIndex: 'level',
      width: 80,
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
        <span className="role__bold">{value}</span>
      ),
    },
    {
      title: '权限数',
      dataIndex: 'permissionCount',
      width: 80,
    },
    {
      title: '系统角色',
      dataIndex: 'isSystem',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'gold' : 'gray'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, record: Role) => (
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
          {!record.isSystem && (
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
          )}
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
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      level: record.level,
      canViewAllDepts: record.canViewAllDepts,
    })
    setVisible(true)
  }

  const handlePermission = (record: Role) => {
    setCurrentRole(record)
    setCheckedKeys(record.permissions || [])
    setPermVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteRole(id)
      Message.success('删除成功')
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      const payload = {
        ...values,
        canViewAllDepts: values.canViewAllDepts === 'true',
      }
      if (editingId) {
        await updateRole(editingId, payload)
        Message.success('修改成功')
      } else {
        await createRole(payload)
        Message.success('新增成功')
      }
      setVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handlePermOk = async () => {
    if (!currentRole) return
    try {
      await updateRole(currentRole.id, {
        permissions: checkedKeys.map((k) => parseInt(k)),
      })
      Message.success('权限保存成功')
      setPermVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    fetchData(1, pagination.pageSize)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  const treeData = permissionTree.map((p) => ({
    key: String(p.id),
    title: p.name,
    children: p.children?.map((c) => ({
      key: String(c.id),
      title: c.name,
      children: c.children?.map((cc) => ({
        key: String(cc.id),
        title: cc.name,
      })),
    })),
  }))

  return (
    <div className="role">
      <Card bordered={false} className="role__toolbar">
        <Form layout="inline">
          <FormItem label="角色名称">
            <Input
              className="role__toolbar-input"
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
        <div className="role__header">
          <div>
            <span className="role__title">角色列表</span>
            <Tag color="blue" className="role__tag">
              共 {pagination.total} 个角色
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增角色
          </Button>
        </div>

        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑角色' : '新增角色'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className="role__modal"
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
                label="角色级别"
                field="level"
                initialValue={1}
              >
                <Input type="number" min={1} max={99} className="role__input-full" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="角色描述" field="description">
            <Input.TextArea placeholder="请输入角色描述" rows={3} />
          </FormItem>
          <FormItem label="可查看所有部门" field="canViewAllDepts" initialValue="false">
            <Select>
              <Option value="true">是</Option>
              <Option value="false">否</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title={`配置权限 - ${currentRole?.name}`}
        visible={permVisible}
        onOk={handlePermOk}
        onCancel={() => setPermVisible(false)}
        className="role__modal"
      >
        <Spin loading={permissionTree.length === 0}>
          <Tree
            checkable
            checkedKeys={checkedKeys}
            onCheck={setCheckedKeys}
            treeData={treeData}
          />
        </Spin>
      </Modal>
    </div>
  )
}

export default RolePage
