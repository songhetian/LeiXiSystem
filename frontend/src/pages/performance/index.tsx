import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, Card, DatePicker, Form, Input, InputNumber, Message, Modal,
  Popconfirm, Progress, Select, Space, Table, Tabs, Tag,
} from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconDelete, IconEdit, IconPlus } from '@arco-design/web-react/icon'
import {
  getPerformanceCycles, createPerformanceCycle, updatePerformanceCycle, deletePerformanceCycle,
  getPerformanceGoals, createPerformanceGoal, updatePerformanceGoal, deletePerformanceGoal,
  getPerformanceReviews, createPerformanceReview, updatePerformanceReview,
} from '@/api/performance'
import { getEmployees, type Employee } from '@/api/personnel'
import styles from './performance.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

type Cycle = {
  id: number
  name: string
  cycleType: string
  startDate: string
  endDate: string
  status: string
  _count?: { goals: number; reviews: number }
}

type Goal = {
  id: number
  title: string
  description?: string
  metric?: string
  targetValue?: number
  weight: number
  progress: number
  status: string
  cycle?: { id: number; name: string }
  employee?: { id: number; user?: { realName: string }; employeeNo: string }
}

type Review = {
  id: number
  selfScore?: number
  managerScore?: number
  finalScore?: number
  rating?: string
  status: string
  selfComment?: string
  managerComment?: string
  cycle?: any
  employee?: any
  reviewer?: any
}

const cycleTypeMap: Record<string, string> = {
  month: '月度', quarter: '季度', half_year: '半年度', year: '年度',
}

const cycleStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  active: { text: '进行中', color: 'green' },
  closed: { text: '已结束', color: 'blue' },
}

const goalStatusMap: Record<string, { text: string; color: string }> = {
  active: { text: '进行中', color: 'blue' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'gray' },
}

const reviewStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  self_submitted: { text: '已自评', color: 'blue' },
  reviewed: { text: '已评审', color: 'green' },
  confirmed: { text: '已确认', color: 'arcoblue' },
}

const ratingMap: Record<string, { text: string; color: string }> = {
  A: { text: 'A (卓越)', color: 'green' },
  B: { text: 'B (优秀)', color: 'blue' },
  C: { text: 'C (良好)', color: 'cyan' },
  D: { text: 'D (需改进)', color: 'orange' },
  E: { text: 'E (不合格)', color: 'red' },
}

