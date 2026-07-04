import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './index.module.css'
import {
  Button, Card, DatePicker, Form, Input, InputNumber, Modal,
  Popconfirm, Rate, Select, Space, Table, Tabs, Tag, Typography,
} from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconDelete, IconEdit, IconPlus } from '@arco-design/web-react/icon'
import {
  getRecruitmentRequests, getRecruitmentRequestDetail, createRecruitmentRequest,
  updateRecruitmentRequest, deleteRecruitmentRequest,
  getJobOpenings, getJobOpeningDetail, createJobOpening, updateJobOpening,
  deleteJobOpening,
  getCandidates, getCandidateDetail, createCandidate, updateCandidate,
  deleteCandidate,
  getInterviews, createInterview,
  getOffers, getOfferDetail, createOffer, acceptOffer,
} from '@/api/recruitment'
import { getDepartmentsList, getPositions, type Department, type Position } from '@/api/organization'
import { formatDate } from '@/utils/date'
import { toast } from '@/utils/toast'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const { Text } = Typography

// ===== Types =====

type RecruitmentRequest = {
  id: number
  title: string
  departmentId: number
  positionId?: number
  headcount: number
  reason?: string
  priority: string
  status: string
  department?: { name: string }
  position?: { name: string }
  creator?: { realName: string }
  createdAt?: string
}

type JobOpening = {
  id: number
  title: string
  departmentId: number
  positionId?: number
  headcount: number
  description?: string
  requirements?: string
  status: string
  publishedAt?: string
  department?: { name: string }
  position?: { name: string }
  creator?: { realName: string }
  _count?: { candidates: number }
}

type Candidate = {
  id: number
  name: string
  phone?: string
  email?: string
  source?: string
  resumeUrl?: string
  status: string
  rating?: number
  note?: string
  jobOpening?: any
  interviews?: any[]
  offers?: any[]
  _count?: { interviews: number; offers: number }
}

type InterviewRecord = {
  id: number
  candidateId: number
  roundName?: string
  interviewAt?: string
  result?: string
  feedback?: string
  candidate?: { id: number; name: string; phone?: string; jobOpening?: { title: string } }
  interviewer?: { realName: string }
  createdAt?: string
}

type OfferRecord = {
  id: number
  offerNo: string
  salary?: number
  startDate?: string
  status: string
  acceptedAt?: string
  candidate?: { id: number; name: string; phone?: string; jobOpening?: { title: string } }
  createdAt?: string
}

// ===== Constants =====

const requestStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  submitted: { text: '已提交', color: 'blue' },
  approved: { text: '已批准', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  closed: { text: '已关闭', color: 'gray' },
}

const openingStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  open: { text: '招聘中', color: 'green' },
  paused: { text: '暂停', color: 'orange' },
  closed: { text: '已关闭', color: 'gray' },
}

const candidateStatusMap: Record<string, { text: string; color: string }> = {
  new: { text: '新候选', color: 'blue' },
  screening: { text: '筛选中', color: 'cyan' },
  interviewing: { text: '面试中', color: 'orange' },
  offered: { text: '已发Offer', color: 'purple' },
  hired: { text: '已录用', color: 'green' },
  rejected: { text: '已淘汰', color: 'red' },
}

const interviewResultMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待反馈', color: 'orange' },
  passed: { text: '通过', color: 'green' },
  failed: { text: '未通过', color: 'red' },
  cancelled: { text: '已取消', color: 'gray' },
}

const offerStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  sent: { text: '已发送', color: 'blue' },
  accepted: { text: '已接受', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  cancelled: { text: '已取消', color: 'gray' },
}

const priorityMap: Record<string, { text: string; color: string }> = {
  low: { text: '低', color: 'gray' },
  medium: { text: '中', color: 'blue' },
  high: { text: '高', color: 'orange' },
  urgent: { text: '紧急', color: 'red' },
}

