import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Card, Space, Tooltip, DatePicker, Radio, ConfigProvider, InputNumber } from 'antd'
import {
  FileTextOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import { getApiUrl } from '../../utils/apiConfig'
import { wsManager } from '../../services/websocket'
import { formatDate, getBeijingDate } from '../../utils/date'
import './EmployeeMemos.css'

const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker

const EmployeeMemos = () => {
  const [memos, setMemos] = useState([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [recipientsModalVisible, setRecipientsModalVisible] = useState(false)
  const [currentMemo, setCurrentMemo] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // 物理分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpPage, setJumpPage] = useState(null)

  // 筛选状态
  const [quickFilter, setQuickFilter] = useState('')
  const [dateRange, setDateRange] = useState(null)

  // 表单
  const [form] = Form.useForm()
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])

  // Token 解析
  const token = localStorage.getItem('token')
  const userInfo = useMemo(() => {
    if (!token) return null
    try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        return JSON.parse(jsonPayload)
    } catch (e) { return null }
  }, [token])
  const userDepartmentId = userInfo?.department_id

  useEffect(() => {
    const handleNewMemo = () => loadMemos()
    wsManager.on('memo', handleNewMemo)
    return () => wsManager.off('memo', handleNewMemo)
  }, [])

  useEffect(() => {
    loadMemos()
    if (departments.length === 0) loadDepartments()
  }, [quickFilter, dateRange])

  const sendMode = Form.useWatch('sendMode', form)
  const targetDepartmentId = Form.useWatch('targetDepartmentId', form)

  useEffect(() => {
    if (sendMode === 'individual' && targetDepartmentId) {
      loadEmployees(targetDepartmentId)
    }
  }, [sendMode, targetDepartmentId])

  // --- 分页物理逻辑 ---
  const totalPages = Math.ceil(memos.length / pageSize)
  const getCurrentPageData = () => memos.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const renderPageNumbers = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        pages.push(
            <button 
                key={i} 
                onClick={() => handlePageChange(i)} 
                className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}
            >
                {i}
            </button>
        )
    }
    return pages
  }

  const loadMemos = async () => {
    setLoading(true)
    try {
      const params = { pageSize: 100 }
      const getFormattedDate = (date) => formatDate(date, false);
      let startDate, endDate;

      if (quickFilter) {
        if (quickFilter === 'today') {
          const d = getBeijingDate();
          const dateStr = getFormattedDate(d);
          startDate = `${dateStr} 00:00:00`;
          endDate = `${dateStr} 23:59:59`;
        } else if (quickFilter === 'yesterday') {
          const d = getBeijingDate();
          d.setDate(d.getDate() - 1);
          const dateStr = getFormattedDate(d);
          startDate = `${dateStr} 00:00:00`;
          endDate = `${dateStr} 23:59:59`;
        } else if (quickFilter === 'last3days') {
          const start = getBeijingDate();
          start.setDate(start.getDate() - 2);
          const end = getBeijingDate();
          startDate = `${getFormattedDate(start)} 00:00:00`;
          endDate = `${getFormattedDate(end)} 23:59:59`;
        } else if (quickFilter === 'last7days') {
          const start = getBeijingDate();
          start.setDate(start.getDate() - 6);
          const end = getBeijingDate();
          startDate = `${getFormattedDate(start)} 00:00:00`;
          endDate = `${getFormattedDate(end)} 23:59:59`;
        }
      } else if (dateRange && dateRange.length === 2) {
        startDate = dateRange[0].format('YYYY-MM-DD 00:00:00');
        endDate = dateRange[1].format('YYYY-MM-DD 23:59:59');
      }

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await axios.get(getApiUrl('/api/memos/department/created'), {
        params: { ...params, _t: Date.now() },
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.data.success) {
        setMemos(response.data.data)
        setCurrentPage(1) // 刷新数据时回到第一页
      }
    } catch (error) {
      console.error('加载备忘录失败:', error)
      message.error('加载备忘录失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/departments'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (Array.isArray(response.data)) {
        setDepartments(response.data)
      } else if (response.data.success && response.data.data) {
        setDepartments(response.data.data)
      }
    } catch (error) { console.error(error) }
  }

  const loadEmployees = async (deptId) => {
    try {
      const response = await axios.get(getApiUrl('/api/employees'), {
        params: { department_id: deptId },
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (Array.isArray(response.data)) {
        setEmployees(response.data)
      } else if (response.data.success) {
        setEmployees(response.data.data || [])
      }
    } catch (error) { console.error(error) }
  }

  const handleCreate = async (values) => {
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        title: values.title.trim(),
        content: values.content.trim()
      }
      await axios.post(getApiUrl('/api/memos/department'), payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      message.success('备忘录分发成功')
      setCreateModalVisible(false)
      form.resetFields()
      loadMemos()
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || '发送失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewRecipients = async (memo) => {
    try {
      const response = await axios.get(getApiUrl(`/api/memos/department/${memo.id}/recipients`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.data.success) {
        setCurrentMemo(response.data.data.memo)
        setRecipients(response.data.data.recipients)
        setRecipientsModalVisible(true)
      }
    } catch (error) {
      message.error('加载阅读详情失败')
    }
  }

  const handleQuickFilter = (type) => {
    setQuickFilter(type)
    setDateRange(null)
  }

  const handleRangePickerChange = (dates) => {
    setDateRange(dates)
    if (dates) setQuickFilter('')
  }

  const priorityColors = {
    low: 'default',
    normal: 'blue',
    high: 'gold',
    urgent: 'volcano'
  }

  const priorityLabels = {
    low: '🔵 低',
    normal: '🟢 普通',
    high: '🟠 高',
    urgent: '🔴 紧急'
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <span className="font-black text-slate-900">{text}</span>
    },
    {
      title: '发送对象',
      key: 'target',
      render: (_, record) => {
        if (record.target_user_name) {
          return <Tag icon={<UserOutlined />} className="font-black">个人: {record.target_user_name}</Tag>
        }
        return <Tag icon={<TeamOutlined />} color="blue" className="font-black">全员: {record.department_name}</Tag>
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => <Tag color={priorityColors[p]} className="font-black">{priorityLabels[p]}</Tag>
    },
    {
      title: '阅读进度',
      key: 'stats',
      render: (_, record) => (
        <Tooltip title={`已读人数: ${record.read_count} | 总人数: ${record.total_recipients}`}>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                    className="h-full bg-indigo-500 transition-all" 
                    style={{ width: `${(record.read_count / record.total_recipients) * 100}%` }}
                />
            </div>
            <span className="text-[11px] font-black text-slate-500">{record.read_count}/{record.total_recipients}</span>
          </div>
        </Tooltip>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => <span className="text-slate-500 font-bold">{new Date(text).toLocaleString('zh-CN')}</span>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
            type="text" 
            size="small" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewRecipients(record)}
            className="font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
        >
          查看详情
        </Button>
      )
    }
  ]

  const recipientsColumns = [
    { title: '姓名', dataIndex: 'real_name', key: 'name', render: (t) => <span className="font-black">{t}</span> },
    { title: '部门', dataIndex: 'department_name', key: 'dept', render: (t) => <span className="font-bold text-slate-500">{t}</span> },
    {
      title: '阅读状态',
      key: 'status',
      render: (_, r) => r.is_read ? <Tag icon={<CheckCircleOutlined />} color="success" className="font-black">已读</Tag> : <Tag icon={<ExclamationCircleOutlined />} color="warning" className="font-black">未读</Tag>
    },
    {
      title: '反馈时间',
      dataIndex: 'read_at',
      key: 'read_at',
      render: (t) => <span className="text-slate-400 text-xs">{t ? new Date(t).toLocaleString('zh-CN') : '暂无记录'}</span>
    }
  ]

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { 
            Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5' },
            Input: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' },
            InputNumber: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' },
            Radio: { colorPrimary: '#4f46e5' },
            DatePicker: { colorBorder: '#64748b' }
        }
    }}>
    <div className="p-8 bg-[#f8fafc] min-h-screen font-black text-left">
      {/* 头部标题区 */}
      <div className="flex flex-col mb-8">
          <h1 className="text-xl font-black text-slate-900 tracking-tight">备忘录管理</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">管理并追踪发送给部门或个人的备忘信息</p>
      </div>

      {/* 搜索筛选区 */}
      <div className="flex items-center mb-8 w-full">
          <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-500 overflow-hidden h-[44px]">
            <div className="flex shrink-0 h-full border-r border-slate-200">
                {[
                { id: '', label: '全部' },
                { id: 'today', label: '今天' },
                { id: 'yesterday', label: '昨天' },
                { id: 'last3days', label: '近 3 天' },
                { id: 'last7days', label: '近 7 天' },
                ].map((item, idx) => (
                <button
                    key={item.id}
                    onClick={() => handleQuickFilter(item.id)}
                    className={`px-6 h-full text-[12px] font-black transition-all ${
                        quickFilter === item.id 
                        ? 'bg-slate-900 text-white' 
                        : 'text-slate-600 hover:bg-slate-50'
                    } ${idx < 4 ? 'border-r border-slate-100' : ''}`}
                >
                    {item.label}
                </button>
                ))}
            </div>

            <div className="shrink-0 h-full">
                <RangePicker
                    value={dateRange}
                    onChange={handleRangePickerChange}
                    placeholder={['开始日期', '结束日期']}
                    className="w-72 !rounded-none !border-none h-full font-black px-6 focus:ring-0 shadow-none"
                    style={{ border: 'none' }}
                />
            </div>
          </div>

          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => {
                form.resetFields()
                setCreateModalVisible(true)
                if (userDepartmentId) {
                    form.setFieldsValue({ targetDepartmentId: userDepartmentId, sendMode: 'department' })
                }
            }}
            className="ml-auto !h-[44px] !px-10 bg-indigo-600 font-black hover:bg-indigo-700 transition-all rounded-lg border border-slate-500 shadow-sm"
          >
            发送新备忘录
          </Button>
      </div>

      <Card 
        className="rounded-2xl border-slate-500 shadow-sm overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={getCurrentPageData()}
          rowKey="id"
          loading={loading}
          pagination={false}
          className="flagship-table"
        />

        {/* 旗舰级物理分页控制台 - 仅在数据超过 10 条时显示 */}
        {memos.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-500 rounded-b-2xl">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">
                      共找到 <span className="text-indigo-600">{memos.length}</span> 条记录
                  </span>
                  <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                  <Select 
                      size="small" 
                      value={pageSize} 
                      onChange={handlePageSizeChange}
                      className="w-32 font-black flagship-select" 
                      options={[10, 20, 50, 100].map(v => ({ label: `${v} 条/页`, value: v }))} 
                  />
              </div>

              <div className="flex items-center gap-3">
                  <button 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all"
                  >
                      <ChevronLeft size={16} className="inline mr-1" /> 上一页
                  </button>
                  
                  <div className="flex gap-1.5 mx-2">
                      {renderPageNumbers()}
                  </div>

                  <button 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all"
                  >
                      下一页 <ChevronRight size={16} className="inline ml-1" />
                  </button>

                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber 
                          min={1} 
                          max={totalPages} 
                          value={jumpPage} 
                          onChange={setJumpPage}
                          onPressEnter={handleJumpPage}
                          className="w-16 h-10 rounded-lg font-black text-center border-[1px] border-slate-500 flagship-input-number"
                          controls={false}
                      />
                      <button 
                          onClick={handleJumpPage}
                          className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg shadow-slate-200"
                      >
                          <ArrowRight size={16} />
                      </button>
                  </div>
              </div>
          </div>
        )}
      </Card>

      {/* 发布模态框 */}
      <Modal
        title={<span className="font-black text-lg">发送新备忘录</span>}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={650}
        centered
        className="font-black"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ priority: 'normal', sendMode: 'department' }} className="pt-4">
          <div className="grid grid-cols-2 gap-6">
            <Form.Item name="title" label="备忘录标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input placeholder="输入标题..." className="font-black" />
            </Form.Item>

            <Form.Item name="priority" label="优先级">
                <Select className="font-black">
                    <Option value="low">蓝色 - 低</Option>
                    <Option value="normal">绿色 - 普通</Option>
                    <Option value="high">黄色 - 高</Option>
                    <Option value="urgent">红色 - 紧急</Option>
                </Select>
            </Form.Item>
          </div>

          <Form.Item name="sendMode" label="发送范围">
            <Radio.Group className="font-black">
              <Radio.Button value="department" className="px-8">部门全部人员</Radio.Button>
              <Radio.Button value="individual" className="px-8">指定个别员工</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.sendMode !== curr.sendMode}>
            {({ getFieldValue }) => {
                const mode = getFieldValue('sendMode');
                return (
                    <div className="grid grid-cols-2 gap-6">
                        <Form.Item name="targetDepartmentId" label="目标部门" rules={[{ required: true, message: '请选择部门' }]}>
                            <Select placeholder="选择部门..." className="font-black">
                                {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
                            </Select>
                        </Form.Item>
                        {mode === 'individual' && (
                            <Form.Item name="targetUserId" label="目标员工" rules={[{ required: true, message: '请选择员工' }]}>
                                <Select placeholder="搜索员工姓名..." showSearch optionFilterProp="children" className="font-black">
                                    {employees.map(e => <Option key={e.user_id} value={e.user_id}>{e.real_name} ({e.username})</Option>)}
                                </Select>
                            </Form.Item>
                        )}
                    </div>
                )
            }}
          </Form.Item>

          <Form.Item name="content" label="备忘内容" rules={[{ required: true, message: '请输入正文内容' }]}>
            <TextArea rows={6} placeholder="支持 Markdown 格式..." className="font-black" />
          </Form.Item>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
               <Button onClick={() => setCreateModalVisible(false)} className="font-black h-11 px-8">取消</Button>
               <Button type="primary" htmlType="submit" loading={submitting} className="font-black h-11 px-10 bg-slate-900">立即发送</Button>
          </div>
        </Form>
      </Modal>

      {/* 详情模态框 */}
      <Modal
         title={<span className="font-black">阅读详情: {currentMemo?.title}</span>}
         open={recipientsModalVisible}
         onCancel={() => setRecipientsModalVisible(false)}
         footer={[<Button key="close" onClick={() => setRecipientsModalVisible(false)} className="font-black h-11 px-8">确定</Button>]}
         width={800}
         centered
      >
          {currentMemo && (
              <div className="mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                 <ReactMarkdown remarkPlugins={[remarkGfm]} className="text-sm prose prose-slate max-w-none font-medium">
                    {currentMemo.content}
                 </ReactMarkdown>
              </div>
          )}
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">成员阅读状态</h4>
          <Table
            columns={recipientsColumns}
            dataSource={recipients}
            rowKey="user_id"
            pagination={{ pageSize: 5 }}
            size="small"
            className="border border-slate-100 rounded-lg overflow-hidden"
          />
      </Modal>
    </div>
    </ConfigProvider>
  )
}

export default EmployeeMemos
