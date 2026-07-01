import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Message,
  Tag,
  Card,
  Tree,
  Spin,
} from '@arco-design/web-react'
import { IconPlus, IconUser } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getRoles, createRole, updateRole, deleteRole, getPermissionsTree } from '@/api/rbac'
import type { Role, Permission } from '@/api/rbac'
import { PageHeader, FilterBar, ActionButtons } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option

function RolePage() {
  const [data, setData] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [permVisible, setPermVisible] = useState(false)
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [permissionTree, setPermissionTree] = useState<Permission[]>([])
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getRoles({ page, pageSize, keyword: searchText || undefined })
      setData(res.data.list)
      setPagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total })
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
  }, [])

  const { visible, editingId, openCreate, openEdit, close, handleOk } = useCrudModal<Role>({
    form,
    initialValues: { level: 1, canViewAllDepts: 'false' },
    mapRecordToForm: (record) => ({
      name: record.name,
      description: record.description,
      level: record.level,
      canViewAllDepts: record.canViewAllDepts ? 'true' : 'false',
    }),
    onSubmit: async (values, id) => {
      const payload = { ...values, canViewAllDepts: values.canViewAllDepts === 'true' }
      if (id) {
        await updateRole(id, payload)
        Message.success('修改成功')
      } else {
        await createRole(payload)
        Message.success('新增成功')
      }
    },
    onSuccess: () => fetchData(pagination.current, pagination.pageSize),
  })

  const columns: TableProps<Role>['columns'] = [
    { title: '角色名称', dataIndex: 'name', width: 140 },
    { title: '角色级别', dataIndex: 'level', width: 80 },
    { title: '角色描述', dataIndex: 'description', ellipsis: true },
    { title: '用户数', dataIndex: 'userCount', width: 80, render: (value: number) => <span className={styles.role__bold}>{value}</span> },
    { title: '权限数', dataIndex: 'permissionCount', width: 80 },
    {
      title: '系统角色',
      dataIndex: 'isSystem',
      width: 90,
      render: (value: boolean) => <Tag color={value ? 'gold' : 'gray'}>{value ? '是' : '否'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (value: string) => (value ? new Date(value).toLocaleString() : '-') },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, record: Role) => (
        <ActionButtons
          onEdit={() => openEdit(record)}
          onDelete={!record.isSystem ? () => handleDelete(record.id) : undefined}
          deleteContent="确定要删除该角色吗？"
          extraBefore={
            <Button type="text" size="small" icon={<IconUser />} onClick={() => handlePermission(record)}>
              权限
            </Button>
          }
        />
      ),
    },
  ]

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

  const handlePermOk = async () => {
    if (!currentRole) return
    try {
      await updateRole(currentRole.id, { permissions: checkedKeys.map((k) => parseInt(k)) })
      Message.success('权限保存成功')
      setPermVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const treeData = permissionTree.map((p) => ({
    key: String(p.id),
    title: p.name,
    children: p.children?.map((c) => ({
      key: String(c.id),
      title: c.name,
      children: c.children?.map((cc) => ({ key: String(cc.id), title: cc.name })),
    })),
  }))

  return (
    <div className={styles.role}>
      <Card bordered={false} className={styles.role__card}>
        <PageHeader title="角色列表" description="管理系统角色，每个角色可绑定多个权限，影响成员可访问的功能范围。" extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增角色</Button>} />
      </Card>

      <Card bordered={false} className={styles.role__card}>
        <FilterBar
          filters={
            <FormItem label="角色名称">
              <Input className={styles['role__toolbar-input']} placeholder="请输入角色名称" value={searchText} onChange={setSearchText} allowClear />
            </FormItem>
          }
          onSearch={() => fetchData(1, pagination.pageSize)}
          onReset={() => { setSearchText(''); fetchData(1, pagination.pageSize) }}
        />
      </Card>

      <Card bordered={false}>
        <Table loading={loading} columns={columns} data={data} rowKey="id" pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, onChange: (page, pageSize) => fetchData(page, pageSize) }} />
      </Card>

      <Modal focusLock title={editingId ? '编辑角色' : '新增角色'} visible={visible} onOk={handleOk} onCancel={close} className={styles.role__modal}>
        <Form form={form} layout="vertical">
          <FormItem label="角色名称" field="name" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </FormItem>
          <FormItem label="角色级别" field="level" initialValue={1}>
            <Input type="number" min={1} max={99} className={styles['role__input-full']} />
          </FormItem>
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

      <Modal focusLock title={`配置权限 - ${currentRole?.name}`} visible={permVisible} onOk={handlePermOk} onCancel={() => setPermVisible(false)} className={styles.role__modal}>
        <Spin loading={permissionTree.length === 0}>
          <Tree checkable checkedKeys={checkedKeys} onCheck={setCheckedKeys} treeData={treeData} />
        </Spin>
      </Modal>
    </div>
  )
}

export default RolePage
