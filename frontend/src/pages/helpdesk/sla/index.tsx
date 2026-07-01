import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, Switch, Tag, Space, Message, Popconfirm } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { getSLAs, createSLA, updateSLA, deleteSLA } from '@/api/helpdesk'
import { getHolidayLists } from '@/api/holidays'
import type { HelpdeskSLA } from '@/api/helpdesk'

export default function SlaConfigPage() {
  const [slas, setSlas] = useState<HelpdeskSLA[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<HelpdeskSLA | null>(null)
  const [form] = Form.useForm()
  const [holidayLists, setHolidayLists] = useState<any[]>([])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, hRes] = await Promise.all([getSLAs(), getHolidayLists()])
      setSlas(sRes.data?.list || [])
      setHolidayLists(hRes.data?.list || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const openCreate = () => {
    setEditing(null); form.resetFields()
    form.setFieldsValue({ workdaysOnly: true, escalationEnabled: true, status: 'active' })
    setModalVisible(true)
  }
  const openEdit = (r: HelpdeskSLA) => { setEditing(r); form.setFieldsValue(r); setModalVisible(true) }

  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      editing ? await updateSLA(editing.id, v) : await createSLA(v)
      Message.success('保存成功'); setModalVisible(false); fetchAll()
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  const columns = [
    { title: '策略名称', dataIndex: 'name', width: 180 },
    { title: '优先级', dataIndex: 'priority', width: 80 },
    { title: '客户等级', dataIndex: 'customerTier', width: 100, render: (v: string) => v ? <Tag>{v}</Tag> : <span>-</span> },
    { title: '响应 / 解决', width: 140, render: (_: any, r: HelpdeskSLA) => `${r.responseTime}分 / ${r.resolutionTime}分` },
    { title: '仅工作日', dataIndex: 'workdaysOnly', width: 90, render: (v: boolean) => <Tag size="small" color={v ? 'blue' : 'gray'}>{v ? '是' : '否'}</Tag> },
    { title: '升级告警', dataIndex: 'escalationEnabled', width: 90, render: (v: boolean) => <Tag size="small" color={v ? 'green' : 'gray'}>{v ? '启用' : '关闭'}</Tag> },
    { title: '状态', dataIndex: 'status', width: 70, render: (v: string) => <Tag size="small" color={v === 'active' ? 'green' : 'gray'}>{v === 'active' ? '启用' : '停用'}</Tag> },
    {
      title: '操作', width: 140,
      render: (_: any, r: HelpdeskSLA) => (
        <Space>
          <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onOk={async () => { await deleteSLA(r.id); fetchAll() }}>
            <Button size="small" type="text" status="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer title="SLA 策略配置" description="服务等级协议：响应时限、解决时限与升级告警规则"
      breadcrumbs={[{ label: 'HR服务台', path: '/helpdesk/tickets' }, { label: 'SLA 策略' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增策略</Button>}
      loading={loading && slas.length === 0}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={columns} data={slas} rowKey="id" pagination={false} />
      </Card>

      <Modal focusLock title={editing ? '编辑策略' : '新增策略'} visible={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)} width={540}>
        <Form form={form} layout="vertical">
          <Form.Item field="name" label="策略名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Space><Form.Item field="priority" label="优先级"><Select options={[{ label: '紧急', value: 'urgent' }, { label: '高', value: 'high' }, { label: '中', value: 'medium' }, { label: '低', value: 'low' }]} allowClear /></Form.Item>
          <Form.Item field="customerTier" label="客户等级"><Select options={[{ label: 'VIP', value: 'vip' }, { label: '普通', value: 'normal' }]} allowClear /></Form.Item></Space>
          <Space><Form.Item field="responseTime" label="响应(分)" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          <Form.Item field="resolutionTime" label="解决(分)" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item></Space>
          <Form.Item field="holidayListId" label="节假日日历"><Select options={holidayLists.map((h: any) => ({ label: `${h.name} (${h.year})`, value: h.id }))} allowClear /></Form.Item>
          <Space><Form.Item field="workdaysOnly" label="仅工作日" triggerPropName="checked"><Switch /></Form.Item>
          <Form.Item field="escalationEnabled" label="升级告警" triggerPropName="checked"><Switch /></Form.Item>
          <Form.Item field="status" label="状态"><Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} /></Form.Item></Space>
        </Form>
      </Modal>
    </PageContainer>
  )
}
