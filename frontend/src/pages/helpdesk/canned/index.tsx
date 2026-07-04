import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm } from '@arco-design/web-react'
import { IconPlus, IconCopy } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { getCannedResponses, createCannedResponse, updateCannedResponse, deleteCannedResponse, searchCannedResponses } from '@/api/helpdesk'
import type { CannedResponse } from '@/api/helpdesk'
import { toast } from '@/utils/toast'

export default function CannedResponsesPage() {
  const [items, setItems] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<CannedResponse | null>(null)
  const [form] = Form.useForm()
  const [keyword, setKeyword] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try { const r = keyword ? await searchCannedResponses(keyword) : await getCannedResponses(); setItems(r.data?.list || r.data || []) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); toast.success('已复制') }
  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ isGlobal: true, status: 'active' }); setModalVisible(true) }
  const openEdit = (r: CannedResponse) => { setEditing(r); form.setFieldsValue(r); setModalVisible(true) }

  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      editing ? await updateCannedResponse(editing.id, v) : await createCannedResponse(v)
      toast.success('保存成功'); setModalVisible(false); fetchAll()
    } catch (e: any) { if (e.message) toast.error(e.message) }
  }

  return (
    <PageContainer title="快捷回复" description="预设客服回复模板，支持变量替换：{{customer_name}} {{ticket_id}}"
      breadcrumbs={[{ label: 'HR服务台' }, { label: '快捷回复' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增模板</Button>}
      onRefresh={fetchAll}
    >
      <div className="lx-toolbar">
        <Input.Search placeholder="搜索模板..." value={keyword} onChange={setKeyword} onSearch={fetchAll} style={{ width: 280 }} />
      </div>
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '标题', dataIndex: 'title', width: 180 },
          { title: '内容', dataIndex: 'content', ellipsis: true, render: (v: string) => <span title={v}>{v?.substring(0, 60)}{(v?.length || 0) > 60 ? '...' : ''}</span> },
          { title: '分类', dataIndex: 'category', width: 100 },
          { title: '累计使用', dataIndex: 'usageCount', width: 90 },
          { title: '状态', dataIndex: 'status', width: 70, render: (v: string) => <Tag size="small" color={v === 'active' ? 'green' : 'gray'}>{v === 'active' ? '启用' : '停用'}</Tag> },
          { title: '操作', width: 160,
            render: (_: any, r: CannedResponse) => (
              <Space><Button size="small" type="text" icon={<IconCopy />} onClick={() => handleCopy(r.content)} />
                <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
                <Popconfirm title="删除？" onOk={async () => { await deleteCannedResponse(r.id); fetchAll() }}>
                  <Button size="small" type="text" status="danger">删除</Button></Popconfirm></Space>
            ),
          },
        ]} data={items} rowKey="id" pagination={false} />
      </Card>
      <Modal title={editing ? '编辑' : '新增'} visible={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item field="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="category" label="分类"><Input placeholder="账号问题 / 退款 / 通用" /></Form.Item>
          <Form.Item field="content" label="内容" rules={[{ required: true }]} extra="支持变量：{{customer_name}} {{ticket_id}}"><Input.TextArea rows={8} /></Form.Item>
          <Space><Form.Item field="isGlobal" label="全局可见" triggerPropName="checked"><Select options={[{ label: '是', value: 'true' }, { label: '个人', value: 'false' }]} /></Form.Item>
          <Form.Item field="status" label="状态"><Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} /></Form.Item></Space>
        </Form>
      </Modal>
    </PageContainer>
  )
}
