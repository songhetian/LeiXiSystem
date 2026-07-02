import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, Card, Checkbox, Form, Input, InputNumber, Modal,
  Popconfirm, Select, Space, Table, Tabs, Tag,
} from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconDelete, IconPlus } from '@arco-design/web-react/icon'
import {
  getHelpdeskCategories, createHelpdeskCategory, deleteHelpdeskCategory,
  getHelpdeskTickets, getHelpdeskTicketDetail, createHelpdeskTicket,
  updateHelpdeskTicket, createHelpdeskComment,
} from '@/api/helpdesk'
import { getEmployees, type Employee } from '@/api/personnel'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/utils/toast'
import styles from './tickets.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

type Ticket = {
  id: number
  ticketNo: string
  title: string
  description?: string
  priority: string
  status: string
  createdAt?: string
  updatedAt?: string
  resolvedAt?: string
  category?: any
  creator?: { id?: number; realName: string }
  assignee?: { id?: number; realName: string }
  employee?: any
  comments?: Comment[]
}

type Comment = {
  id: number
  content: string
  isInternal: boolean
  createdAt?: string
  user?: { realName: string }
}

type Category = {
  id: number
  name: string
  code: string
  description?: string
  status: string
  sortOrder: number
}

const priorityMap: Record<string, { text: string; color: string }> = {
  low: { text: '低', color: 'gray' },
  medium: { text: '中', color: 'blue' },
  high: { text: '高', color: 'orange' },
  urgent: { text: '紧急', color: 'red' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  open: { text: '待处理', color: 'orange' },
  processing: { text: '处理中', color: 'blue' },
  resolved: { text: '已解决', color: 'green' },
  closed: { text: '已关闭', color: 'gray' },
  cancelled: { text: '已取消', color: 'red' },
}

function StatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function PriorityTag({ value }: { value: string }) {
  const info = priorityMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

// ===== Categories Tab =====

function CategoriesTab() {
  const [data, setData] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getHelpdeskCategories()
      setData(res?.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      await createHelpdeskCategory(values)
      toast.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteHelpdeskCategory(id)
      toast.success('删除成功')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '删除失败')
    }
  }

  const columns: TableProps<Category>['columns'] = useMemo(() => [
    { title: '分类编码', dataIndex: 'code', width: 150 },
    { title: '分类名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v) => <Tag color={v === 'active' ? 'green' : 'gray'}>{v === 'active' ? '有效' : '无效'}</Tag>,
    },
    {
      title: '操作', width: 80,
      render: (_: any, r) => (
        <Popconfirm title="确定删除该分类？" onOk={() => handleDelete(r.id)}>
          <Button size="small" type="text" icon={<IconDelete />} status="danger" />
        </Popconfirm>
      ),
    },
  ], [load])

  return (
    <>
      <div className={styles['helpdesk-tickets__categories-actions']}>
        <Button type="primary" icon={<IconPlus />} onClick={() => { form.resetFields(); form.setFieldsValue({ status: 'active', sortOrder: 0 }); setModalVisible(true) }}>
          新增分类
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data} pagination={false} />
      <Modal focusLock title="新增工单分类" visible={modalVisible} onOk={handleSubmit}
        onCancel={() => setModalVisible(false)} confirmLoading={submitting}>
        <Form form={form} layout="vertical">
          <FormItem label="分类编码" field="code" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：salary, attendance" />
          </FormItem>
          <FormItem label="分类名称" field="name" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：薪资问题" />
          </FormItem>
          <FormItem label="描述" field="description">
            <Input.TextArea rows={2} />
          </FormItem>
          <div className={styles['helpdesk-tickets__form-grid']}>
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} className={styles['helpdesk-tickets__form-grid-item']} />
            </FormItem>
            <FormItem label="状态" field="status">
              <Select>
                <Option value="active">有效</Option>
                <Option value="inactive">无效</Option>
              </Select>
            </FormItem>
          </div>
        </Form>
      </Modal>
    </>
  )
}

// ===== Tickets Tab =====