function StatusTag({ value, map }: { value: string; map: Record<string, { text: string; color: string }> }) {
  const info = map[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

// ===== Shared Components =====

function DetailModal({ title, visible, data, onClose, renderContent }: {
  title: string
  visible: boolean
  data: any
  onClose: () => void
  renderContent: (data: any) => React.ReactNode
}) {
  return (
    <Modal focusLock title={title} visible={visible} onOk={onClose} onCancel={onClose} footer={null} className={styles['recruitment-overview__modal--lg']}>
      {data ? renderContent(data) : <div className={styles['recruitment-overview__empty']}>未找到数据</div>}
    </Modal>
  )
}

function FormModal({
  title, visible, form, onOk, onCancel, children,
}: {
  title: string
  visible: boolean
  form: ReturnType<typeof Form.useForm>[0]
  onOk: () => void
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <Modal focusLock title={title} visible={visible} onOk={onOk} onCancel={onCancel} className={styles['recruitment-overview__modal--lg']}>
      <Form form={form} layout="vertical">{children}</Form>
    </Modal>
  )
}

// ===== Requests Tab =====

function RequestsTab({ departments, positions }: { departments: any[]; positions: any[] }) {
  const [data, setData] = useState<RecruitmentRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editing, setEditing] = useState<RecruitmentRequest | null>(null)
  const [detailData, setDetailData] = useState<RecruitmentRequest | null>(null)
  const [form] = Form.useForm()
  const [_submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await getRecruitmentRequests({ page: p, pageSize: 10, ...(s ? { status: s } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const openModal = (record?: RecruitmentRequest) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        title: record.title, departmentId: record.departmentId, positionId: record.positionId,
        headcount: record.headcount, reason: record.reason, priority: record.priority, status: record.status,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'draft', priority: 'medium', headcount: 1 })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      if (editing) {
        await updateRecruitmentRequest(editing.id, values)
        toast.success('更新成功')
      } else {
        await createRecruitmentRequest(values)
        toast.success('创建成功')
      }
      setModalVisible(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    await deleteRecruitmentRequest(id)
    toast.success('删除成功')
    load()
  }

  const openDetail = async (id: number) => {
    const res = await getRecruitmentRequestDetail(id)
    setDetailData(res?.data || null)
    setDetailVisible(true)
  }

  const columns: TableProps<RecruitmentRequest>['columns'] = useMemo(() => [
    { title: '需求标题', dataIndex: 'title', ellipsis: true },
    { title: '部门', width: 120, render: (_: any, r) => r.department?.name || '-' },
    { title: '岗位', width: 120, render: (_: any, r) => r.position?.name || '-' },
    { title: '人数', dataIndex: 'headcount', width: 70 },
    { title: '优先级', dataIndex: 'priority', width: 80, render: (v) => <StatusTag value={v} map={priorityMap} /> },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} map={requestStatusMap} /> },
    { title: '申请人', dataIndex: 'creator', width: 90, render: (_: any, r) => r.creator?.realName || '-' },
    {
      title: '操作', width: 130,
      render: (_: any, r) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDetail(r.id)}>详情</Button>
          <Button size="small" type="text" icon={<IconEdit />} onClick={() => openModal(r)} />
          <Popconfirm title="确定删除？" onOk={() => handleDelete(r.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [load])

  return (
    <>
      <div className={styles['recruitment-overview__filter']}>
        <Space>
          <Select placeholder="状态筛选" allowClear className={styles['recruitment-overview__filter-select--sm']}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}>
            {Object.entries(requestStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新增需求</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />

      <FormModal title={editing ? '编辑招聘需求' : '新增招聘需求'} visible={modalVisible} form={form}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <FormItem label="需求标题" field="title" rules={[{ required: true, message: '请输入' }]}>
          <Input placeholder="如：前端工程师招聘需求" />
        </FormItem>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="部门" field="departmentId" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="选择部门">
              {departments.map((d) => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="岗位" field="positionId">
            <Select placeholder="选择岗位" allowClear>
              {positions.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </FormItem>
        </div>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="招聘人数" field="headcount" rules={[{ required: true, message: '请输入' }]}>
            <InputNumber min={1} max={999} className={styles['recruitment-overview__input-full']} />
          </FormItem>
          <FormItem label="优先级" field="priority">
            <Select>
              {Object.entries(priorityMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
            </Select>
          </FormItem>
        </div>
        <FormItem label="状态" field="status">
          <Select>{Object.entries(requestStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}</Select>
        </FormItem>
        <FormItem label="申请原因" field="reason">
          <Input.TextArea rows={2} placeholder="补充说明" />
        </FormItem>
      </FormModal>

      <DetailModal title="需求详情" visible={detailVisible} data={detailData} onClose={() => setDetailVisible(false)} renderContent={(d) => (
        <div className={styles['recruitment-overview__form-grid--detail']}>
          <div><Text type="secondary">需求标题</Text><div>{d.title}</div></div>
          <div><Text type="secondary">部门</Text><div>{d.department?.name}</div></div>
          <div><Text type="secondary">岗位</Text><div>{d.position?.name || '-'}</div></div>
          <div><Text type="secondary">招聘人数</Text><div>{d.headcount}</div></div>
          <div><Text type="secondary">优先级</Text><div><StatusTag value={d.priority} map={priorityMap} /></div></div>
          <div><Text type="secondary">状态</Text><div><StatusTag value={d.status} map={requestStatusMap} /></div></div>
          <div className={styles['recruitment-overview__form-grid-full']}><Text type="secondary">申请原因</Text><div>{d.reason || '-'}</div></div>
          <div><Text type="secondary">申请人</Text><div>{d.creator?.realName || '-'}</div></div>
          <div><Text type="secondary">创建时间</Text><div>{d.createdAt ? formatDate(d.createdAt) : '-'}</div></div>
        </div>
      )} />
    </>
  )
}

// ===== Openings Tab =====

function OpeningsTab({ departments, positions }: { departments: any[]; positions: any[] }) {
  const [data, setData] = useState<JobOpening[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editing, setEditing] = useState<JobOpening | null>(null)
  const [detailData, setDetailData] = useState<JobOpening | null>(null)
  const [form] = Form.useForm()
  const [_submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await getJobOpenings({ page: p, pageSize: 10, ...(s ? { status: s } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const openModal = (record?: JobOpening) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        title: record.title, departmentId: record.departmentId, positionId: record.positionId,
        headcount: record.headcount, description: record.description, requirements: record.requirements, status: record.status,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'open', headcount: 1 })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      if (editing) {
        await updateJobOpening(editing.id, values)
        toast.success('更新成功')
      } else {
        await createJobOpening(values)
        toast.success('创建成功')
      }
      setModalVisible(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    await deleteJobOpening(id)
    toast.success('删除成功')
    load()
  }

  const openDetail = async (id: number) => {
    const res = await getJobOpeningDetail(id)
    setDetailData(res?.data || null)
    setDetailVisible(true)
  }

  const columns: TableProps<JobOpening>['columns'] = useMemo(() => [
    { title: '职位名称', dataIndex: 'title', ellipsis: true },
    { title: '部门', width: 120, render: (_: any, r) => r.department?.name || '-' },
    { title: '岗位', width: 120, render: (_: any, r) => r.position?.name || '-' },
    { title: '人数', dataIndex: 'headcount', width: 70 },
    { title: '候选人', width: 80, render: (_: any, r) => r._count?.candidates || 0 },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} map={openingStatusMap} /> },
    {
      title: '操作', width: 130,
      render: (_: any, r) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDetail(r.id)}>详情</Button>
          <Button size="small" type="text" icon={<IconEdit />} onClick={() => openModal(r)} />
          <Popconfirm title="确定删除？" onOk={() => handleDelete(r.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [load])

  return (
    <>
      <div className={styles['recruitment-overview__filter']}>
        <Space>
          <Select placeholder="状态筛选" allowClear className={styles['recruitment-overview__filter-select--sm']}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}>
            {Object.entries(openingStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新增职位</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />

      <FormModal title={editing ? '编辑招聘职位' : '新增招聘职位'} visible={modalVisible} form={form}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <FormItem label="职位名称" field="title" rules={[{ required: true, message: '请输入' }]}>
          <Input placeholder="如：高级前端工程师" />
        </FormItem>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="部门" field="departmentId" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="选择部门">
              {departments.map((d) => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="岗位" field="positionId">
            <Select placeholder="选择岗位" allowClear>
              {positions.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </FormItem>
        </div>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="招聘人数" field="headcount">
            <InputNumber min={1} max={999} className={styles['recruitment-overview__input-full']} />
          </FormItem>
          <FormItem label="状态" field="status">
            <Select>{Object.entries(openingStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}</Select>
          </FormItem>
        </div>
        <FormItem label="职位描述" field="description">
          <Input.TextArea rows={3} />
        </FormItem>
        <FormItem label="任职要求" field="requirements">
          <Input.TextArea rows={3} />
        </FormItem>
      </FormModal>

      <DetailModal title="职位详情" visible={detailVisible} data={detailData} onClose={() => setDetailVisible(false)} renderContent={(d) => (
        <div className={styles['recruitment-overview__form-grid--detail']}>
          <div className={styles['recruitment-overview__form-grid-full']}><Text type="secondary">职位名称</Text><div className={styles['recruitment-overview__title']}>{d.title}</div></div>
          <div><Text type="secondary">部门</Text><div>{d.department?.name}</div></div>
          <div><Text type="secondary">岗位</Text><div>{d.position?.name || '-'}</div></div>
          <div><Text type="secondary">招聘人数</Text><div>{d.headcount}</div></div>
          <div><Text type="secondary">状态</Text><div><StatusTag value={d.status} map={openingStatusMap} /></div></div>
          <div className={styles['recruitment-overview__form-grid-full']}><Text type="secondary">职位描述</Text><div>{d.description || '-'}</div></div>
          <div className={styles['recruitment-overview__form-grid-full']}><Text type="secondary">任职要求</Text><div>{d.requirements || '-'}</div></div>
          <div><Text type="secondary">发布人</Text><div>{d.creator?.realName || '-'}</div></div>
          <div><Text type="secondary">发布时间</Text><div>{d.publishedAt ? formatDate(d.publishedAt) : '-'}</div></div>
        </div>
      )} />
    </>
  )
}

// ===== Candidates Tab =====

function CandidatesTab({ openings }: { openings: JobOpening[] }) {
  const [data, setData] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [openingFilter, setOpeningFilter] = useState<string | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [detailData, setDetailData] = useState<Candidate | null>(null)
  const [form] = Form.useForm()
  const [_submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, s = statusFilter, o = openingFilter) => {
    setLoading(true)
    try {
      const res = await getCandidates({ page: p, pageSize: 10, ...(s ? { status: s } : {}), ...(o ? { jobOpeningId: o } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, statusFilter, openingFilter])

  useEffect(() => { load() }, [load])

  const openModal = (record?: Candidate) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        jobOpeningId: record.jobOpening?.id, name: record.name, phone: record.phone,
        email: record.email, source: record.source, status: record.status, rating: record.rating, note: record.note,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'new', rating: 0 })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      if (editing) {
        await updateCandidate(editing.id, values)
        toast.success('更新成功')
      } else {
        await createCandidate(values)
        toast.success('创建成功')
      }
      setModalVisible(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    await deleteCandidate(id)
    toast.success('删除成功')
    load()
  }

  const openDetail = async (id: number) => {
    const res = await getCandidateDetail(id)
    setDetailData(res?.data || null)
    setDetailVisible(true)
  }

  const columns: TableProps<Candidate>['columns'] = useMemo(() => [
    { title: '姓名', dataIndex: 'name', width: 110 },
    { title: '应聘职位', render: (_: any, r) => r.jobOpening?.title || '-' },
    { title: '手机', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    { title: '评分', dataIndex: 'rating', width: 100, render: (v: number) => <Rate readonly value={v} className={styles['recruitment-overview__rate']} /> },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => <StatusTag value={v} map={candidateStatusMap} /> },
    { title: '面试', width: 70, render: (_: any, r) => r._count?.interviews || 0 },
    { title: 'Offer', width: 70, render: (_: any, r) => r._count?.offers || 0 },
    {
      title: '操作', width: 130,
      render: (_: any, r) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDetail(r.id)}>详情</Button>
          <Button size="small" type="text" icon={<IconEdit />} onClick={() => openModal(r)} />
          <Popconfirm title="确定删除？" onOk={() => handleDelete(r.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [load])

  return (
    <>
      <div className={styles['recruitment-overview__filter']}>
        <Space>
          <Select placeholder="筛选职位" allowClear className={styles['recruitment-overview__filter-select']}
            onChange={(v) => { setOpeningFilter(v); setPage(1) }}>
            {openings.map((o) => <Option key={o.id} value={o.id}>{o.title}</Option>)}
          </Select>
          <Select placeholder="筛选状态" allowClear className={styles['recruitment-overview__filter-select--sm']}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}>
            {Object.entries(candidateStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新增候选人</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />

      <FormModal title={editing ? '编辑候选人' : '新增候选人'} visible={modalVisible} form={form}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <FormItem label="应聘职位" field="jobOpeningId" rules={[{ required: true, message: '请选择' }]}>
          <Select placeholder="选择招聘职位">
            {openings.map((o) => <Option key={o.id} value={o.id}>{o.title} - {o.department?.name || ''}</Option>)}
          </Select>
        </FormItem>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="姓名" field="name" rules={[{ required: true, message: '请输入' }]}>
            <Input />
          </FormItem>
          <FormItem label="手机" field="phone">
            <Input />
          </FormItem>
        </div>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="邮箱" field="email">
            <Input />
          </FormItem>
          <FormItem label="来源" field="source">
            <Input placeholder="如：BOSS直聘、内推" />
          </FormItem>
        </div>
        <div className={styles['recruitment-overview__form-grid']}>
          <FormItem label="评分" field="rating">
            <Rate />
          </FormItem>
          <FormItem label="状态" field="status">
            <Select>{Object.entries(candidateStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}</Select>
          </FormItem>
        </div>
        <FormItem label="备注" field="note">
          <Input.TextArea rows={2} />
        </FormItem>
      </FormModal>

      <DetailModal title="候选人详情" visible={detailVisible} data={detailData} onClose={() => setDetailVisible(false)} renderContent={(d) => (
        <div className={styles['recruitment-overview__form-grid--detail']}>
          <div><Text type="secondary">姓名</Text><div>{d.name}</div></div>
          <div><Text type="secondary">应聘职位</Text><div>{d.jobOpening?.title} - {d.jobOpening?.department?.name}</div></div>
          <div><Text type="secondary">手机</Text><div>{d.phone || '-'}</div></div>
          <div><Text type="secondary">邮箱</Text><div>{d.email || '-'}</div></div>
          <div><Text type="secondary">来源</Text><div>{d.source || '-'}</div></div>
          <div><Text type="secondary">评分</Text><div><Rate readonly value={d.rating} className={styles['recruitment-overview__rate']} /></div></div>
          <div><Text type="secondary">状态</Text><div><StatusTag value={d.status} map={candidateStatusMap} /></div></div>
          <div><Text type="secondary">面试次数</Text><div>{d.interviews?.length || 0}</div></div>
          <div className={styles['recruitment-overview__form-grid-full']}><Text type="secondary">备注</Text><div>{d.note || '-'}</div></div>
          {d.interviews && d.interviews.length > 0 && (
            <div className={styles['recruitment-overview__form-grid-full']}>
              <Text type="secondary" className={styles['recruitment-overview__text-block']}>面试记录</Text>
              {d.interviews.map((i: any, idx: number) => (
                <div key={i.id} className={styles['recruitment-overview__interview-item']}>
                  <Space><Text type="secondary">第{idx + 1}轮</Text>{i.roundName}<StatusTag value={i.result} map={interviewResultMap} /></Space>
                  <div className={styles['recruitment-overview__interview-feedback']}>{i.feedback || '无反馈'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )} />
    </>
  )
}

// ===== Interviews Tab =====

function InterviewsTab({ openings }: { openings: JobOpening[] }) {
  const [data, setData] = useState<InterviewRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [openingFilter, setOpeningFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [_submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, o = openingFilter, s = statusFilter) => {
    setLoading(true)
    try {
      const res = await getInterviews({ page: p, pageSize: 10, ...(o ? { jobOpeningId: o } : {}), ...(s ? { status: s } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, openingFilter, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getCandidates({ page: 1, pageSize: 200 }).then((res: any) => {
      setCandidates(res?.data?.list || [])
    })
  }, [])

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      await createInterview(values)
      toast.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      load()
    } finally { setSubmitting(false) }
  }

  const columns: TableProps<InterviewRecord>['columns'] = useMemo(() => [
    { title: '候选人', width: 110, render: (_: any, r) => r.candidate?.name || '-' },
    { title: '应聘职位', render: (_: any, r) => r.candidate?.jobOpening?.title || '-' },
    { title: '面试轮次', dataIndex: 'roundName', width: 110 },
    { title: '面试时间', dataIndex: 'interviewAt', width: 120, render: (v: string) => v ? formatDate(v) : '-' },
    { title: '面试官', dataIndex: 'interviewer', width: 90, render: (_: any, r) => r.interviewer?.realName || '-' },
    { title: '结果', dataIndex: 'result', width: 90, render: (v) => <StatusTag value={v} map={interviewResultMap} /> },
    { title: '反馈', dataIndex: 'feedback', ellipsis: true },
  ], [])

  return (
    <>
      <div className={styles['recruitment-overview__filter']}>
        <Space>
          <Select placeholder="筛选职位" allowClear className={styles['recruitment-overview__filter-select']}
            onChange={(v) => { setOpeningFilter(v); setPage(1) }}>
            {openings.map((o) => <Option key={o.id} value={o.id}>{o.title}</Option>)}
          </Select>
          <Select placeholder="筛选结果" allowClear className={styles['recruitment-overview__filter-select--sm']}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}>
            {Object.entries(interviewResultMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => { form.resetFields(); setModalVisible(true) }}>
            记录面试
          </Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />

      <FormModal title="记录面试" visible={modalVisible} form={form}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <FormItem label="候选人" field="candidateId" rules={[{ required: true, message: '请选择' }]}>
          <Select placeholder="选择候选人" showSearch>
            {candidates.map((c) => <Option key={c.id} value={c.id}>{c.name} - {c.jobOpening?.title}</Option>)}
          </Select>
        </FormItem>
        <FormItem label="面试轮次" field="roundName" rules={[{ required: true, message: '请输入' }]}>
          <Input placeholder="如：第一轮技术面试" />
        </FormItem>
        <FormItem label="面试时间" field="interviewAt">
          <DatePicker className={styles['recruitment-overview__input-full']} />
        </FormItem>
        <FormItem label="面试官" field="interviewerId">
          <Select placeholder="选择面试官" allowClear showSearch>
            {candidates.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
        </FormItem>
        <FormItem label="结果" field="result">
          <Select>{Object.entries(interviewResultMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}</Select>
        </FormItem>
        <FormItem label="反馈" field="feedback">
          <Input.TextArea rows={3} placeholder="面试反馈和建议" />
        </FormItem>
      </FormModal>
    </>
  )
}

// ===== Offers Tab =====

function OffersTab({ openings }: { openings: JobOpening[] }) {
  const [data, setData] = useState<OfferRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [openingFilter, setOpeningFilter] = useState<string | undefined>()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailData, setDetailData] = useState<OfferRecord | null>(null)
  const [form] = Form.useForm()
  const [_submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, s = statusFilter, o = openingFilter) => {
    setLoading(true)
    try {
      const res = await getOffers({ page: p, pageSize: 10, ...(s ? { status: s } : {}), ...(o ? { jobOpeningId: Number(o) } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, statusFilter, openingFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getCandidates({ page: 1, pageSize: 200, status: 'offered' }).then((res: any) => {
      setCandidates(res?.data?.list || [])
    })
  }, [])

  const handleSubmit = async () => {
    const values = await form.validate()
    const data = {
      ...values,
      startDate: values.startDate ? formatDate(values.startDate) : values.startDate,
    }
    setSubmitting(true)
    try {
      await createOffer(data)
      toast.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      load()
    } finally { setSubmitting(false) }
  }

  const handleAccept = async (id: number) => {
    await acceptOffer(id)
    toast.success('Offer 已接受')
    load()
  }

  const openDetail = async (id: number) => {
    const res = await getOfferDetail(id)
    setDetailData(res?.data || null)
    setDetailVisible(true)
  }

  const columns: TableProps<OfferRecord>['columns'] = useMemo(() => [
    { title: 'Offer编号', dataIndex: 'offerNo', width: 160 },
    { title: '候选人', width: 110, render: (_: any, r) => r.candidate?.name || '-' },
    { title: '应聘职位', render: (_: any, r) => r.candidate?.jobOpening?.title || '-' },
    { title: '薪资', dataIndex: 'salary', width: 110, render: (v: number) => v ? `¥${v.toLocaleString()}` : '-' },
    { title: '入职日期', dataIndex: 'startDate', width: 120, render: (v: string) => v ? formatDate(v) : '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} map={offerStatusMap} /> },
    {
      title: '操作', width: 160,
      render: (_: any, r) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDetail(r.id)}>详情</Button>
          {r.status === 'sent' && (
            <Button size="small" type="text" onClick={() => handleAccept(r.id)}>接受</Button>
          )}
        </Space>
      ),
    },
  ], [])

  return (
    <>
      <div className={styles['recruitment-overview__filter']}>
        <Space>
          <Select placeholder="筛选职位" allowClear className={styles['recruitment-overview__filter-select']}
            onChange={(v) => { setOpeningFilter(v); setPage(1) }}>
            {openings.map((o) => <Option key={o.id} value={o.id}>{o.title}</Option>)}
          </Select>
          <Select placeholder="筛选状态" allowClear className={styles['recruitment-overview__filter-select--sm']}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}>
            {Object.entries(offerStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => { form.resetFields(); form.setFieldsValue({ status: 'draft' }); setModalVisible(true) }}>
            发起Offer
          </Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />

      <FormModal title="发起Offer" visible={modalVisible} form={form}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)}>
        <FormItem label="候选人" field="candidateId" rules={[{ required: true, message: '请选择' }]}>
          <Select placeholder="选择候选人" showSearch>
            {candidates.map((c) => <Option key={c.id} value={c.id}>{c.name} - {c.jobOpening?.title}</Option>)}
          </Select>
        </FormItem>
        <FormItem label="薪资" field="salary">
          <InputNumber min={0} max={99999999} className={styles['recruitment-overview__input-full']} prefix="¥" placeholder="月薪" />
        </FormItem>
        <FormItem label="入职日期" field="startDate">
          <DatePicker className={styles['recruitment-overview__input-full']} />
        </FormItem>
        <FormItem label="状态" field="status">
          <Select>{Object.entries(offerStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}</Select>
        </FormItem>
      </FormModal>

      <DetailModal title="Offer详情" visible={detailVisible} data={detailData} onClose={() => setDetailVisible(false)} renderContent={(d) => (
        <div className={styles['recruitment-overview__form-grid--detail']}>
          <div><Text type="secondary">Offer编号</Text><div>{d.offerNo}</div></div>
          <div><Text type="secondary">状态</Text><div><StatusTag value={d.status} map={offerStatusMap} /></div></div>
          <div><Text type="secondary">候选人</Text><div>{d.candidate?.name}</div></div>
          <div><Text type="secondary">应聘职位</Text><div>{d.candidate?.jobOpening?.title}</div></div>
          <div><Text type="secondary">薪资</Text><div>{d.salary ? `¥${d.salary.toLocaleString()}` : '-'}</div></div>
          <div><Text type="secondary">入职日期</Text><div>{d.startDate ? formatDate(d.startDate) : '-'}</div></div>
          <div><Text type="secondary">接受时间</Text><div>{d.acceptedAt ? formatDate(d.acceptedAt) : '-'}</div></div>
        </div>
      )} />
    </>
  )
}

// ===== Main Page =====

export default function RecruitmentPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [activeTab, setActiveTab] = useState('requests')

  useEffect(() => {
    Promise.all([
      getDepartmentsList(),
      getPositions({ page: 1, pageSize: 200 }),
      getJobOpenings({ page: 1, pageSize: 200 }),
    ]).then(([depRes, posRes, openRes]: any[]) => {
      setDepartments(depRes?.data || [])
      setPositions(posRes?.data?.list || [])
      setOpenings(openRes?.data?.list || [])
    })
  }, [])

  return (
    <div className={styles['recruitment-overview']}>
      <Card bordered={false}>
        <div className={styles['recruitment-overview__header']}>
          <span className={styles['recruitment-overview__title']}>招聘管理</span>
          <Tag color="arcoblue" className={styles['recruitment-overview__tag']}>
            招聘需求 · 职位 · 候选人 · 面试 · Offer
          </Tag>
        </div>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="requests" title="招聘需求">
            <RequestsTab departments={departments} positions={positions} />
          </TabPane>
          <TabPane key="openings" title="招聘职位">
            <OpeningsTab departments={departments} positions={positions} />
          </TabPane>
          <TabPane key="candidates" title="候选人">
            <CandidatesTab openings={openings} />
          </TabPane>
          <TabPane key="interviews" title="面试记录">
            <InterviewsTab openings={openings} />
          </TabPane>
          <TabPane key="offers" title="Offer管理">
            <OffersTab openings={openings} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
