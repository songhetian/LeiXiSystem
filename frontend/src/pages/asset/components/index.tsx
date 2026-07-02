import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { get, post, put, del } from '@/api/request'
import { toast } from '@/utils/toast'

export default function AssetComponentsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchAll = async () => {
    setLoading(true)
    try { const r = await get('/asset/components'); setItems(r.data?.list || r.data || []) } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const open = (r?: any) => { setEdit(r || null); r ? form.setFieldsValue(r) : form.resetFields(); setVisible(true) }
  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      edit ? await put(`/asset/components/${edit.id}`, v) : await post('/asset/components', v)
      toast.success('保存成功'); setVisible(false); fetchAll()
    } catch (e: any) { if (e.message) toast.error(e.message) }
  }

  return (
    <PageContainer title="配件管理" description="管理资产配件库存与关联资产"
      breadcrumbs={[{ label: '资产管理' }, { label: '配件管理' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={() => open()}>新增配件</Button>}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '型号', dataIndex: 'model', width: 140 },
          { title: '库存', dataIndex: 'quantity', width: 80 },
          { title: '单价', dataIndex: 'unitPrice', width: 100, render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
          { title: '关联资产', dataIndex: 'linkedAsset', width: 120, render: (v: string) => v || '-' },
          { title: '操作', width: 100, render: (_: any, r: any) => (
            <Space><Button size="small" type="text" onClick={() => open(r)}>编辑</Button><Button size="small" type="text" status="danger" onClick={async () => { await del(`/asset/components/${r.id}`); fetchAll() }}>删除</Button></Space>
          )},
        ]} data={items} rowKey="id" pagination={false} loading={loading} />
      </Card>
      <Modal focusLock title={edit ? '编辑配件' : '新增配件'} visible={visible} onOk={handleSubmit} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="model" label="型号"><Input /></Form.Item>
          <Space><Form.Item field="quantity" label="库存"><InputNumber min={0} /></Form.Item><Form.Item field="unitPrice" label="单价"><InputNumber min={0} prefix="¥" /></Form.Item></Space>
          <Form.Item field="linkedAsset" label="关联资产"><Input /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
