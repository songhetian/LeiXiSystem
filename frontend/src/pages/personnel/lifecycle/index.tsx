import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Message, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography } from '@arco-design/web-react'
const { Text } = Typography
import type { TableProps } from '@arco-design/web-react'
import { IconCheck, IconDelete, IconEdit, IconPlus } from '@arco-design/web-react/icon'
import {
  completeLifecycleEvent, createLifecycleEvent, updateLifecycleEvent, deleteLifecycleEvent,
  getLifecycleEvents, getLifecycleEventDetail,
  getOnboardingTasks, createOnboardingTask, updateOnboardingTask, deleteOnboardingTask, getOnboardingTaskDetail,
  getOffboardingTasks, createOffboardingTask, updateOffboardingTask, deleteOffboardingTask,
  getEmployeeDocuments, createEmployeeDocument, updateEmployeeDocument, deleteEmployeeDocument,
  getEmployeeContracts, createEmployeeContract, updateEmployeeContract, deleteEmployeeContract,
} from '@/api/lifecycle'
import { getEmployees, type Employee } from '@/api/personnel'
import './lifecycle.css'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

// ===== Types =====

type LifecycleEvent = {
  id: number
  eventType: string
  title: string
  description?: string
  effectiveDate: string
  status: string
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  creator?: { realName: string }
  createdAt?: string
}

type LifecycleTask = {
  id: number
  title: string
  description?: string
  dueDate?: string
  status: string
  assignedTo?: number
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  assignee?: { realName: string }
  creator?: { realName: string }
  createdAt?: string
}

type EmployeeDocument = {
  id: number
  name: string
  documentType: string
  fileUrl?: string
  status: string
  expiresAt?: string
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  createdAt?: string
  updatedAt?: string
}

type EmployeeContract = {
  id: number
  contractNo: string
  contractType: string
  startDate: string
  endDate?: string
  status: string
  fileUrl?: string
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  createdAt?: string
  updatedAt?: string
}

// ===== Constants =====

const eventTypeOptions = [
  { value: 'onboarding', label: '入职' },
  { value: 'probation', label: '转正' },
  { value: 'transfer', label: '调岗' },
  { value: 'promotion', label: '晋升' },
  { value: 'salary_adjustment', label: '薪资调整' },
  { value: 'offboarding', label: '离职' },
  { value: 'rehire', label: '返聘' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'orange' },
  processing: { text: '处理中', color: 'blue' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  active: { text: '有效', color: 'green' },
  inactive: { text: '无效', color: 'gray' },
  expired: { text: '已过期', color: 'red' },
  terminated: { text: '已终止', color: 'red' },
}

const documentTypeOptions = [
  { value: 'id_card', label: '身份证' },
  { value: 'diploma', label: '学历证书' },
  { value: 'contract', label: '劳动合同' },
  { value: 'offer', label: 'Offer' },
  { value: 'other', label: '其他' },
]

const contractTypeOptions = [
  { value: '正式合同', label: '正式合同' },
  { value: '实习合同', label: '实习合同' },
  { value: '劳务合同', label: '劳务合同' },
  { value: '保密协议', label: '保密协议' },
  { value: '竞业协议', label: '竞业协议' },
  { value: '其他', label: '其他' },
]

function StatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

function EmployeeCell({ record }: { record: any }) {
  return `${record.employee?.user?.realName || '-'}(${record.employee?.employeeNo || '-'})`
}

// ===== Lifecycle Events =====

function EventFormModal({
  visible, editing, employees, onClose, onSuccess,
}: {
  visible: boolean
  editing: LifecycleEvent | null
  employees: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          employeeId: editing.employee?.id,
          eventType: editing.eventType,
          title: editing.title,
          description: editing.description,
          effectiveDate: editing.effectiveDate ? new Date(editing.effectiveDate) : undefined,
          status: editing.status,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({ eventType: 'onboarding', status: 'pending' })
      }
    }
  }, [visible, editing, form])

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      const data = {
        ...values,
        effectiveDate: values.effectiveDate instanceof Date
          ? values.effectiveDate.toISOString().split('T')[0]
          : values.effectiveDate,
      }
      if (editing) {
        await updateLifecycleEvent(editing.id, data)
        Message.success('更新成功')
      } else {
        await createLifecycleEvent(data)
        Message.success('创建成功')
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={editing ? '编辑生命周期事件' : '新增生命周期事件'}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      className="lifecycle-page__modal--560"
    >
      <Form form={form} layout="vertical">
        {!editing && (
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="请选择员工" showSearch>
              {employees.map((e) => (
                <Option key={e.id} value={e.id}>
                  {e.realName}({e.employeeNo})
                </Option>
              ))}
            </Select>
          </FormItem>
        )}
        <FormItem label="事件类型" field="eventType" rules={[{ required: true, message: '请选择事件类型' }]}>
          <Select>
            {eventTypeOptions.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
          </Select>
        </FormItem>
        <FormItem label="标题" field="title" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="例如：张三入职流程" />
        </FormItem>
        <FormItem label="生效日期" field="effectiveDate" rules={[{ required: true, message: '请选择生效日期' }]}>
          <DatePicker className="lifecycle-page__date-picker-full" />
        </FormItem>
        <FormItem label="状态" field="status">
          <Select>
            <Option value="pending">待处理</Option>
            <Option value="processing">处理中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
        </FormItem>
        <FormItem label="说明" field="description">
          <Input.TextArea rows={3} placeholder="补充说明" />
        </FormItem>
      </Form>
    </Modal>
  )
}

