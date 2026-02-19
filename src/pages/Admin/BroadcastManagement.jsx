import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiUrl } from '../../utils/apiConfig'
import {
  Table, Button, Modal, Form, Input, Select,
  Tag, message, Card, Space, DatePicker, Typography, Tooltip
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
  RefreshCw,
  Users,
  Search,
  History,
  ArrowRight
} from 'lucide-react'
import { formatDate, getBeijingDate } from '../../utils/date'
import Breadcrumb from '../../components/Breadcrumb'

const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker
const { Title, Text, Paragraph } = Typography

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
        message.success('广播已成功发布至全网')
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
    info: { label: '通知', color: 'blue', icon: <Info /> },
    warning: { label: '提醒', color: 'orange', icon: <AlertTriangle /> },
    success: { label: '成功', color: 'green', icon: <CheckCircle2 /> },
    error: { label: '警告', color: 'red', icon: <XCircle /> },
    announcement: { label: '公告', color: 'purple', icon: <BellRing /> }
  };

  const priorityConfig = {
    low: { label: '低', color: 'bg-slate-100 text-slate-500 border-slate-200' },
    normal: { label: '普通', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    high: { label: '高', color: 'bg-amber-50 text-amber-600 border-amber-200' },
    urgent: { label: '紧急', color: 'bg-rose-50 text-rose-600 border-rose-200' }
  };

  const columns = [
    {
      title: '广播主题',
      dataIndex: 'title',
      render: (text, record) => (
        <div className="flex items-center gap-3 py-1">
          <div className={`p-2 rounded-lg bg-${typeConfig[record.type]?.color}-50 text-${typeConfig[record.type]?.color}-600 border border-${typeConfig[record.type]?.color}-100`}>
            {React.cloneElement(typeConfig[record.type]?.icon, { size: 18 })}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 text-sm">{text}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">编号: #{record.id}</span>
          </div>
        </div>
      )
    },
    {
      title: '紧急程度',
      dataIndex: 'priority',
      width: 100,
      render: (p) => (
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${priorityConfig[p]?.color}`}>
          {priorityConfig[p]?.label}
        </span>
      )
    },
    {
      title: '送达详情',
      key: 'stats',
      width: 160,
      render: (_, r) => {
        const percentage = Math.round((r.read_count / (r.recipient_count || 1)) * 100);
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400">已读率</span>
              <span className="text-[10px] font-black text-slate-700">{percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${percentage}%` }} />
            </div>
            <span className="text-[9px] text-slate-400 font-medium">{r.read_count} / {r.recipient_count} 人已确认</span>
          </div>
        );
      }
    },
    {
      title: '发布日期',
      dataIndex: 'created_at',
      width: 180,
      render: (t) => (
        <div className="text-xs text-slate-500 font-medium">
          {new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 标题栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="bg-slate-900 p-2 rounded-lg text-white shadow-sm">
              <Megaphone className="w-5 h-5" />
           </div>
           <div>
              <h1 className="text-xl font-bold text-gray-900">广播发布管理</h1>
              <p className="text-xs text-gray-500">发布全员或定向通知，实时同步业务动态</p>
           </div>
        </div>
        <button onClick={loadBroadcasts} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 筛选与操作工具栏 */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex bg-gray-100 p-1 rounded-lg">
              {[
                { id: '', label: '全部记录' },
                { id: 'today', label: '今天' },
                { id: 'last7days', label: '近七天' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleQuickFilter(item.id)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${quickFilter === item.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {item.label}
                </button>
              ))}
           </div>
           
           <RangePicker
              className="rounded-lg border-gray-200 h-9 bg-gray-50"
              placeholder={['开始时间', '结束时间']}
              onChange={(dates) => {
                if (dates) setQueryParams({ startDate: dates[0].format('YYYY-MM-DD 00:00:00'), endDate: dates[1].format('YYYY-MM-DD 23:59:59') });
                else setQueryParams({ startDate: undefined, endDate: undefined });
              }}
            />
        </div>

        <Button
          type="primary"
          icon={<Plus size={16} />}
          className="bg-blue-600 hover:bg-blue-700 border-none rounded-lg px-6 h-10 font-bold shadow-md shadow-blue-100"
          onClick={() => setModalVisible(true)}
        >
          发布新广播
        </Button>
      </div>

      {/* 列表区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <Table
            columns={columns}
            dataSource={broadcasts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showTotal: (total) => <span className="text-xs font-bold text-gray-400">共计 {total} 条记录</span>,
              showSizeChanger: false,
              position: ['bottomRight'],
              className: "px-6 py-4"
            }}
            onChange={(newPagination) => {
              setPagination(prev => ({ ...prev, current: newPagination.current }))
            }}
            className="compact-table"
          />
        </div>
      </div>

      {/* 发布表单弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-3 py-2">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Megaphone size={20} />
            </div>
            <span className="text-lg font-bold text-gray-900">撰写广播内容</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={650}
        destroyOnClose
        centered
        className="refined-modal"
      >
        <Form form={form} layout="vertical" className="mt-4 space-y-4" initialValues={{ type: 'info', priority: 'normal', targetType: 'all' }}>
          <Form.Item name="title" label={<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">广播主题</span>} rules={[{ required: true }]}>
            <Input placeholder="输入广播的核心主题..." className="h-11 rounded-lg border-gray-200 font-bold" />
          </Form.Item>

          <Form.Item name="content" label={<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">详细内容</span>} rules={[{ required: true }]}>
            <TextArea placeholder="详细描述通知内容..." rows={5} className="rounded-lg border-gray-200 p-3" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="type" label={<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">消息分类</span>}>
              <Select className="h-11 refined-select">
                {Object.keys(typeConfig).map(k => (
                  <Option key={k} value={k}>
                    <div className="flex items-center gap-2 font-medium">
                      <span className={`text-${typeConfig[k].color}-500 flex`}>{React.cloneElement(typeConfig[k].icon, { size: 14 })}</span>
                      {typeConfig[k].label}
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label={<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">紧急程度</span>}>
              <Select className="h-11">
                {Object.keys(priorityConfig).map(k => <Option key={k} value={k}>{priorityConfig[k].label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <Form.Item name="targetType" label={<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">投放目标</span>} className="!mb-0">
              <Select className="h-11 font-bold" onChange={() => form.setFieldsValue({ targetDepartments: [], targetRoles: [], targetUsers: [] })}>
                <Option value="all">全体员工</Option>
                <Option value="department">指定部门</Option>
                <Option value="role">指定角色</Option>
                <Option value="individual">指定个人</Option>
              </Select>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(p, c) => p.targetType !== c.targetType}>
              {({ getFieldValue }) => {
                const t = getFieldValue('targetType');
                if (t === 'all') return null;
                return (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    {t === 'department' && (
                      <Form.Item name="targetDepartments" label="选择目标部门" rules={[{ required: true }]}>
                        <Select mode="multiple" className="min-h-[44px]" placeholder="请选择部门..." options={departments.map(d => ({ label: d.name, value: d.id }))} />
                      </Form.Item>
                    )}
                    {t === 'role' && (
                      <Form.Item name="targetRoles" label="选择目标角色" rules={[{ required: true }]}>
                        <Select mode="multiple" className="min-h-[44px]" placeholder="请选择角色..." options={['超级管理员', '部门管理员', '普通员工'].map(r => ({ label: r, value: r }))} />
                      </Form.Item>
                    )}
                    {t === 'individual' && (
                      <Form.Item name="targetUsers" label="选择目标员工" rules={[{ required: true }]}>
                        <Select mode="multiple" className="min-h-[44px]" placeholder="搜索员工..." options={employees.map(e => ({ label: `${e.real_name} (@${e.username})`, value: e.user_id }))} />
                      </Form.Item>
                    )}
                  </div>
                );
              }}
            </Form.Item>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button size="large" className="rounded-xl border-gray-200 px-8 text-sm font-bold text-gray-500" onClick={() => setModalVisible(false)}>取消</Button>
            <Button size="large" icon={<Eye size={16} />} className="rounded-xl border-gray-200 px-8 text-sm font-bold text-gray-700" onClick={handleOpenPreview}>预览</Button>
            <Button type="primary" size="large" icon={<Send size={16} />} className="bg-slate-900 hover:bg-slate-800 border-none rounded-xl px-10 text-sm font-bold shadow-lg shadow-slate-200" onClick={handleOpenPreview}>确认发布</Button>
          </div>
        </Form>
      </Modal>

      {/* 预览对话框 */}
      <Modal
        title={null}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        centered
        width={450}
        styles={{ body: { padding: 0 } }}
        closable={false}
      >
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-8 text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-2xl bg-${typeConfig[previewData?.type]?.color}-50 flex items-center justify-center text-${typeConfig[previewData?.type]?.color}-600 border border-${typeConfig[previewData?.type]?.color}-100`}>
              {previewData?.type && React.cloneElement(typeConfig[previewData?.type]?.icon, { size: 32 })}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">确认发布此广播内容？</h3>
              <p className="text-sm text-gray-400 mt-1">发布后将立即推送给所选目标，无法撤回</p>
            </div>
          </div>

          <div className="px-8 pb-4">
            <div className={`p-6 rounded-xl bg-gray-50 border border-gray-100 relative`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityConfig[previewData?.priority]?.color}`}>
                  {priorityConfig[previewData?.priority]?.label}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">就绪信号</span>
              </div>
              <h4 className="font-bold text-gray-900 text-base mb-2">{previewData?.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{previewData?.content}</p>
            </div>
          </div>

          <div className="p-8 pt-4 grid grid-cols-2 gap-3">
            <Button block size="large" className="h-12 rounded-xl font-bold border-gray-200 text-gray-500" onClick={() => setPreviewVisible(false)}>修改</Button>
            <Button block type="primary" size="large" loading={submitting} className="h-12 bg-slate-900 border-none rounded-xl font-bold shadow-lg" onClick={handleFinalSubmit}>立即发送</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default BroadcastManagement
