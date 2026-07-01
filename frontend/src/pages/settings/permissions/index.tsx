import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, Message, Popconfirm } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { get, post, put, del } from '@/api/request'

export default function PermissionsPage() {
  const [items, setItems] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pRes, rRes] = await Promise.all([get('/rbac/data-permissions'), get('/rbac/roles')])
      setItems(pRes.data?.list || pRes.data || [])
      setRoles(rRes.data?.list || rRes.data || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const open = (r?: any) => { setEdit(r || null); r ? form.setFieldsValue(r) : form.resetFields(); setVisible(true) }
  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      edit ? await put(`/rbac/data-permissions/${edit.id}`, v) : await post('/rbac/data-permissions', v)
      Message.success('保存成功'); setVisible(false); fetchAll()
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  return (
    <PageContainer title="数据权限" description="按角色配置模块级数据访问范围"
      breadcrumbs={[{ label: '系统管理' }, { label: '数据权限' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={() => open()}>新增权限</Button>}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '角色', dataIndex: 'roleName', width: 120 },
          { title: '模块', dataIndex: 'module', width: 120 },
          { title: '范围', dataIndex: 'scopeType', width: 120, render: (v: string) => {
            const m: Record<string, string> = { all: '全部', department: '本部门', department_tree: '部门树', self: '本人', assigned_departments: '指定部门', custom: '自定义' }
            return <Tag size="small">{m[v] || v}</Tag>
          }},
          { title: '可读', dataIndex: 'canRead', width: 60, render: (v: boolean) => <Tag size="small" color={v !== false ? 'green' : 'gray'}>{v !== false ? '是' : '否'}</Tag> },
          { title: '可写', dataIndex: 'canWrite', width: 60, render: (v: boolean) => <Tag size="small" color={v ? 'green' : 'gray'}>{v ? '是' : '否'}</Tag> },
          { title: '操作', width: 120, render: (_: any, r: any) => (
            <Space><Button size="small" type="text" onClick={() => open(r)}>编辑</Button>
              <Popconfirm title="删除？" onOk={async () => { await del(`/rbac/data-permissions/${r.id}`); fetchAll() }}>
                <Button size="small" type="text" status="danger">删除</Button></Popconfirm></Space>
          )},
        ]} data={items} rowKey="id" pagination={false} loading={loading} />
      </Card>
      <Modal focusLock title={edit ? '编辑' : '新增'} visible={visible} onOk={handleSubmit} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="roleId" label="角色"><Select options={roles.map((r: any) => ({ label: r.name, value: r.id }))} /></Form.Item>
          <Form.Item field="module" label="模块"><Select options={[
            { label: '员工管理', value: 'employee' }, { label: '排班', value: 'schedule' }, { label: '考勤', value: 'attendance' }, { label: '薪资', value: 'payroll' }, { label: 'Helpdesk', value: 'helpdesk' }, { label: 'OKR', value: 'okr' },
          ]} /></Form.Item>
          <Form.Item field="scopeType" label="数据范围"><Select options={[
            { label: '全部数据', value: 'all' }, { label: '本部门', value: 'department' }, { label: '部门及子部门', value: 'department_tree' }, { label: '仅本人', value: 'self' }, { label: '指定部门', value: 'assigned_departments' },
          ]} /></Form.Item>
          <Space><Form.Item field="canRead" label="可读" triggerPropName="checked"><Switch /></Form.Item>
          <Form.Item field="canWrite" label="可写" triggerPropName="checked"><Switch /></Form.Item></Space>
        </Form>
      </Modal>
    </PageContainer>
  )
}