function EventDetailModal({
  visible, eventId, onClose,
}: {
  visible: boolean
  eventId: number | null
  onClose: () => void
}) {
  const [data, setData] = useState<LifecycleEvent | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible && eventId) {
      setLoading(true)
      getLifecycleEventDetail(eventId).then((res: any) => {
        setData(res?.data || null)
      }).finally(() => setLoading(false))
    }
  }, [visible, eventId])

  return (
    <Modal title="事件详情" visible={visible} onOk={onClose} onCancel={onClose} footer={null} className="lifecycle-page__modal--600">
      {loading ? (
        <div className="lifecycle-page__text-center">加载中...</div>
      ) : data ? (
        <div className="lifecycle-page__detail-grid">
          <div><Text type="secondary">员工</Text><div>{data.employee?.user?.realName}({data.employee?.employeeNo})</div></div>
          <div><Text type="secondary">类型</Text><div><Tag color="blue">{eventTypeOptions.find((e) => e.value === data.eventType)?.label || data.eventType}</Tag></div></div>
          <div className="lifecycle-page__detail-col-full"><Text type="secondary">标题</Text><div>{data.title}</div></div>
          <div><Text type="secondary">生效日期</Text><div>{formatDate(data.effectiveDate)}</div></div>
          <div><Text type="secondary">状态</Text><div><StatusTag value={data.status} /></div></div>
          <div className="lifecycle-page__detail-col-full"><Text type="secondary">说明</Text><div>{data.description || '-'}</div></div>
          <div><Text type="secondary">创建人</Text><div>{data.creator?.realName || '-'}</div></div>
          <div><Text type="secondary">创建时间</Text><div>{formatDate(data.createdAt)}</div></div>
        </div>
      ) : (
        <div className="lifecycle-page__text-center">未找到数据</div>
      )}
    </Modal>
  )
}

