import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomer } from '@/api/helpdesk'
import type { Customer } from '@/api/helpdesk'
import { toast } from '@/utils/toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form] = Form.useForm()
  const [detail, setDetail] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try { const r = await getCustomers({ page, keyword }); setCustomers(r.data?.list || []); setTotal(r.data?.total || 0) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [page])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'active' }); setModalVisible(true) }
  const openEdit = (r: Customer) => { setEditing(r); form.setFieldsValue(r); setModalVisible(true) }
  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      editing ? await updateCustomer(editing.id, v) : await createCustomer(v)
      toast.success('保存成功'); setModalVisible(false); fetchAll()
    } catch (e: any) { if (e.message) toast.error(e.message) }
  }

  const cols = [
    { title: '客户名称', dataIndex: 'name', width: 200, render: (v: string, r: Customer) => <Button type="text" onClick={async () => { const d = await getCustomer(r.id); setDetail(d.data) }}>{v}</Button> },
    { title: '联系人', dataIndex: 'contactName', width: 120 },
    { title: '电话', dataIndex: 'phone', width: 140 },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    { title: '工单', width: 80, render: (_: any, r: any) => r._count?.tickets ?? 0 },
    { title: '操作', width: 120,
      render: (_: any, r: Customer) => (
        <Space><Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="删除？" onOk={async () => { await deleteCustomer(r.id); fetchAll() }}>
            <Button size="small" type="text" status="danger">删除</Button></Popconfirm></Space>
      ),
    },
  ]

  return (
    <PageContainer title="客户管理" description="管理客服工单关联的客户档案与联系方式"
      breadcrumbs={[{ label: 'HR服务台' }, { label: '客户管理' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增客户</Button>}
      onRefresh={fetchAll}
    >
      <div className="lx-toolbar">
        <Input.Search placeholder="搜索..." value={keyword} onChange={setKeyword} onSearch={fetchAll} style={{ width: 260 }} />
      </div>
      <Card className="lx-fade-in">
        <Table columns={cols} data={customers} loading={loading} rowKey="id" pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </Card>
      <Modal title={editing ? '编辑' : '新增'} visible={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="contactName" label="联系人"><Input /></Form.Item>
          <Form.Item field="phone" label="电话"><Input /></Form.Item>
          <Form.Item field="email" label="邮箱"><Input /></Form.Item>
          <Form.Item field="address" label="地址"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item field="tags" label="标签"><Input /></Form.Item>
          <Form.Item field="status" label="状态"><Select options={[{ label: '正常', value: 'active' }, { label: '停用', value: 'inactive' }]} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`${detail?.name} 详情`} visible={!!detail} onCancel={() => setDetail(null)} footer={null} width={600}>
        <div>联系人: {detail?.contactName || '-'} | 电话: {detail?.phone || '-'} | 邮箱: {detail?.email || '-'}</div>
        <div>地址: {detail?.address || '-'} | 标签: {detail?.tags || '-'}</div>
      </Modal>
    </PageContainer>
  )
}
