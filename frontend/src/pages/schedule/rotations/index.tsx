import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { get, post, put, del } from '@/api/request'
import { toast } from '@/utils/toast'

export default function RotationsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchAll = async () => {
    setLoading(true)
    try { const r = await get('/schedule/rotations'); setItems(r.data?.list || r.data || []) } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setVisible(true) }
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue(r); setVisible(true) }
  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      editing ? await put(`/schedule/rotations/${editing.id}`, v) : await post('/schedule/rotations', v)
      toast.success('保存成功'); setVisible(false); fetchAll()
    } catch (e: any) { if (e.message) toast.error(e.message) }
  }

  return (
    <PageContainer title="轮转规则" description="配置班次轮转周期与顺序"
      breadcrumbs={[{ label: '排班管理' }, { label: '轮转规则' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增规则</Button>}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '名称', dataIndex: 'name' }, { title: '轮转周期(天)', dataIndex: 'cycleDays', width: 120 },
          { title: '班次顺序', dataIndex: 'shiftSequence', width: 200 },
          { title: '操作', width: 100, render: (_: any, r: any) => (
            <Space><Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button><Button size="small" type="text" status="danger" onClick={async () => { await del(`/schedule/rotations/${r.id}`); fetchAll() }}>删除</Button></Space>
          )},
        ]} data={items} rowKey="id" pagination={false} loading={loading} />
      </Card>
      <Modal focusLock title={editing ? '编辑规则' : '新增规则'} visible={visible} onOk={handleSubmit} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="cycleDays" label="轮转周期(天)"><InputNumber min={1} /></Form.Item>
          <Form.Item field="shiftSequence" label="班次顺序"><Input placeholder="早班,中班,晚班" /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
