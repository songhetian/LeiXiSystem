import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Message, Space, Tag } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { get, post, put, del } from '@/api/request'

export default function PoliciesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchAll = async () => {
    setLoading(true)
    try { const r = await get('/vacation/policies'); setItems(r.data?.list || r.data || []) } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const open = (r?: any) => { setEdit(r || null); r ? form.setFieldsValue(r) : form.resetFields(); setVisible(true) }
  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      edit ? await put(`/vacation/policies/${edit.id}`, v) : await post('/vacation/policies', v)
      Message.success('保存成功'); setVisible(false); fetchAll()
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  return (
    <PageContainer title="请假策略" description="配置请假限制规则与审批条件"
      breadcrumbs={[{ label: '假期管理' }, { label: '请假策略' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={() => open()}>新增策略</Button>}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'leaveType', width: 100, render: (v: string) => <Tag size="small">{v}</Tag> },
          { title: '最小提前(天)', dataIndex: 'minAdvanceDays', width: 120 },
          { title: '单次最大(天)', dataIndex: 'maxDaysPerRequest', width: 130 },
          { title: '年累计(天)', dataIndex: 'maxDaysPerYear', width: 110 },
          { title: '操作', width: 100, render: (_: any, r: any) => (
            <Space><Button size="small" type="text" onClick={() => open(r)}>编辑</Button><Button size="small" type="text" status="danger" onClick={async () => { await del(`/vacation/policies/${r.id}`); fetchAll() }}>删除</Button></Space>
          )},
        ]} data={items} rowKey="id" pagination={false} />
      </Card>
      <Modal focusLock title={edit ? '编辑策略' : '新增策略'} visible={visible} onOk={handleSubmit} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="leaveType" label="请假类型"><Select options={[{ label: '年假', value: 'annual' }, { label: '病假', value: 'sick' }, { label: '事假', value: 'personal' }, { label: '调休', value: 'compensatory' }]} /></Form.Item>
          <Space><Form.Item field="minAdvanceDays" label="提前(天)"><InputNumber /></Form.Item><Form.Item field="maxDaysPerRequest" label="单次最大(天)"><InputNumber /></Form.Item><Form.Item field="maxDaysPerYear" label="年累计(天)"><InputNumber /></Form.Item></Space>
        </Form>
      </Modal>
    </PageContainer>
  )
}
