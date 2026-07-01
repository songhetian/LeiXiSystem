import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, Tag, Space, Message, Popconfirm, Slider } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { get } from '@/api/request'
import { post, put } from '@/api/request'

export default function OkrPage() {
  const [objectives, setObjectives] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [krModal, setKrModal] = useState(false)
  const [editingObj, setEditingObj] = useState<any>(null)
  const [form] = Form.useForm()
  const [krForm] = Form.useForm()
  const [selectedObj, setSelectedObj] = useState<any>(null)
  const [keyResults, setKeyResults] = useState<any[]>([])
  const [progressModal, setProgressModal] = useState(false)
  const [selectedKr, setSelectedKr] = useState<any>(null)
  const [progressValue, setProgressValue] = useState(0)

  const fetchAll = async () => {
    setLoading(true)
    try { const r = await get('/okr/dashboard'); setObjectives(r.data || r.data?.list || []) } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const openCreateObj = () => { setEditingObj(null); form.resetFields(); setModalVisible(true) }
  const openEditObj = (r: any) => { setEditingObj(r); form.setFieldsValue(r); setModalVisible(true) }
  const handleObjSubmit = async () => {
    try {
      const v = await form.validate()
      editingObj ? await put(`/okr/objectives/${editingObj.id}`, v) : await post('/okr/objectives', v)
      Message.success('保存成功'); setModalVisible(false); fetchAll()
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  const openKrManager = async (obj: any) => {
    setSelectedObj(obj)
    const r = await get(`/okr/objectives/${obj.id}`); setKeyResults(r.data?.keyResults || []); setKrModal(true)
  }
  const handleKrAdd = async () => {
    try {
      const v = await krForm.validate()
      await post(`/okr/objectives/${selectedObj.id}/key-results`, v)
      Message.success('添加成功')
      const r = await get(`/okr/objectives/${selectedObj.id}`); setKeyResults(r.data?.keyResults || [])
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  const openProgress = (kr: any) => { setSelectedKr(kr); setProgressValue(kr.currentValue || 0); setProgressModal(true) }
  const handleProgress = async () => {
    try {
      await put(`/okr/key-results/${selectedKr.id}/progress`, { currentValue: progressValue })
      Message.success('更新成功'); setProgressModal(false); fetchAll()
    } catch (e: any) { Message.error(e.message) }
  }

  return (
    <PageContainer title="OKR 目标管理" description="组织目标与关键成果追踪"
      breadcrumbs={[{ label: 'OKR' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreateObj}>新建目标</Button>}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '目标', dataIndex: 'title', width: 240 },
          { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => <Tag size="small">{v}</Tag> },
          { title: '周期', dataIndex: 'period', width: 80 },
          { title: '进度', width: 200, render: (_: any, r: any) => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 8, background: '#e5e6eb', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', background: '#165dff', borderRadius: 4, width: `${r.progress ?? 0}%`, transition: 'width .3s' }} /></div><span style={{ fontSize: 13, minWidth: 36 }}>{r.progress ?? 0}%</span></div> },
          { title: '操作', width: 120,
            render: (_: any, r: any) => (
              <Space><Button size="small" type="text" onClick={() => openKrManager(r)}>KR</Button>
                <Button size="small" type="text" onClick={() => openEditObj(r)}>编辑</Button></Space>
            ),
          },
        ]} data={objectives} rowKey="id" pagination={false} />
      </Card>

      <Modal focusLock title={editingObj ? '编辑目标' : '新建目标'} visible={modalVisible} onOk={handleObjSubmit} onCancel={() => setModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="title" label="目标" rules={[{ required: true }]}><Input /></Form.Item>
          <Space><Form.Item field="type" label="类型"><Select options={[{ label: '公司', value: 'company' }, { label: '部门', value: 'department' }, { label: '个人', value: 'personal' }]} /></Form.Item>
          <Form.Item field="period" label="周期"><Select options={[{ label: 'Q1', value: 'Q1' }, { label: 'Q2', value: 'Q2' }, { label: 'Q3', value: 'Q3' }, { label: 'Q4', value: 'Q4' }]} /></Form.Item>
          <Form.Item field="year" label="年份"><InputNumber /></Form.Item></Space>
        </Form>
      </Modal>

      <Modal title={`${selectedObj?.title} · 关键结果`} visible={krModal} onCancel={() => setKrModal(false)} footer={null} width={700}>
        <div style={{ marginBottom: 16 }}><Space><Form form={krForm} layout="inline"><Form.Item field="title" label="KR"><Input /></Form.Item><Form.Item field="targetValue" label="目标值"><InputNumber /></Form.Item><Button type="primary" onClick={handleKrAdd}>添加</Button></Form></Space></div>
        {keyResults.map((kr: any) => (
          <Card key={kr.id} style={{ marginBottom: 8 }}><Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <span><strong>{kr.title}</strong> · 目标 {kr.targetType}: {kr.targetValue}</span>
            <Space><span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>当前 {kr.currentValue}</span>
              <Button size="small" onClick={() => openProgress(kr)}>更新进度</Button></Space>
          </Space></Card>
        ))}
      </Modal>

      <Modal title="更新进度" visible={progressModal} onOk={handleProgress} onCancel={() => setProgressModal(false)}>
        <div style={{ padding: '24px 0' }}>
          <Slider value={progressValue} onChange={setProgressValue} max={selectedKr?.targetValue || 100} showTicks />
        </div>
      </Modal>
    </PageContainer>
  )
}
