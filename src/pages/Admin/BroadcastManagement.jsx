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
  RefreshCw,
  Users
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
        <div className="flex items-center gap-4 py-1">
          <div className={`p-2.5 rounded-xl bg-${typeConfig[record.type]?.color}-50 text-${typeConfig[record.type]?.color}-600 shadow-sm border border-${typeConfig[record.type]?.color}-100`}>
            {React.cloneElement(typeConfig[record.type]?.icon, { className: 'w-5 h-5' })}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-slate-800 text-sm">{text}</span>
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">REF: #{record.id.toString().padStart(4, '0')}</span>
          </div>
        </div>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (p) => (
        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${priorityConfig[p]?.color} border border-current opacity-80`}>
          {priorityConfig[p]?.label}
        </div>
      )
    },
    {
      title: '送达详情',
      key: 'stats',
      width: 160,
      render: (_, r) => {
        const percentage = Math.round((r.read_count / (r.recipient_count || 1)) * 100);
        return (
          <div className="flex flex-col gap-1.5 py-1">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Reach Rate</span>
              <span className="text-xs font-black text-slate-700">{percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all duration-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" 
                style={{ width: `${percentage}%` }} 
              />
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-300" />
              <span className="text-[10px] text-slate-400 font-bold">{r.read_count} / {r.recipient_count} 确认已读</span>
            </div>
          </div>
        );
      }
    },
    {
      title: '发布轨迹',
      dataIndex: 'created_at',
      width: 180,
      render: (t) => (
        <div className="flex flex-col">
          <span className="text-slate-600 text-xs font-bold">{new Date(t).toLocaleDateString()}</span>
          <span className="text-slate-400 text-[10px] font-medium uppercase tracking-tighter">{new Date(t).toLocaleTimeString()}</span>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-full bg-[#f8fafc] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <Breadcrumb items={['控制面板', '协同办公', '广播管理']} />

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-200">
                <Megaphone className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Broadcast Center</h1>
            </div>
            <p className="text-slate-500 font-medium pl-1 text-sm">发布实时全员通知与精准业务广播，驱动组织高效协同</p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<Plus className="w-4 h-4" />}
            className="bg-slate-900 hover:bg-slate-800 border-none rounded-2xl px-8 h-14 shadow-2xl shadow-slate-200 font-black text-sm uppercase tracking-widest flex items-center gap-2"
            onClick={() => setModalVisible(true)}
          >
            Create New Signal
          </Button>
        </div>

        {/* 智能过滤器 */}
        <div className="bg-white/80 backdrop-blur-xl p-2 rounded-[24px] border border-slate-200/60 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100/80 p-1.5 rounded-[18px] gap-1">
            {[
              { id: '', label: 'All signals' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7days', label: 'Past 7 days' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => handleQuickFilter(item.id)}
                className={`px-5 py-2 text-[11px] font-black uppercase tracking-wider rounded-[14px] transition-all duration-300 ${quickFilter === item.id ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          
          <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden md:block" />
          
          <RangePicker
            className="rounded-2xl border-slate-200 h-11 px-4 bg-transparent hover:border-slate-400 transition-colors"
            placeholder={['Start Date', 'End Date']}
            onChange={(dates) => {
              if (dates) setQueryParams({ startDate: dates[0].format('YYYY-MM-DD 00:00:00'), endDate: dates[1].format('YYYY-MM-DD 23:59:59') });
              else setQueryParams({ startDate: undefined, endDate: undefined });
            }}
          />
          
          <button 
            onClick={loadBroadcasts} 
            className="p-3 hover:bg-slate-100 rounded-2xl transition-all duration-300 ml-auto group"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-slate-900 group-active:rotate-180 transition-transform ${loading ? 'animate-spin text-slate-900' : ''}`} />
          </button>
        </div>

        <Card 
          bordered={false} 
          className="rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden" 
          styles={{ body: { padding: 0 } }}
        >
          <Table
            columns={columns}
            dataSource={broadcasts}
            rowKey="id"
            loading={loading}
            scroll={{ x: 800 }}
            pagination={{
              ...pagination,
              showTotal: (total) => <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total {total} entries</span>,
              showSizeChanger: false,
              position: ['bottomRight'],
              className: "px-6 py-4"
            }}
            onChange={(newPagination) => {
              setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
            }}
            className="modern-slate-table"
          />
        </Card>
      </div>

      {/* 构建广播表单弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-4 py-4 px-2">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <Title level={3} className="!mb-0 !font-black tracking-tight uppercase">Compose Broadcast</Title>
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">Broadcast engine v2.0</Text>
            </div>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={720}
        destroyOnClose
        centered
        className="refined-modal"
        styles={{ body: { padding: '0 32px 32px' } }}
      >
        <Form form={form} layout="vertical" className="space-y-6" initialValues={{ type: 'info', priority: 'normal', targetType: 'all' }}>
          <Form.Item 
            name="title" 
            label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Broadcast Subject</span>} 
            rules={[{ required: true }]}
          >
            <Input placeholder="输入广播的核心主题..." className="h-14 rounded-2xl border-slate-200 px-5 font-bold text-base focus:border-slate-900 hover:border-slate-400 transition-all shadow-sm" />
          </Form.Item>

          <Form.Item 
            name="content" 
            label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Detailed Content</span>} 
            rules={[{ required: true }]}
          >
            <TextArea 
              placeholder="请详细描述通知内容，支持 Markdown 或纯文本格式..." 
              rows={6} 
              className="rounded-2xl border-slate-200 p-5 text-base focus:border-slate-900 hover:border-slate-400 transition-all shadow-sm" 
            />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100">
            <Form.Item name="type" label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Type</span>}>
              <Select className="h-12 refined-select">
                {Object.keys(typeConfig).map(k => (
                  <Option key={k} value={k}>
                    <Space className="font-bold">
                      <span className={`text-${typeConfig[k].color}-500 flex items-center`}>{typeConfig[k].icon}</span>
                      <span className="text-slate-700">{typeConfig[k].label}</span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Priority Level</span>}>
              <Select className="h-12 refined-select">
                {Object.keys(priorityConfig).map(k => <Option key={k} value={k} className="font-bold text-slate-700">{priorityConfig[k].label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="p-8 bg-slate-900 rounded-[28px] shadow-2xl shadow-indigo-200/50">
            <Form.Item name="targetType" label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400/60">Target Destination</span>} className="!mb-0">
              <Select 
                className="h-14 refined-select-dark"
                dropdownClassName="dark-dropdown"
                onChange={() => form.setFieldsValue({ targetDepartments: [], targetRoles: [], targetUsers: [] })}
              >
                <Option value="all" className="font-black text-xs uppercase">Broadcast to all members</Option>
                <Option value="department" className="font-black text-xs uppercase">Targeted Departments</Option>
                <Option value="role" className="font-black text-xs uppercase">Role-based transmission</Option>
                <Option value="individual" className="font-black text-xs uppercase">Individual direct signals</Option>
              </Select>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(p, c) => p.targetType !== c.targetType}>
              {({ getFieldValue }) => {
                const t = getFieldValue('targetType');
                if (t === 'all') return null;
                return (
                  <div className="mt-6 pt-6 border-t border-white/10 animate-in slide-in-from-top-4 duration-300">
                    {t === 'department' && (
                      <Form.Item name="targetDepartments" label={<span className="text-[10px] font-bold text-white/40 uppercase">Select Target Sectors</span>} rules={[{ required: true }]}>
                        <Select mode="multiple" className="refined-select-dark min-h-[50px]" placeholder="选择部门..." options={departments.map(d => ({ label: d.name, value: d.id }))} />
                      </Form.Item>
                    )}
                    {t === 'role' && (
                      <Form.Item name="targetRoles" label={<span className="text-[10px] font-bold text-white/40 uppercase">Select Recipient Roles</span>} rules={[{ required: true }]}>
                        <Select mode="multiple" className="refined-select-dark min-h-[50px]" placeholder="选择角色..." options={['超级管理员', '部门管理员', '普通员工'].map(r => ({ label: r, value: r }))} />
                      </Form.Item>
                    )}
                    {t === 'individual' && (
                      <Form.Item name="targetUsers" label={<span className="text-[10px] font-bold text-white/40 uppercase">Select Target Entities</span>} rules={[{ required: true }]}>
                        <Select mode="multiple" className="refined-select-dark min-h-[50px]" placeholder="搜索员工..." options={employees.map(e => ({ label: `${e.real_name} (@${e.username})`, value: e.user_id }))} />
                      </Form.Item>
                    )}
                  </div>
                );
              }}
            </Form.Item>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button 
              size="large" 
              className="rounded-2xl border-slate-200 h-14 px-8 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-600 transition-all" 
              onClick={() => setModalVisible(false)}
            >
              Cancel
            </Button>
            <Button 
              size="large" 
              icon={<Eye className="w-4 h-4" />} 
              className="rounded-2xl border-slate-200 h-14 px-8 font-black uppercase text-xs tracking-widest text-slate-600 hover:border-slate-900 transition-all" 
              onClick={handleOpenPreview}
            >
              Preview
            </Button>
            <Button 
              type="primary" 
              size="large" 
              icon={<Send className="w-4 h-4" />} 
              className="bg-slate-900 border-none rounded-2xl h-14 px-12 font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200" 
              onClick={handleOpenPreview}
            >
              Execute
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 预览确认弹窗 - 沉浸式设计 */}
      <Modal
        title={null}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        centered
        width={480}
        styles={{ body: { padding: 0 } }}
        closable={false}
        className="preview-modal"
      >
        <div className="overflow-hidden rounded-[32px] bg-white">
          <div className="p-10 text-center space-y-6">
            <div className={`w-20 h-20 mx-auto rounded-3xl bg-${typeConfig[previewData?.type]?.color}-50 flex items-center justify-center text-${typeConfig[previewData?.type]?.color}-600 shadow-inner border border-${typeConfig[previewData?.type]?.color}-100 animate-bounce-slow`}>
              {previewData?.type && React.cloneElement(typeConfig[previewData?.type]?.icon, { className: 'w-10 h-10' })}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Confirm Emission?</h3>
              <p className="text-slate-400 text-sm font-bold leading-relaxed px-4">
                You are about to transmit this signal across the entire network. This action cannot be revoked.
              </p>
            </div>
          </div>

          <div className="px-10 pb-4">
            <div className={`p-8 rounded-[24px] bg-${typeConfig[previewData?.type]?.color}-50/40 border border-${typeConfig[previewData?.type]?.color}-100/50 relative overflow-hidden group`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {previewData?.type && React.cloneElement(typeConfig[previewData?.type]?.icon, { className: 'w-24 h-24' })}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${priorityConfig[previewData?.priority]?.color}`}>
                  {priorityConfig[previewData?.priority]?.label}
                </span>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Signal ready</span>
              </div>
              <Title level={4} className="!mb-3 !font-black text-slate-900">{previewData?.title}</Title>
              <Paragraph className="text-slate-600 text-sm leading-relaxed !mb-0 font-medium line-clamp-4">
                {previewData?.content}
              </Paragraph>
            </div>
          </div>

          <div className="p-10 pt-6 grid grid-cols-2 gap-4">
            <Button 
              block 
              size="large" 
              className="h-14 rounded-2xl font-black uppercase text-xs tracking-widest border-slate-200 text-slate-400 hover:text-slate-600 transition-all" 
              onClick={() => setPreviewVisible(false)}
            >
              Back
            </Button>
            <Button 
              block 
              type="primary" 
              size="large" 
              loading={submitting} 
              className="h-14 bg-slate-900 border-none rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95" 
              onClick={handleFinalSubmit}
            >
              Transmit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default BroadcastManagement
