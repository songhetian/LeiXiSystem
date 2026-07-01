import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Message, Popconfirm } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { getHolidayLists, createHolidayList, updateHolidayList, deleteHolidayList, getHolidayDates, addHolidayDate, deleteHolidayDate, getHolidayCalendar } from '@/api/holidays'
import type { HolidayList } from '@/api/holidays'

export default function HolidaysPage() {
  const [lists, setLists] = useState<HolidayList[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingList, setEditingList] = useState<HolidayList | null>(null)
  const [form] = Form.useForm()

  const [selectedList, setSelectedList] = useState<HolidayList | null>(null)
  const [dates, setDates] = useState<any[]>([])
  const [dateModalVisible, setDateModalVisible] = useState(false)
  const [dateForm] = Form.useForm()
  const [calendarData, setCalendarData] = useState<any>(null)
  const [calendarVisible, setCalendarVisible] = useState(false)

  const fetchLists = async () => {
    setLoading(true)
    try { const r = await getHolidayLists(); setLists(r.data?.list || []) } finally { setLoading(false) }
  }
  useEffect(() => { fetchLists() }, [])

  const openCreate = () => { setEditingList(null); form.resetFields(); form.setFieldsValue({ status: 'active' }); setModalVisible(true) }
  const openEdit = (r: HolidayList) => { setEditingList(r); form.setFieldsValue(r); setModalVisible(true) }

  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      editingList ? await updateHolidayList(editingList.id, v) : await createHolidayList(v)
      Message.success('保存成功'); setModalVisible(false); fetchLists()
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  const openDateManager = async (list: HolidayList) => {
    setSelectedList(list)
    const r = await getHolidayDates(list.id); setDates(r.data || [])
  }
  const handleAddDate = async () => {
    try {
      const v = await dateForm.validate()
      await addHolidayDate(selectedList!.id, v)
      Message.success('添加成功'); setDateModalVisible(false)
      const r = await getHolidayDates(selectedList!.id); setDates(r.data || [])
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }
  const openCalendar = async (list: HolidayList) => {
    const r = await getHolidayCalendar(list.id)
    setCalendarData({ list, byMonth: r.data?.byMonth || {} }); setCalendarVisible(true)
  }

  const columns = [
    { title: '名称', dataIndex: 'name', width: 220 },
    { title: '年份', dataIndex: 'year', width: 80 },
    { title: '国家', dataIndex: 'country', width: 60 },
    { title: '默认', dataIndex: 'isDefault', width: 60, render: (v: boolean) => v ? <Tag size="small" color="blue">是</Tag> : null },
    { title: '状态', dataIndex: 'status', width: 70, render: (v: string) => <Tag size="small" color={v === 'active' ? 'green' : 'gray'}>{v === 'active' ? '启用' : '停用'}</Tag> },
    {
      title: '操作', width: 280,
      render: (_: any, r: HolidayList) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDateManager(r)}>管理日期</Button>
          <Button size="small" type="text" onClick={() => openCalendar(r)}>年视图</Button>
          <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onOk={async () => { await deleteHolidayList(r.id); fetchLists() }}>
            <Button size="small" type="text" status="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer title="节假日日历" description="管理国家法定节假日、调休工作日与假日豁免规则"
      breadcrumbs={[{ label: '系统管理' }, { label: '节假日日历' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增列表</Button>}
      onRefresh={fetchLists}
    >
      <Card className="lx-fade-in">
        <Table columns={columns} data={lists} rowKey="id" pagination={false} />
      </Card>

      {selectedList && (
        <Card title={`${selectedList.name} · 日期管理`} className="lx-fade-in">
          <div className="lx-toolbar">
            <div className="lx-toolbar__left">
              <Button size="small" type="primary" icon={<IconPlus />} onClick={() => { dateForm.resetFields(); setDateModalVisible(true) }}>添加日期</Button>
            </div>
            <div className="lx-toolbar__right">
              <Button size="small" onClick={() => setSelectedList(null)}>关闭</Button>
            </div>
          </div>
          <Table columns={[
            { title: '日期', dataIndex: 'date', width: 130, render: (v: string) => v?.split('T')[0] },
            { title: '名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'isWorkingDay', width: 120, render: (v: boolean) => <Tag size="small" color={v ? 'blue' : 'red'}>{v ? '调休上班' : '休息日'}</Tag> },
            { title: '描述', dataIndex: 'description' },
            {
              title: '操作', width: 80,
              render: (_: any, r: any) => (
                <Popconfirm title="确定删除？" onOk={async () => { await deleteHolidayDate(r.id); const d = await getHolidayDates(selectedList!.id); setDates(d.data || []) }}>
                  <Button size="small" type="text" status="danger">删除</Button>
                </Popconfirm>
              ),
            },
          ]} data={dates} rowKey="id" pagination={false} size="small" />
        </Card>
      )}

      <Modal focusLock title={editingList ? '编辑' : '新增'} visible={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item field="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="year" label="年份" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item field="country" label="国家"><Input /></Form.Item>
          <Form.Item field="status" label="状态"><Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} /></Form.Item>
        </Form>
      </Modal>

      <Modal focusLock title="添加日期" visible={dateModalVisible} onOk={handleAddDate} onCancel={() => setDateModalVisible(false)}>
        <Form form={dateForm} layout="vertical">
          <Form.Item field="date" label="日期" rules={[{ required: true }]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item field="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="isWorkingDay" label="调休上班"><Select options={[{ label: '否（休息日）', value: 'false' }, { label: '是（调休上班）', value: 'true' }]} /></Form.Item>
          <Form.Item field="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="年视图" visible={calendarVisible} onCancel={() => setCalendarVisible(false)} footer={null} width={800}>
        {calendarData?.byMonth && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <Card key={m} title={`${m}月`} size="small">
                {(calendarData.byMonth[m] || []).map((d: any) => (
                  <div key={d.date} style={{ fontSize: 12, marginBottom: 4 }}>
                    <Tag size="small" color={d.isWorkingDay ? 'blue' : 'red'}>{d.date?.split('-')[2]}</Tag> {d.name}
                  </div>
                ))}
                {(!calendarData.byMonth[m] || calendarData.byMonth[m].length === 0) && <div style={{ color: '#999', fontSize: 12 }}>无节假日</div>}
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
