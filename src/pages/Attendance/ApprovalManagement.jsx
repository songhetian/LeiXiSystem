import React, { useState, useEffect, useMemo } from 'react'
import axios from '../../utils/axiosConfig'
import { Table, Tag, Space, Card, Typography, Select, DatePicker, Button, ConfigProvider, Tooltip, InputNumber, Modal, Radio, Avatar } from 'antd'
import { 
    CheckCircleOutlined, 
    CloseCircleOutlined,
    ClockCircleOutlined,
    SyncOutlined,
    UnorderedListOutlined,
    LayoutOutlined,
    SearchOutlined
} from '@ant-design/icons'
import { ChevronLeft, ChevronRight, ArrowRight, Filter, ShieldCheck, Timer, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getApiUrl } from '../../utils/apiConfig'
import { motion, AnimatePresence } from 'framer-motion'

const { Option } = Select;
const { Text: AntText } = Typography;

export default function ApprovalManagement() {
  const [activeTab, setActiveTab] = useState('leave')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [approvalNote, setApprovalNote] = useState('')
  const [viewMode, setViewMode] = useState('list') 
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  // 物理分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [jumpPage, setJumpPage] = useState(null)

  const [filters, setFilters] = useState({
    status: 'pending',
    start_date: '',
    end_date: ''
  })

  useEffect(() => { fetchRecords(); }, [activeTab, currentPage, pageSize, filters]);

  const fetchRecords = async () => {
    setLoading(true)
    try {
      let endpoint = activeTab === 'leave' ? '/api/attendance/leave/records' :
                     activeTab === 'overtime' ? '/api/attendance/overtime/records' :
                     '/api/attendance/makeup/records';

      const response = await axios.get(getApiUrl(endpoint), { 
        params: { page: currentPage, limit: pageSize, ...filters } 
      })

      if (response.data.success) {
        setRecords(response.data.data || [])
        setTotal(response.data.pagination?.total || 0)
      }
    } catch (e) { toast.error('获取待办记录失败'); }
    finally { setLoading(false); }
  }

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); };
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); };
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); };
  const totalPages = Math.ceil(total / pageSize);

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-500 text-slate-600 hover:border-slate-900'}`}>{i}</button>);
    return pages;
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { text: '待处理', color: 'orange' },
      approved: { text: '已通过', color: 'green' },
      rejected: { text: '已驳回', color: 'red' },
      cancelled: { text: '已撤销', color: 'default' }
    }
    const config = map[status] || map.pending
    return <Tag color={config.color} className="font-black border-slate-500">{config.text}</Tag>
  }

  const columns = [
    {
        title: '申请人',
        key: 'employee',
        render: (_, r) => (
            <div className="flex items-center gap-3">
                <Avatar className="bg-indigo-100 text-indigo-600 font-black">{r.employee_name?.charAt(0)}</Avatar>
                <div className="flex flex-col">
                    <span className="text-[14px] font-black text-slate-900">{r.employee_name}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">APPLICANT</span>
                </div>
            </div>
        )
    },
    {
        title: '类型/详情',
        key: 'info',
        render: (_, r) => (
            <div className="flex flex-col gap-1">
                <span className="text-[13px] font-black text-slate-700">
                    {activeTab === 'leave' ? `🌴 请假 (${r.leave_type})` : activeTab === 'overtime' ? '🌙 加班申请' : '🔧 异常补卡'}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                    {activeTab === 'leave' ? `${r.start_date?.substring(0,10)} 至 ${r.end_date?.substring(0,10)}` : r.overtime_date || r.record_date}
                </span>
            </div>
        )
    },
    {
        title: '审批状态',
        dataIndex: 'status',
        key: 'status',
        align: 'center',
        render: (s) => getStatusBadge(s)
    },
    {
        title: '操作',
        key: 'action',
        align: 'right',
        render: (_, r) => (
            <div className="flex justify-end gap-2">
                {r.status === 'pending' && (
                    <>
                        <Button type="text" className="font-black text-emerald-600 hover:bg-emerald-50" onClick={() => { setConfirmAction({ record: r, approved: true }); setShowConfirmModal(true); }}>一键通过</Button>
                        <Button type="text" className="font-black text-rose-600 hover:bg-rose-50" onClick={() => { setConfirmAction({ record: r, approved: false }); setShowConfirmModal(true); }}>一键驳回</Button>
                    </>
                )}
                <Button type="text" className="font-black text-slate-400" onClick={() => { setSelectedRecord(r); setShowModal(true); }}>详情</Button>
            </div>
        )
    }
  ];

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' }
    }}>
    <div className="space-y-8 animate-in fade-in duration-500 font-black text-left">
      
      {/* 1. 业务子 Tab & 视图切换 (右侧) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex gap-8">
            {[
                { id: 'leave', label: '请假审批', icon: <Plane className="w-4 h-4" /> },
                { id: 'overtime', label: '加班审批', icon: <Timer className="w-4 h-4" /> },
                { id: 'makeup', label: '补卡审批', icon: <ShieldCheck className="w-4 h-4" /> }
            ].map(tab => (
                <button 
                    key={tab.id} 
                    onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                    className={`flex items-center gap-2 pb-4 px-2 transition-all relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="font-black text-[15px]">{tab.label}</span>
                    {activeTab === tab.id && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-indigo-600 rounded-full" />}
                </button>
            ))}
          </div>

          <div className="flex bg-white border border-slate-500 rounded-xl p-1 shadow-sm mb-2">
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                <UnorderedListOutlined /> <span>列表</span>
            </button>
            <button onClick={() => setViewMode('card')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'card' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                <LayoutOutlined /> <span>卡片</span>
            </button>
          </div>
      </div>

      {/* 2. 物理缝合搜索条 */}
      <div className="flex items-center gap-4 w-full bg-white p-0 rounded-lg shadow-sm border border-slate-500 overflow-hidden h-[44px]">
          <div className="flex shrink-0 h-full border-r border-slate-200">
            <Select 
                value={filters.status} 
                onChange={v => setFilters({...filters, status: v})}
                className="w-40 h-full flagship-select"
                bordered={false}
                options={[
                    { label: '🕒 待我审批', value: 'pending' },
                    { label: '✅ 已通过', value: 'approved' },
                    { label: '❌ 已驳回', value: 'rejected' },
                    { label: '💠 全部记录', value: 'all' }
                ]}
            />
          </div>
          <div className="flex-1 h-full">
            <div className="flex items-center h-full px-4 gap-2">
                <SearchOutlined className="text-slate-400" />
                <span className="text-[11px] text-slate-400 uppercase font-black">按时间过滤流水:</span>
                <input type="date" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})} className="bg-transparent outline-none font-black text-sm" />
                <span className="text-slate-300">→</span>
                <input type="date" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})} className="bg-transparent outline-none font-black text-sm" />
            </div>
          </div>
          <button onClick={() => setFilters({status:'pending', start_date:'', end_date:''})} className="shrink-0 h-full px-8 bg-slate-50 border-l border-slate-200 font-black text-xs text-slate-600 hover:bg-white transition-all">重置筛选</button>
      </div>

      {/* 3. 内容区 */}
      <AnimatePresence mode="wait">
        {loading ? (
            <div className="py-20 text-center"><SyncOutlined spin className="text-3xl text-indigo-600" /></div>
        ) : records.length === 0 ? (
            <div className="py-20 text-center bg-white border border-slate-500 rounded-2xl border-dashed">
                <AntText className="text-slate-400 font-black">当前业务域暂无审批流水</AntText>
            </div>
        ) : viewMode === 'list' ? (
            <Card className="rounded-2xl border-slate-500 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
                <Table columns={columns} dataSource={records} rowKey="id" pagination={false} className="flagship-table" />
                {total > pageSize && (
                    <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-500">
                        <div className="flex items-center gap-4 text-left font-black">
                            <span className="text-[12px] text-slate-900 uppercase tracking-widest">共找到 <span className="text-indigo-600">{total}</span> 条申请待办</span>
                            <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-28 font-black" options={[10, 20, 50].map(v => ({ label: `${v} 条/页`, value: v }))} />
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-10 px-5 rounded-lg bg-white border border-slate-500 text-slate-900 font-black text-xs disabled:opacity-30">← 上一页</button>
                            <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-10 px-5 rounded-lg bg-white border border-slate-500 text-slate-900 font-black text-xs disabled:opacity-30">下一页 →</button>
                            <div className="flex items-center gap-2 ml-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase">跳转</span>
                                <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-16 h-10 rounded-lg font-black border-slate-500" controls={false} />
                                <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg"><ArrowRight size={16} /></button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {records.map(r => (
                    <Card key={r.id} className="rounded-2xl border-slate-500 shadow-sm hover:border-indigo-500 transition-all p-2 font-black">
                        <div className="flex justify-between items-start mb-4">
                            <Space><Avatar className="bg-indigo-100 text-indigo-600 font-black">{r.employee_name?.charAt(0)}</Avatar><span className="text-sm">{r.employee_name}</span></Space>
                            {getStatusBadge(r.status)}
                        </div>
                        <div className="space-y-2 mb-6">
                            <div className="text-[13px]">{activeTab === 'leave' ? `🌴 请假: ${r.leave_type}` : activeTab === 'overtime' ? '🌙 加班' : '🔧 补卡'}</div>
                            <div className="text-[11px] text-slate-400">{r.start_date || r.overtime_date || r.record_date}</div>
                            <div className="p-3 bg-slate-50 rounded-lg text-xs border border-slate-100">{r.reason}</div>
                        </div>
                        <div className="flex gap-2">
                            {r.status === 'pending' && (
                                <>
                                    <Button block size="small" type="primary" className="bg-emerald-600 border-none font-black" onClick={() => { setConfirmAction({ record: r, approved: true }); setShowConfirmModal(true); }}>通过</Button>
                                    <Button block size="small" className="font-black border-rose-500 text-rose-600" onClick={() => { setConfirmAction({ record: r, approved: false }); setShowConfirmModal(true); }}>驳回</Button>
                                </>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        )}
      </AnimatePresence>

      {/* 确认模态框 */}
      <Modal
        title={<span className="font-black">审批最终确认</span>}
        open={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        footer={[
            <Button key="no" onClick={() => setShowConfirmModal(false)} className="font-black h-11 px-8">取消</Button>,
            <Button key="yes" type="primary" className={`h-11 px-10 border-none font-black ${confirmAction?.approved ? 'bg-emerald-600' : 'bg-rose-600'}`} 
                onClick={async () => {
                    const { record, approved } = confirmAction;
                    const endpoint = activeTab === 'leave' ? `/api/attendance/leave/${record.id}/approve` :
                                     activeTab === 'overtime' ? `/api/attendance/overtime/${record.id}/approve` :
                                     `/api/attendance/makeup/${record.id}/approve`;
                    try {
                        await axios.post(getApiUrl(endpoint), { approved, approval_note: '' });
                        toast.success(approved ? '✅ 审批已通过' : '❌ 申请已驳回');
                        setShowConfirmModal(false); fetchRecords();
                    } catch (e) { toast.error('操作失败'); }
                }}>
                物理执行{confirmAction?.approved ? '通过' : '驳回'}
            </Button>
        ]}
        centered
      >
        <div className="py-6 text-center">
            <div className="text-slate-500 font-bold mb-2">确定要物理执行此项审批吗？</div>
            <div className="text-lg font-black text-slate-900">{confirmAction?.record.employee_name} 的业务申请</div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  );
}

const Plane = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.2 6.7c-2.2-.4-3.5 1.3-1.8 3.3l5.5 4.5-1.5 1.5-2.7-.5c-1.1-.2-1.8.5-1.2 1.4l1.4 2.1 2.1 1.4c.9.6 1.6-.1 1.4-1.2l-.5-2.7 1.5-1.5 4.5 5.5c2 1.7 3.7.4 3.3-1.8z"/></svg>;
