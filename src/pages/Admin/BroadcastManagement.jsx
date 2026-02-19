import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiUrl } from '../../utils/apiConfig'
import {
  Table, Button, Modal, Form, Input, Select,
  Tag, message, Card, Space, DatePicker, Typography
} from 'antd'
import {
  Megaphone,
  Plus,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BellRing,
  Eye,
  Send,
  RefreshCw
} from 'lucide-react'
import { formatDate, getBeijingDate } from '../../utils/date'
import Breadcrumb from '../../components/Breadcrumb'

const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker
const { Title, Paragraph } = Typography

const BroadcastManagement = () => {
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 筛选状态
  const [quickFilter, setQuickFilter] = useState('')
  const [queryParams, setQueryParams] = useState({ startDate: undefined, endDate: undefined })

  const token = localStorage.getItem('token')

  useEffect(() => {
    loadBroadcasts()
    loadDepartments()
    loadEmployees()
  }, [queryParams, pagination.current, pagination.pageSize])

  const loadBroadcasts = async () => {
    setLoading(true)
    try {
      const { current, pageSize } = pagination
      const response = await axios.get(getApiUrl('/api/broadcasts/created'), {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          ...queryParams,
          page: current,
          limit: pageSize
        }
      })
      if (response.data.success) {
        setBroadcasts(response.data.data)
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }))
      }
    } catch (error) {
      message.error('加载广播列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/departments'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (Array.isArray(response.data)) setDepartments(response.data)
    } catch (e) {}
  }

  const loadEmployees = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/employees'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (Array.isArray(response.data)) setEmployees(response.data)
    } catch (e) {}
  }

  const handleQuickFilter = (type) => {
    setQuickFilter(type)
    if (!type) {
      setQueryParams({ startDate: undefined, endDate: undefined })
      return
    }
    const getFormattedDate = (date) => formatDate(date, false);
    let startStr, endStr;
    const d = getBeijingDate();
    const dateStr = getFormattedDate(d);

    if (type === 'today') {
      startStr = `${dateStr} 00:00:00`; endStr = `${dateStr} 23:59:59`;
    } else if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
      const yDateStr = getFormattedDate(d);
      startStr = `${yDateStr} 00:00:00`; endStr = `${yDateStr} 23:59:59`;
    } else if (type === 'last7days') {
      const start = getBeijingDate(); start.setDate(start.getDate() - 6);
      startStr = `${getFormattedDate(start)} 00:00:00`; endStr = `${dateStr} 23:59:59`;
    }
    setQueryParams({ startDate: startStr, endDate: endStr })
  }

  const handleOpenPreview = async () => {
    try {
      const values = await form.validateFields();
      setPreviewData(values);
      setPreviewVisible(true);
    } catch (e) {}
  }

  const handleFinalSubmit = async () => {
    setSubmitting(true)
    try {
      const payload = {
        ...previewData,
        targetDepartments: previewData.targetType === 'department' ? JSON.stringify(previewData.targetDepartments) : null,
        targetRoles: previewData.targetType === 'role' ? JSON.stringify(previewData.targetRoles) : null,
        targetUsers: previewData.targetType === 'individual' ? JSON.stringify(previewData.targetUsers) : null
      }
      const response = await axios.post(getApiUrl('/api/broadcasts'), payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.data.success) {
        message.success('广播已全网实时发布')
        setPreviewVisible(false)
        setModalVisible(false)
        form.resetFields()
        loadBroadcasts()
      }
    } catch (error) {
      message.error('发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const typeConfig = {
    info: { label: '信息', color: 'blue', icon: <Info className="w-4 h-4" /> },
    warning: { label: '警告', color: 'orange', icon: <AlertTriangle className="w-4 h-4" /> },
    success: { label: '成功', color: 'green', icon: <CheckCircle2 className="w-4 h-4" /> },
    error: { label: '错误', color: 'red', icon: <XCircle className="w-4 h-4" /> },
    announcement: { label: '公告', color: 'purple', icon: <BellRing className="w-4 h-4" /> }
  };

  const priorityConfig = {
    low: { label: '低', color: 'bg-slate-100 text-slate-600' },
    normal: { label: '普通', color: 'bg-blue-50 text-blue-600' },
    high: { label: '高', color: 'bg-orange-50 text-orange-600' },
    urgent: { label: '紧急', color: 'bg-red-50 text-red-600' }
  };

  const columns = [
    {
      title: '广播主题',
      dataIndex: 'title',
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${typeConfig[record.type]?.color}-50 text-${typeConfig[record.type]?.color}-600`}>
            {typeConfig[record.type]?.icon}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{text}</span>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">ID: {record.id}</span>
          </div>
        </div>
      )
    },
    {
      title: '级别',
      dataIndex: 'priority',
      width: 100,
      render: (p) => <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${priorityConfig[p]?.color}`}>{priorityConfig[p]?.label}</span>
    },
    {
      title: '送达情况',
      key: 'stats',
      width: 120,
      render: (_, r) => (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>已读率</span>
            <span>{Math.round((r.read_count / (r.recipient_count || 1)) * 100)}%</span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${(r.read_count / (r.recipient_count || 1)) * 100}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 font-medium">{r.read_count} / {r.recipient_count} 人</span>
        </div>
      )
    },
    {
      title: '发布时间',
      dataIndex: 'created_at',
      width: 180,
      render: (t) => <span className="text-slate-500 text-xs font-medium">{new Date(t).toLocaleString()}</span>
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumb items={['首页', '办公协作', '广播管理']} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-8 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">系统广播中心</h1>
            <p className="text-slate-500 mt-1 font-medium">发布全员或定向消息通知，支持实时推送到桌面端</p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<Plus className="w-4 h-4" />}
            className="bg-slate-900 hover:bg-slate-800 border-none rounded-xl px-8 h-12 shadow-xl shadow-slate-200 font-bold"
            onClick={() => setModalVisible(true)}
          >
            发布新广播
          </Button>
        </div>

        {/* 过滤器 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: '', label: '全部' },
              { id: 'today', label: '今天' },
              { id: 'yesterday', label: '昨天' },
              { id: 'last7days', label: '近七天' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => handleQuickFilter(item.id)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${quickFilter === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <RangePicker
            className="rounded-xl border-slate-200 h-9"
            onChange={(dates) => {
              if (dates) setQueryParams({ startDate: dates[0].format('YYYY-MM-DD 00:00:00'), endDate: dates[1].format('YYYY-MM-DD 23:59:59') });
              else setQueryParams({ startDate: undefined, endDate: undefined });
            }}
          />
          <button onClick={loadBroadcasts} className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-auto"><RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        <Card bordered={false} className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={broadcasts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showTotal: (total) => `共 ${total} 条`,
              showSizeChanger: false,
              position: ['bottomRight']
            }}
            onChange={(newPagination) => {
              setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
            }}
            className="custom-table-shadcn"
          />
        </Card>
      </div>

      {/* 发布弹窗 */}
      <Modal
        title={<div className="flex items-center gap-3 py-2"><Megaphone className="w-5 h-5 text-indigo-600" /><span className="text-xl font-bold">构建系统广播</span></div>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={650}
        destroyOnClose
        centered
        className="custom-modal-shadcn"
      >
        <Form form={form} layout="vertical" className="mt-6" initialValues={{ type: 'info', priority: 'normal', targetType: 'all' }}>
          <Form.Item name="title" label={<span className="text-xs font-black uppercase tracking-wider text-slate-400">广播主题</span>} rules={[{ required: true }]}>
            <Input placeholder="输入广播的核心主题..." className="h-12 rounded-xl border-slate-200 font-bold" />
          </Form.Item>

          <Form.Item name="content" label={<span className="text-xs font-black uppercase tracking-wider text-slate-400">详细内容</span>} rules={[{ required: true }]}>
            <TextArea placeholder="请详细描述通知内容，支持 Markdown 或纯文本格式..." rows={5} className="rounded-xl border-slate-200 p-4" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-6">
            <Form.Item name="type" label={<span className="text-xs font-black uppercase tracking-wider text-slate-400">视觉类型</span>}>
              <Select className="h-11 rounded-xl">
                {Object.keys(typeConfig).map(k => (
                  <Option key={k} value={k}><Space>{typeConfig[k].icon} {typeConfig[k].label}</Space></Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label={<span className="text-xs font-black uppercase tracking-wider text-slate-400">紧急程度</span>}>
              <Select className="h-11">
                {Object.keys(priorityConfig).map(k => <Option key={k} value={k}>{priorityConfig[k].label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="targetType" label={<span className="text-xs font-black uppercase tracking-wider text-slate-400">投放目标</span>}>
            <Select className="h-11" onChange={() => form.setFieldsValue({ targetDepartments: [], targetRoles: [], targetUsers: [] })}>
              <Option value="all">全体员工</Option>
              <Option value="department">指定部门</Option>
              <Option value="role">指定角色</Option>
              <Option value="individual">指定个人</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(p, c) => p.targetType !== c.targetType}>
            {({ getFieldValue }) => {
              const t = getFieldValue('targetType');
              if (t === 'department') return <Form.Item name="targetDepartments" label="选择目标部门" rules={[{ required: true }]}><Select mode="multiple" className="min-h-[44px]" options={departments.map(d => ({ label: d.name, value: d.id }))} /></Form.Item>
              if (t === 'role') return <Form.Item name="targetRoles" label="选择目标角色" rules={[{ required: true }]}><Select mode="multiple" className="min-h-[44px]" options={['超级管理员', '部门管理员', '普通员工'].map(r => ({ label: r, value: r }))} /></Form.Item>
              if (t === 'individual') return <Form.Item name="targetUsers" label="选择目标员工" rules={[{ required: true }]}><Select mode="multiple" className="min-h-[44px]" options={employees.map(e => ({ label: `${e.real_name} (@${e.username})`, value: e.user_id }))} /></Form.Item>
              return null;
            }}
          </Form.Item>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-50 mt-4">
            <Button size="large" className="rounded-xl border-slate-200 font-bold" onClick={() => setModalVisible(false)}>取消</Button>
            <Button size="large" icon={<Eye className="w-4 h-4" />} className="rounded-xl border-slate-200 font-bold" onClick={handleOpenPreview}>预览效果</Button>
            <Button type="primary" size="large" icon={<Send className="w-4 h-4" />} className="bg-slate-900 border-none rounded-xl px-10 font-bold" onClick={handleOpenPreview}>确认发布</Button>
          </div>
        </Form>
      </Modal>

      {/* 预览确认弹窗 */}
      <Modal
        title={null}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        centered
        width={400}
        styles={{ body: { padding: 0 } }}
        closable={false}
      >
        <div className="p-8 bg-white rounded-3xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-16 h-16 rounded-full bg-${typeConfig[previewData?.type]?.color}-50 flex items-center justify-center text-${typeConfig[previewData?.type]?.color}-600 mb-4`}>
              {typeConfig[previewData?.type]?.icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900">确认发布此广播？</h3>
            <p className="text-sm text-slate-500 mt-2">发布后将无法修改，系统将立即推送到目标终端。</p>
          </div>

          <div className={`p-6 rounded-2xl bg-${typeConfig[previewData?.type]?.color}-50/50 border border-${typeConfig[previewData?.type]?.color}-100 mb-8`}>
            <Title level={5} className="!mb-2 font-bold">{previewData?.title}</Title>
            <Paragraph className="text-xs text-slate-600 !mb-0">{previewData?.content}</Paragraph>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button block size="large" className="rounded-xl font-bold border-slate-200" onClick={() => setPreviewVisible(false)}>返回修改</Button>
            <Button block type="primary" size="large" loading={submitting} className="bg-slate-900 border-none rounded-xl font-bold" onClick={handleFinalSubmit}>确认发布</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default BroadcastManagement