function StatusTag({ value, map }: { value: string; map: Record<string, { text: string; color: string }> }) {
  const info = map[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function ScoreBar({ score }: { score?: number | null }) {
  if (score == null) return <span>-</span>
  const color = score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'
  return <Progress percent={score} showText={false} size="small" color={color} className={styles['performance__score-bar']} />
}

// ===== Cycles Tab =====

function CyclesTab() {
  const [data, setData] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Cycle | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPerformanceCycles({ page: 1, pageSize: 100 })
      setData(res?.data?.list || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openModal = (record?: Cycle) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        name: record.name, cycleType: record.cycleType,
        startDate: new Date(record.startDate), endDate: new Date(record.endDate), status: record.status,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ cycleType: 'quarter', status: 'draft' })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    const data = {
      ...values,
      startDate: values.startDate instanceof Date ? values.startDate.toISOString().split('T')[0] : values.startDate,
      endDate: values.endDate instanceof Date ? values.endDate.toISOString().split('T')[0] : values.endDate,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updatePerformanceCycle(editing.id, data)
        Message.success('更新成功')
      } else {
        await createPerformanceCycle(data)
        Message.success('创建成功')
      }
      setModalVisible(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    await deletePerformanceCycle(id)
    Message.success('删除成功')
    load()
  }

  const columns: TableProps<Cycle>['columns'] = useMemo(() => [
    { title: '周期名称', dataIndex: 'name', ellipsis: true },
    { title: '周期类型', dataIndex: 'cycleType', width: 90, render: (v) => cycleTypeMap[v] || v },
    { title: '开始日期', dataIndex: 'startDate', width: 120, render: (v) => new Date(v).toLocaleDateString() },
    { title: '结束日期', dataIndex: 'endDate', width: 120, render: (v) => new Date(v).toLocaleDateString() },
    { title: '目标数', dataIndex: '_count', width: 80, render: (_: any, r) => r._count?.goals || 0 },
    { title: '评审数', dataIndex: '_count', width: 80, render: (_: any, r) => r._count?.reviews || 0 },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} map={cycleStatusMap} /> },
    {
      title: '操作', width: 120,
      render: (_: any, r) => (
        <Space>
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
      <div className={styles['performance__actions-bar']}>
        <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新建周期</Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data} pagination={false} />
      <Modal focusLock title={editing ? '编辑绩效周期' : '新建绩效周期'} visible={modalVisible}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)} confirmLoading={submitting}>
        <Form form={form} layout="vertical">
          <FormItem label="周期名称" field="name" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：2024年Q1绩效" />
          </FormItem>
          <div className={styles['performance__form-grid']}>
            <FormItem label="周期类型" field="cycleType">
              <Select>
                {Object.entries(cycleTypeMap).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
              </Select>
            </FormItem>
            <FormItem label="状态" field="status">
              <Select>
                {Object.entries(cycleStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
              </Select>
            </FormItem>
          </div>
          <div className={styles['performance__form-grid']}>
            <FormItem label="开始日期" field="startDate" rules={[{ required: true, message: '请选择' }]}>
              <DatePicker className={styles['performance__form-item']} />
            </FormItem>
            <FormItem label="结束日期" field="endDate" rules={[{ required: true, message: '请选择' }]}>
              <DatePicker className={styles['performance__form-item']} />
            </FormItem>
          </div>
        </Form>
      </Modal>
    </>
  )
}

// ===== Goals Tab =====

function GoalsTab() {
  const [data, setData] = useState<Goal[]>([])
  const [loading, setLoading] = useState(false)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, string | number | undefined>>({})
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true)
    try {
      const res = await getPerformanceGoals({ page: p, pageSize: 10, ...f })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getPerformanceCycles({ page: 1, pageSize: 100 }).then((res: any) => setCycles(res?.data?.list || []))
    getEmployees({ page: 1, pageSize: 200 }).then((res: any) => setEmployees(res?.data?.list || []))
  }, [])

  const handleFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const openModal = (record?: Goal) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        cycleId: record.cycle?.id, employeeId: record.employee?.id,
        title: record.title, description: record.description, metric: record.metric,
        targetValue: record.targetValue, weight: record.weight, progress: record.progress, status: record.status,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'active' })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      if (editing) {
        await updatePerformanceGoal(editing.id, values)
        Message.success('更新成功')
      } else {
        await createPerformanceGoal(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    await deletePerformanceGoal(id)
    Message.success('删除成功')
    load()
  }

  const columns: TableProps<Goal>['columns'] = useMemo(() => [
    { title: '周期', width: 120, render: (_: any, r) => r.cycle?.name || '-' },
    { title: '员工', width: 100, render: (_: any, r) => r.employee?.user?.realName || '-' },
    { title: '目标标题', dataIndex: 'title', ellipsis: true },
    { title: '权重(%)', dataIndex: 'weight', width: 90, render: (v: number) => `${v}%` },
    {
      title: '进度(%)', dataIndex: 'progress', width: 120,
      render: (v: number) => <Progress percent={v} showText={false} size="small" className={styles['performance__score-bar']} />,
    },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} map={goalStatusMap} /> },
    {
      title: '操作', width: 120,
      render: (_: any, r) => (
        <Space>
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
      <div className={styles['performance__actions-bar']}>
        <Space>
          <Select placeholder="绩效周期" allowClear className={styles.performance__select}
            onChange={(v) => handleFilter('cycleId', v)}>
            {cycles.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select placeholder="状态" allowClear className={styles['performance__select--sm']}
            onChange={(v) => handleFilter('status', v)}>
            {Object.entries(goalStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新建目标</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
      <Modal focusLock title={editing ? '编辑绩效目标' : '新建绩效目标'} visible={modalVisible}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)} confirmLoading={submitting}>
        <Form form={form} layout="vertical">
          <div className={styles['performance__form-grid']}>
            <FormItem label="绩效周期" field="cycleId" rules={[{ required: true, message: '请选择' }]}>
              <Select placeholder="选择周期">
                {cycles.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </FormItem>
            <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择' }]}>
              <Select placeholder="选择员工" showSearch>
                {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
              </Select>
            </FormItem>
          </div>
          <FormItem label="目标标题" field="title" rules={[{ required: true, message: '请输入' }]}>
            <Input />
          </FormItem>
          <FormItem label="目标描述" field="description">
            <Input.TextArea rows={2} />
          </FormItem>
          <FormItem label="衡量指标" field="metric">
            <Input placeholder="如：GMV、用户增长率" />
          </FormItem>
          <div className={styles['performance__form-grid--triple']}>
            <FormItem label="目标值" field="targetValue">
              <InputNumber min={0} className={styles['performance__form-item']} />
            </FormItem>
            <FormItem label="权重(%)" field="weight">
              <InputNumber min={0} max={100} className={styles['performance__form-item']} />
            </FormItem>
            <FormItem label="当前进度(%)" field="progress">
              <InputNumber min={0} max={100} className={styles['performance__form-item']} />
            </FormItem>
          </div>
          <FormItem label="状态" field="status">
            <Select>
              {Object.entries(goalStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </>
  )
}

// ===== Reviews Tab =====

function ReviewsTab() {
  const [data, setData] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, string | number | undefined>>({})
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Review | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true)
    try {
      const res = await getPerformanceReviews({ page: p, pageSize: 10, ...f })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getPerformanceCycles({ page: 1, pageSize: 100 }).then((res: any) => setCycles(res?.data?.list || []))
    getEmployees({ page: 1, pageSize: 200 }).then((res: any) => setEmployees(res?.data?.list || []))
  }, [])

  const handleFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const openModal = (record?: Review) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        cycleId: record.cycle?.id, employeeId: record.employee?.id,
        selfScore: record.selfScore, managerScore: record.managerScore, finalScore: record.finalScore,
        rating: record.rating, selfComment: record.selfComment, managerComment: record.managerComment, status: record.status,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'draft' })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      if (editing) {
        await updatePerformanceReview(editing.id, values)
        Message.success('更新成功')
      } else {
        await createPerformanceReview(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      load()
    } finally { setSubmitting(false) }
  }

  const columns: TableProps<Review>['columns'] = useMemo(() => [
    { title: '周期', width: 120, render: (_: any, r) => r.cycle?.name || '-' },
    { title: '员工', width: 100, render: (_: any, r) => r.employee?.user?.realName || '-' },
    { title: '自评', dataIndex: 'selfScore', width: 90, render: (v: number) => v != null ? `${v}分` : '-' },
    { title: '上级评分', dataIndex: 'managerScore', width: 100, render: (v: number) => v != null ? `${v}分` : '-' },
    { title: '最终分', dataIndex: 'finalScore', width: 100, render: (v: number) => v != null ? <ScoreBar score={v} /> : '-' },
    { title: '等级', dataIndex: 'rating', width: 90, render: (v) => v ? <StatusTag value={v} map={ratingMap} /> : '-' },
    { title: '评审人', width: 90, render: (_: any, r) => r.reviewer?.realName || '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => <StatusTag value={v} map={reviewStatusMap} /> },
    {
      title: '操作', width: 90,
      render: (_: any, r) => (
        <Button size="small" type="text" icon={<IconEdit />} onClick={() => openModal(r)} />
      ),
    },
  ], [load])

  return (
    <>
      <div className={styles['performance__actions-bar']}>
        <Space>
          <Select placeholder="绩效周期" allowClear className={styles.performance__select}
            onChange={(v) => handleFilter('cycleId', v)}>
            {cycles.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select placeholder="状态" allowClear className={styles['performance__select--xs']}
            onChange={(v) => handleFilter('status', v)}>
            {Object.entries(reviewStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新建评审</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
      <Modal focusLock title={editing ? '编辑绩效评审' : '新建绩效评审'} visible={modalVisible}
        onOk={handleSubmit} onCancel={() => setModalVisible(false)} confirmLoading={submitting} className={styles.performance__modal}>
        <Form form={form} layout="vertical">
          <div className={styles['performance__form-grid']}>
            <FormItem label="绩效周期" field="cycleId" rules={[{ required: true, message: '请选择' }]}>
              <Select placeholder="选择周期">
                {cycles.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </FormItem>
            <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择' }]}>
              <Select placeholder="选择员工" showSearch>
                {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
              </Select>
            </FormItem>
          </div>
          <div className={styles['performance__form-grid--triple']}>
            <FormItem label="自评分" field="selfScore">
              <InputNumber min={0} max={100} className={styles['performance__form-item']} />
            </FormItem>
            <FormItem label="上级评分" field="managerScore">
              <InputNumber min={0} max={100} className={styles['performance__form-item']} />
            </FormItem>
            <FormItem label="最终分" field="finalScore">
              <InputNumber min={0} max={100} className={styles['performance__form-item']} />
            </FormItem>
          </div>
          <div className={styles['performance__form-grid']}>
            <FormItem label="状态" field="status">
              <Select>
                {Object.entries(reviewStatusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
              </Select>
            </FormItem>
          </div>
          <FormItem label="自评备注" field="selfComment">
            <Input.TextArea rows={2} />
          </FormItem>
          <FormItem label="评审备注" field="managerComment">
            <Input.TextArea rows={2} />
          </FormItem>
        </Form>
      </Modal>
    </>
  )
}

// ===== Main Page =====

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState('cycles')

  return (
    <div className={styles.performance}>
      <Card bordered={false}>
        <div className={styles.performance__header}>
          <span className={styles.performance__title}>绩效管理</span>
          <Tag color="arcoblue" className={styles.performance__tag}>
            绩效周期 · 目标管理 · 绩效评审
          </Tag>
        </div>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="cycles" title="绩效周期">
            <CyclesTab />
          </TabPane>
          <TabPane key="goals" title="目标管理">
            <GoalsTab />
          </TabPane>
          <TabPane key="reviews" title="绩效评审">
            <ReviewsTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