function TicketsTab() {
  const { permissions } = useAuthStore()
  const canHandle = permissions.includes('helpdesk:handle') || permissions.includes('*')
  const [data, setData] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, string | number | boolean | undefined>>({ onlyMine: false })
  const [createModal, setCreateModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [detailData, setDetailData] = useState<Ticket | null>(null)
  const [createForm] = Form.useForm()
  const [commentForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true)
    try {
      const res = await getHelpdeskTickets({ page: p, pageSize: 10, ...f })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([getHelpdeskCategories(), getEmployees({ page: 1, pageSize: 200 })]).then(([catRes, empRes]: any[]) => {
      setCategories(catRes?.data || [])
      setEmployees(empRes?.data?.list || [])
    })
  }, [])

  const handleFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const openCreate = () => {
    createForm.resetFields()
    createForm.setFieldsValue({ priority: 'medium', sourceType: 'self' })
    setCreateModal(true)
  }

  const handleCreate = async () => {
    const values = await createForm.validate()
    setSubmitting(true)
    try {
      await createHelpdeskTicket(values)
      toast.success('提交成功')
      setCreateModal(false)
      load()
    } finally { setSubmitting(false) }
  }

  const openDetail = async (id: number) => {
    const res = await getHelpdeskTicketDetail(id)
    setDetailData(res?.data || null)
    commentForm.resetFields()
    setDetailModal(true)
  }

  const handleComment = async () => {
    if (!detailData) return
    const values = await commentForm.validate()
    setSubmitting(true)
    try {
      await createHelpdeskComment(detailData.id, values)
      toast.success('回复成功')
      commentForm.resetFields()
      openDetail(detailData.id)
    } finally { setSubmitting(false) }
  }

  const handleStatusChange = async (id: number, status: string) => {
    await updateHelpdeskTicket(id, { status })
    toast.success('状态已更新')
    load()
  }

  const columns: TableProps<Ticket>['columns'] = useMemo(() => [
    { title: '工单编号', dataIndex: 'ticketNo', width: 170 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '分类', width: 100, render: (_: any, r) => r.category?.name || '-' },
    { title: '优先级', dataIndex: 'priority', width: 80, render: (v) => <PriorityTag value={v} /> },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} /> },
    { title: '提交人', dataIndex: 'creator', width: 90, render: (_: any, r) => r.creator?.realName || '-' },
    { title: '处理人', dataIndex: 'assignee', width: 90, render: (_: any, r) => r.assignee?.realName || '-' },
    { title: '提交时间', dataIndex: 'createdAt', width: 160, render: formatDate },
    {
      title: '操作', width: 90,
      render: (_: any, r) => (
        <Button size="small" type="text" onClick={() => openDetail(r.id)}>详情</Button>
      ),
    },
  ], [load])

  return (
    <>
      <div className={styles['helpdesk-tickets__categories-actions']}>
        <Space>
          {canHandle && (
            <Select placeholder="处理人筛选" allowClear className={styles['helpdesk-tickets__tickets-select']}
              onChange={(v) => handleFilter('assignedTo', v)}>
              {employees.filter(e => e.realName).map((e) => <Option key={e.id} value={e.id}>{e.realName}</Option>)}
            </Select>
          )}
          <Select placeholder="分类筛选" allowClear className={styles['helpdesk-tickets__tickets-select']}
            onChange={(v) => handleFilter('categoryId', v)}>
            {categories.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select placeholder="状态筛选" allowClear className={styles['helpdesk-tickets__tickets-select--sm']}
            onChange={(v) => handleFilter('status', v)}>
            {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Select placeholder="优先级" allowClear className={styles['helpdesk-tickets__tickets-select--xs']}
            onChange={(v) => handleFilter('priority', v)}>
            {Object.entries(priorityMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type={filters.onlyMine ? 'primary' : 'secondary'}
            onClick={() => handleFilter('onlyMine', !filters.onlyMine)}>
            我的工单
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={openCreate}>提交工单</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />

      {/* Create Modal */}
      <Modal focusLock title="提交工单" visible={createModal} onOk={handleCreate}
        onCancel={() => setCreateModal(false)} confirmLoading={submitting} className={styles['helpdesk-tickets__modal']}>
        <Form form={createForm} layout="vertical">
          <FormItem label="工单标题" field="title" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="简要描述您的问题" />
          </FormItem>
          <div className={styles['helpdesk-tickets__form-grid']}>
            <FormItem label="工单分类" field="categoryId" rules={[{ required: true, message: '请选择' }]}>
              <Select placeholder="选择分类">
                {categories.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </FormItem>
            <FormItem label="优先级" field="priority">
              <Select>
                {Object.entries(priorityMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
              </Select>
            </FormItem>
          </div>
          <FormItem label="问题描述" field="description">
            <Input.TextArea rows={4} placeholder="详细描述您遇到的问题" />
          </FormItem>
          <FormItem label="关联员工" field="employeeId">
            <Select placeholder="关联员工（可选）" allowClear showSearch>
              {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
            </Select>
          </FormItem>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal focusLock title="工单详情" visible={detailModal}
        onCancel={() => setDetailModal(false)} footer={null} className={styles['helpdesk-tickets__modal--wide']}>
        {detailData && (
          <div>
            <div className={styles['helpdesk-tickets__detail-grid']}>
              <div><span className={styles['helpdesk-tickets__detail-label']}>工单编号</span><div className={styles['helpdesk-tickets__detail-value']}>{detailData.ticketNo}</div></div>
              <div><span className={styles['helpdesk-tickets__detail-label']}>状态</span><div><StatusTag value={detailData.status} /></div></div>
              <div><span className={styles['helpdesk-tickets__detail-label']}>分类</span><div>{detailData.category?.name}</div></div>
              <div><span className={styles['helpdesk-tickets__detail-label']}>优先级</span><div><PriorityTag value={detailData.priority} /></div></div>
              <div><span className={styles['helpdesk-tickets__detail-label']}>提交人</span><div>{detailData.creator?.realName}</div></div>
              <div><span className={styles['helpdesk-tickets__detail-label']}>处理人</span><div>{detailData.assignee?.realName || '-'}</div></div>
              <div className={styles['helpdesk-tickets__detail-grid-full']}><span className={styles['helpdesk-tickets__detail-label']}>标题</span><div className={styles['helpdesk-tickets__detail-value'] + ' ' + styles['helpdesk-tickets__detail-value--large']}>{detailData.title}</div></div>
              <div className={styles['helpdesk-tickets__detail-grid-full']}><span className={styles['helpdesk-tickets__detail-label']}>问题描述</span><div>{detailData.description || '-'}</div></div>
            </div>

            {/* Quick Actions */}
            <div className={styles['helpdesk-tickets__quick-actions']}>
              <Select size="mini" className={styles['helpdesk-tickets__tickets-select--mini']} placeholder="变更状态"
                onChange={(v) => handleStatusChange(detailData.id, v as string)}>
                {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
              </Select>
              {canHandle && (
                <Select
                  size="mini"
                  className={styles['helpdesk-tickets__tickets-select--wide']}
                  placeholder="分配处理人"
                  allowClear
                  value={detailData.assignee?.id}
                  onChange={(v) => {
                    updateHelpdeskTicket(detailData.id, { assigneeId: v ?? null })
                      .then(() => { toast.success('分配成功'); openDetail(detailData.id) })
                      .catch((e: any) => toast.error(e?.response?.data?.message || '分配失败'))
                  }}>
                  {employees.filter((e: any) => e.realName).map((e: any) => (
                    <Option key={e.id} value={e.id}>{e.realName}</Option>
                  ))}
                </Select>
              )}
            </div>

            {/* Comments */}
            <div className={styles['helpdesk-tickets__comments']}>
              <span className={styles['helpdesk-tickets__comments-title']}>处理记录</span>
              {(!detailData.comments || detailData.comments.length === 0) && (
                <div className={styles['helpdesk-tickets__comments-empty']}>暂无处理记录</div>
              )}
              {detailData.comments?.map((c) => (
                <div key={c.id} className={c.isInternal ? "helpdesk-tickets__comment helpdesk-tickets__comment--internal" : "helpdesk-tickets__comment"}>
                  <Space>
                    <span className={styles['helpdesk-tickets__detail-value']}>{c.user?.realName}</span>
                    {c.isInternal && <Tag color="orange" className={styles['helpdesk-tickets__tag--internal']}>内部</Tag>}
                    <span className={styles['helpdesk-tickets__comment-time']}>{formatDate(c.createdAt)}</span>
                  </Space>
                  <div className={styles['helpdesk-tickets__comment-content']}>{c.content}</div>
                </div>
              ))}

              <div className={styles['helpdesk-tickets__comment-form']}>
                <span className={styles['helpdesk-tickets__comment-form-title']}>添加回复</span>
                <Form form={commentForm} layout="vertical">
                  <FormItem field="content" rules={[{ required: true, message: '请输入回复内容' }]}>
                    <Input.TextArea rows={3} placeholder="输入处理说明或回复" />
                  </FormItem>
                  {canHandle && (
                    <FormItem field="isInternal">
                      <Checkbox>内部备注（员工不可见）</Checkbox>
                    </FormItem>
                  )}
                </Form>
                <div className={styles['helpdesk-tickets__comment-form-actions']}>
                  <Button type="primary" size="small" onClick={handleComment} loading={submitting}>
                    提交回复
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ===== Main Page =====

export default function HelpdeskTicketsPage() {
  const [activeTab, setActiveTab] = useState('tickets')

  return (
    <div className={styles['helpdesk-tickets']}>
      <Card bordered={false}>
        <div className={styles['helpdesk-tickets__header']}>
          <span className={styles['helpdesk-tickets__title']}>HR Help Desk</span>
          <Tag color="arcoblue" className={styles['helpdesk-tickets__tag']}>
            工单中心 · 薪资/考勤/资产/入职/离职问题
          </Tag>
        </div>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="tickets" title="工单列表">
            <TicketsTab />
          </TabPane>
          <TabPane key="categories" title="工单分类">
            <CategoriesTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