function EventsTab({ employees, onRefresh }: { employees: Employee[]; onRefresh: () => void }) {
  const [data, setData] = useState<LifecycleEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, string | number | undefined>>({})
  const [eventModal, setEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LifecycleEvent | null>(null)
  const [detailModal, setDetailModal] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const loadData = useCallback(async (p = page, f = filters) => {
    setLoading(true)
    try {
      const res = await getLifecycleEvents({ page: p, pageSize: 10, ...f })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleDelete = async (id: number) => {
    await deleteLifecycleEvent(id)
    Message.success('删除成功')
    loadData()
  }

  const handleComplete = async (id: number) => {
    await completeLifecycleEvent(id)
    Message.success('已完成')
    loadData()
  }

  const columns: TableProps<LifecycleEvent>['columns'] = useMemo(() => [
    {
      title: '员工',
      render: (_: any, record) => <EmployeeCell record={record} />,
      filterHeader: (
        <Select placeholder="筛选员工" allowClear className="lifecycle-page__filter-select--140"
          onChange={(v) => handleFilter('employeeId', v)}>
          {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}</Option>)}
        </Select>
      ),
    },
    {
      title: '类型',
      dataIndex: 'eventType',
      width: 100,
      render: (v) => <Tag color="blue">{eventTypeOptions.find((e) => e.value === v)?.label || v}</Tag>,
      filterHeader: (
        <Select placeholder="筛选类型" allowClear className="lifecycle-page__filter-select--120"
          onChange={(v) => handleFilter('eventType', v)}>
          {eventTypeOptions.map((e) => <Option key={e.value} value={e.value}>{e.label}</Option>)}
        </Select>
      ),
    },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      width: 120,
      render: formatDate,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v) => <StatusTag value={v} />,
      filterHeader: (
        <Select placeholder="筛选状态" allowClear className="lifecycle-page__filter-select--100"
          onChange={(v) => handleFilter('status', v)}>
          {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
        </Select>
      ),
    },
    { title: '创建人', dataIndex: 'creator', render: (_: any, r) => r.creator?.realName || '-' },
    {
      title: '操作',
      width: 160,
      render: (_: any, record) => (
        <Space>
          <Button size="small" type="text" icon={<IconEdit />}
            onClick={() => { setEditingEvent(record); setEventModal(true) }} />
          <Button size="small" type="text" onClick={() => { setDetailId(record.id); setDetailModal(true) }}>
            详情
          </Button>
          {record.status !== 'completed' && (
            <Button size="small" type="text" icon={<IconCheck />}
              onClick={() => handleComplete(record.id)} />
          )}
          <Popconfirm title="确定删除？" onOk={() => handleDelete(record.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [employees, loadData])

  return (
    <>
      <div className="lifecycle-page__actions">
        <Button type="primary" icon={<IconPlus />} onClick={() => { setEditingEvent(null); setEventModal(true) }}>
          新增事件
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
      <EventFormModal
        visible={eventModal} editing={editingEvent} employees={employees}
        onClose={() => setEventModal(false)} onSuccess={() => { setEventModal(false); loadData() }}
      />
      <EventDetailModal visible={detailModal} eventId={detailId} onClose={() => setDetailModal(false)} />
    </>
  )
}

// ===== Tasks =====

function TaskFormModal({
  visible, editing, employees, taskType, onClose, onSuccess,
}: {
  visible: boolean
  editing: LifecycleTask | null
  employees: Employee[]
  taskType: 'onboarding' | 'offboarding'
  onClose: () => void
  onSuccess: () => void
}) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          employeeId: editing.employee?.id,
          title: editing.title,
          description: editing.description,
          dueDate: editing.dueDate ? new Date(editing.dueDate) : undefined,
          assignedTo: editing.assignedTo,
          status: editing.status,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({ status: 'pending' })
      }
    }
  }, [visible, editing, form])

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      const data = {
        ...values,
        dueDate: values.dueDate instanceof Date
          ? values.dueDate.toISOString().split('T')[0]
          : values.dueDate,
      }
      if (editing) {
        if (taskType === 'onboarding') await updateOnboardingTask(editing.id, data)
        else await updateOffboardingTask(editing.id, data)
        Message.success('更新成功')
      } else {
        if (taskType === 'onboarding') await createOnboardingTask(data)
        else await createOffboardingTask(data)
        Message.success('创建成功')
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={editing ? `编辑${taskType === 'onboarding' ? '入职' : '离职'}任务` : `新增${taskType === 'onboarding' ? '入职' : '离职'}任务`}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      className="lifecycle-page__modal--560"
    >
      <Form form={form} layout="vertical">
        {!editing && (
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="请选择员工" showSearch>
              {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
            </Select>
          </FormItem>
        )}
        <FormItem label="任务标题" field="title" rules={[{ required: true, message: '请输入任务标题' }]}>
          <Input placeholder="例如：准备办公设备" />
        </FormItem>
        <FormItem label="说明" field="description">
          <Input.TextArea rows={2} placeholder="任务说明" />
        </FormItem>
        <FormItem label="截止日期" field="dueDate">
          <DatePicker className="lifecycle-page__date-picker-full" />
        </FormItem>
        <FormItem label="负责人" field="assignedTo">
          <Select placeholder="选择负责人（可选）" allowClear showSearch>
            {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
          </Select>
        </FormItem>
        <FormItem label="状态" field="status">
          <Select>
            <Option value="pending">待处理</Option>
            <Option value="processing">处理中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
        </FormItem>
      </Form>
    </Modal>
  )
}

function TasksTab({
  employees, getTasks, updateTask, deleteTask, createTask, taskType,
}: {
  employees: any[]
  getTasks: (params?: any) => Promise<any>
  updateTask: (id: number, data: any) => Promise<any>
  deleteTask: (id: number) => Promise<any>
  createTask: (data: any) => Promise<any>
  taskType: 'onboarding' | 'offboarding'
}) {
  const [data, setData] = useState<LifecycleTask[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [taskModal, setTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<LifecycleTask | null>(null)

  const loadData = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await getTasks({ page: p, pageSize: 10, ...(s ? { status: s } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, getTasks])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: number) => {
    await deleteTask(id)
    Message.success('删除成功')
    loadData()
  }

  const handleStatusChange = async (id: number, status: string) => {
    await updateTask(id, { status })
    Message.success('状态已更新')
    loadData()
  }

  const columns: TableProps<LifecycleTask>['columns'] = useMemo(() => [
    {
      title: '员工',
      render: (_: any, record) => <EmployeeCell record={record} />,
    },
    { title: '任务', dataIndex: 'title', ellipsis: true },
    { title: '负责人', dataIndex: 'assignee', render: (_: any, r) => r.assignee?.realName || '-' },
    { title: '截止日期', dataIndex: 'dueDate', width: 120, render: formatDate },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v) => <StatusTag value={v} />,
      filterHeader: (
        <Select placeholder="筛选状态" allowClear className="lifecycle-page__filter-select--100"
          onChange={(v) => { setStatusFilter(v); setPage(1) }}>
          {['pending', 'processing', 'completed', 'cancelled'].map((k) => (
            <Option key={k} value={k}>{statusMap[k]?.text}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: any, record) => (
        <Space>
          <Button size="small" type="text" icon={<IconEdit />}
            onClick={() => { setEditingTask(record); setTaskModal(true) }} />
          {record.status !== 'completed' && (
            <Select size="mini" className="lifecycle-page__status-select--80" defaultValue={record.status}
              onChange={(v) => handleStatusChange(record.id, v)} triggerProps={{ autoAlignPopupWidth: false }}>
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="completed">完成</Option>
            </Select>
          )}
          <Popconfirm title="确定删除？" onOk={() => handleDelete(record.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [loadData])

  const label = taskType === 'onboarding' ? '入职' : '离职'

  return (
    <>
      <div className="lifecycle-page__actions">
        <Button type="primary" icon={<IconPlus />} onClick={() => { setEditingTask(null); setTaskModal(true) }}>
          新增{label}任务
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
      <TaskFormModal
        visible={taskModal} editing={editingTask} employees={employees} taskType={taskType}
        onClose={() => setTaskModal(false)} onSuccess={() => { setTaskModal(false); loadData() }}
      />
    </>
  )
}

// ===== Documents =====

function DocumentFormModal({
  visible, editing, employees, onClose, onSuccess,
}: {
  visible: boolean
  editing: EmployeeDocument | null
  employees: Employee[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          employeeId: editing.employee?.id,
          name: editing.name,
          documentType: editing.documentType,
          fileUrl: editing.fileUrl,
          status: editing.status,
          expiresAt: editing.expiresAt ? new Date(editing.expiresAt) : undefined,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({ status: 'active' })
      }
    }
  }, [visible, editing, form])

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      const data = {
        ...values,
        expiresAt: values.expiresAt instanceof Date
          ? values.expiresAt.toISOString().split('T')[0]
          : values.expiresAt,
      }
      if (editing) {
        await updateEmployeeDocument(editing.id, data)
        Message.success('更新成功')
      } else {
        await createEmployeeDocument(data)
        Message.success('创建成功')
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={editing ? '编辑员工文档' : '新增员工文档'} visible={visible}
      onOk={handleSubmit} onCancel={onClose} confirmLoading={submitting} className="lifecycle-page__modal--560">
      <Form form={form} layout="vertical">
        {!editing && (
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="请选择员工" showSearch>
              {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
            </Select>
          </FormItem>
        )}
        <FormItem label="文档名称" field="name" rules={[{ required: true, message: '请输入文档名称' }]}>
          <Input placeholder="例如：身份证复印件" />
        </FormItem>
        <FormItem label="文档类型" field="documentType" rules={[{ required: true, message: '请选择类型' }]}>
          <Select placeholder="选择文档类型">
            {documentTypeOptions.map((e) => <Option key={e.value} value={e.value}>{e.label}</Option>)}
          </Select>
        </FormItem>
        <FormItem label="文件地址" field="fileUrl">
          <Input placeholder="文件 URL 地址" />
        </FormItem>
        <FormItem label="状态" field="status">
          <Select>
            <Option value="active">有效</Option>
            <Option value="inactive">无效</Option>
            <Option value="expired">已过期</Option>
          </Select>
        </FormItem>
        <FormItem label="到期日期" field="expiresAt">
          <DatePicker className="lifecycle-page__date-picker-full" />
        </FormItem>
      </Form>
    </Modal>
  )
}

function DocumentsTab({ employees }: { employees: any[] }) {
  const [data, setData] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [docModal, setDocModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null)

  const loadData = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await getEmployeeDocuments({ page: p, pageSize: 10, ...(s ? { status: s } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: number) => {
    await deleteEmployeeDocument(id)
    Message.success('删除成功')
    loadData()
  }

  const columns: TableProps<EmployeeDocument>['columns'] = useMemo(() => [
    { title: '员工', render: (_: any, r) => <EmployeeCell record={r} /> },
    { title: '文档名称', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'documentType', width: 100,
      render: (v) => documentTypeOptions.find((e) => e.value === v)?.label || v },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v) => <StatusTag value={v} />,
      filterHeader: (
        <Select placeholder="筛选状态" allowClear className="lifecycle-page__filter-select--100"
          onChange={(v) => { setStatusFilter(v); setPage(1) }}>
          {['active', 'inactive', 'expired'].map((k) => <Option key={k} value={k}>{statusMap[k]?.text}</Option>)}
        </Select>
      ),
    },
    { title: '到期日期', dataIndex: 'expiresAt', width: 120, render: formatDate },
    {
      title: '操作', width: 120,
      render: (_: any, record) => (
        <Space>
          <Button size="small" type="text" icon={<IconEdit />}
            onClick={() => { setEditingDoc(record); setDocModal(true) }} />
          <Popconfirm title="确定删除？" onOk={() => handleDelete(record.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [loadData])

  return (
    <>
      <div className="lifecycle-page__actions">
        <Button type="primary" icon={<IconPlus />} onClick={() => { setEditingDoc(null); setDocModal(true) }}>
          新增文档
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
      <DocumentFormModal
        visible={docModal} editing={editingDoc} employees={employees}
        onClose={() => setDocModal(false)} onSuccess={() => { setDocModal(false); loadData() }}
      />
    </>
  )
}

// ===== Contracts =====

function ContractFormModal({
  visible, editing, employees, onClose, onSuccess,
}: {
  visible: boolean
  editing: EmployeeContract | null
  employees: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible) {
      if (editing) {
        form.setFieldsValue({
          employeeId: editing.employee?.id,
          contractNo: editing.contractNo,
          contractType: editing.contractType,
          startDate: editing.startDate ? new Date(editing.startDate) : undefined,
          endDate: editing.endDate ? new Date(editing.endDate) : undefined,
          status: editing.status,
          fileUrl: editing.fileUrl,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({ status: 'active' })
      }
    }
  }, [visible, editing, form])

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      const data = {
        ...values,
        startDate: values.startDate instanceof Date
          ? values.startDate.toISOString().split('T')[0]
          : values.startDate,
        endDate: values.endDate instanceof Date
          ? values.endDate.toISOString().split('T')[0]
          : values.endDate,
      }
      if (editing) {
        await updateEmployeeContract(editing.id, data)
        Message.success('更新成功')
      } else {
        await createEmployeeContract(data)
        Message.success('创建成功')
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={editing ? '编辑劳动合同' : '新增劳动合同'} visible={visible}
      onOk={handleSubmit} onCancel={onClose} confirmLoading={submitting} className="lifecycle-page__modal--600">
      <Form form={form} layout="vertical">
        {!editing && (
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="请选择员工" showSearch>
              {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
            </Select>
          </FormItem>
        )}
        <FormItem label="合同编号" field="contractNo" rules={[{ required: true, message: '请输入合同编号' }]}>
          <Input placeholder="例如：CONTRACT-2024-001" />
        </FormItem>
        <FormItem label="合同类型" field="contractType" rules={[{ required: true, message: '请选择合同类型' }]}>
          <Select placeholder="选择合同类型">
            {contractTypeOptions.map((e) => <Option key={e.value} value={e.value}>{e.label}</Option>)}
          </Select>
        </FormItem>
        <FormItem label="开始日期" field="startDate" rules={[{ required: true, message: '请选择开始日期' }]}>
          <DatePicker className="lifecycle-page__date-picker-full" />
        </FormItem>
        <FormItem label="结束日期" field="endDate">
          <DatePicker className="lifecycle-page__date-picker-full" />
        </FormItem>
        <FormItem label="状态" field="status">
          <Select>
            <Option value="active">有效</Option>
            <Option value="inactive">无效</Option>
            <Option value="expired">已过期</Option>
            <Option value="terminated">已终止</Option>
          </Select>
        </FormItem>
        <FormItem label="合同文件" field="fileUrl">
          <Input placeholder="合同文件 URL" />
        </FormItem>
      </Form>
    </Modal>
  )
}

function ContractsTab({ employees }: { employees: Employee[] }) {
  const [data, setData] = useState<EmployeeContract[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [contractModal, setContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<EmployeeContract | null>(null)

  const loadData = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await getEmployeeContracts({ page: p, pageSize: 10, ...(s ? { status: s } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: number) => {
    await deleteEmployeeContract(id)
    Message.success('删除成功')
    loadData()
  }

  const columns: TableProps<EmployeeContract>['columns'] = useMemo(() => [
    { title: '员工', render: (_: any, r) => <EmployeeCell record={r} /> },
    { title: '合同编号', dataIndex: 'contractNo', width: 160, ellipsis: true },
    { title: '类型', dataIndex: 'contractType', width: 100 },
    { title: '开始日期', dataIndex: 'startDate', width: 120, render: formatDate },
    { title: '结束日期', dataIndex: 'endDate', width: 120, render: formatDate },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v) => <StatusTag value={v} />,
      filterHeader: (
        <Select placeholder="筛选状态" allowClear className="lifecycle-page__filter-select--100"
          onChange={(v) => { setStatusFilter(v); setPage(1) }}>
          {['active', 'inactive', 'expired', 'terminated'].map((k) => <Option key={k} value={k}>{statusMap[k]?.text}</Option>)}
        </Select>
      ),
    },
    {
      title: '操作', width: 120,
      render: (_: any, record) => (
        <Space>
          <Button size="small" type="text" icon={<IconEdit />}
            onClick={() => { setEditingContract(record); setContractModal(true) }} />
          <Popconfirm title="确定删除？" onOk={() => handleDelete(record.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [loadData])

  return (
    <>
      <div className="lifecycle-page__actions">
        <Button type="primary" icon={<IconPlus />} onClick={() => { setEditingContract(null); setContractModal(true) }}>
          新增合同
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
      <ContractFormModal
        visible={contractModal} editing={editingContract} employees={employees}
        onClose={() => setContractModal(false)} onSuccess={() => { setContractModal(false); loadData() }}
      />
    </>
  )
}

// ===== Main Page =====

export default function LifecyclePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState('events')

  useEffect(() => {
    getEmployees({ page: 1, pageSize: 200, status: 'active' }).then((res) => {
      setEmployees(res?.data?.list || [])
    })
  }, [])

  return (
    <div className="lifecycle-page">
      <Card bordered={false}>
        <div className="lifecycle-page__header">
          <div>
            <span className="lifecycle-page__title">员工生命周期</span>
            <Tag color="arcoblue" className="lifecycle-page__tab-tag">
              入职 · 转正 · 调岗 · 晋升 · 离职 · 文档 · 合同
            </Tag>
          </div>
        </div>

        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="events" title="生命周期事件">
            <EventsTab employees={employees} onRefresh={() => setActiveTab('events')} />
          </TabPane>
          <TabPane key="onboarding" title={`入职任务`}>
            <TasksTab
              employees={employees}
              getTasks={getOnboardingTasks}
              updateTask={updateOnboardingTask}
              deleteTask={deleteOnboardingTask}
              createTask={createOnboardingTask}
              taskType="onboarding"
            />
          </TabPane>
          <TabPane key="offboarding" title={`离职任务`}>
            <TasksTab
              employees={employees}
              getTasks={getOffboardingTasks}
              updateTask={updateOffboardingTask}
              deleteTask={deleteOffboardingTask}
              createTask={createOffboardingTask}
              taskType="offboarding"
            />
          </TabPane>
          <TabPane key="documents" title="员工文档">
            <DocumentsTab employees={employees} />
          </TabPane>
          <TabPane key="contracts" title="劳动合同">
            <ContractsTab employees={employees} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
