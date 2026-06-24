import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { toast } from 'sonner';
import api from '../api';
import { CheckCircle, XCircle, Clock, Calendar, X, Search, Eye, Filter, RefreshCcw, Users, Plane, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { ConfigProvider, Card, Select, Button, Tag, Space, Pagination, Input, Skeleton, Empty, Modal, Avatar } from 'antd'
import { formatDate, formatDateTime } from '../utils/date'

const CompensatoryApproval = () => {
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [processing, setProcessing] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [approvalNote, setApprovalNote] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState('pending')
  const [dateFilters, setDateFilters] = useState({ created_start: '', created_end: '', schedule_start: '', schedule_end: '' })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')

  useEffect(() => { loadDepartments(); }, [])
  useEffect(() => { loadRequests(); }, [pagination.page, status, selectedDepartment]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => { if (loading === false) { setPagination(prev => ({ ...prev, page: 1 })); loadRequests(); } }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, dateFilters]);

  const loadDepartments = async () => {
    try {
      const response = await api.get('/departments/list');
      if (response.data.success) setDepartments(response.data.data.filter(d => d.status === 'active'));
    } catch (error) { logger.error('加载部门失败:', error); }
  }

  const loadRequests = async () => {
    try {
      setLoading(true)
      const params = {
        department_id: selectedDepartment,
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        created_start: dateFilters.created_start,
        created_end: dateFilters.created_end,
        schedule_start: dateFilters.schedule_start,
        schedule_end: dateFilters.schedule_end,
        status: status === 'all' ? '' : status
      };

      const response = await api.get('/compensatory/list', { params });
      if (response.data.success) {
        setRequests(response.data.data || [])
        setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }))
      }
    } catch (error) { setRequests([]); }
    finally { setLoading(false); }
  }

  const handleAction = async (action) => {
    if (action === 'reject' && !approvalNote.trim()) return toast.error('请填写拒绝理由');
    try {
      setProcessing(selectedRequest.id)
      const endpoint = `/api/compensatory/${selectedRequest.id}/${action}`;
      const response = await api.post(endpoint, { approval_note: approvalNote || (action === 'approve' ? '批准' : '拒绝') });
      if (response.data.success) {
        toast.success(`调休申请已${action === 'approve' ? '批准' : '拒绝'}`);
        setShowDetailModal(false); loadRequests();
      }
    } catch (error) { toast.error('操作失败'); }
    finally { setProcessing(null); }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      
      {/* 1. 物理缝合控制台 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2 flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-50 rounded-lg border border-slate-100 p-0.5 h-[36px]">
            {[
                { id: 'pending', label: '待处理', icon: Clock },
                { id: 'approved', label: '已通过', icon: CheckCircle },
                { id: 'rejected', label: '已驳回', icon: XCircle },
                { id: 'all', label: '全部', icon: Eye }
            ].map(tab => (
                <button key={tab.id} onClick={() => { setStatus(tab.id); setPagination(prev=>({...prev, page:1})); }}
                    className={`px-4 text-[11px] font-black rounded-md transition-all flex items-center gap-2 ${status === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <tab.icon size={12}/> {tab.label}
                </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <div className="px-3 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-100/50">
                <Users size={14} className="text-slate-400" />
            </div>
            <Select 
                placeholder="全部部门"
                allowClear
                value={selectedDepartment || undefined} 
                onChange={setSelectedDepartment}
                className="w-40 !border-none flagship-select h-full"
                bordered={false}
                options={departments.map(d => ({ label: d.name, value: d.id }))}
            />
          </div>

          <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-100 px-3 h-[36px] min-w-[150px]">
            <Search size={14} className="text-slate-300 mr-2" />
            <input 
                placeholder="搜索姓名或工号..." 
                className="w-full bg-transparent outline-none text-[11px] font-black placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button onClick={loadRequests} className="h-9 w-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-white transition-all ml-1 text-slate-400 hover:text-indigo-600"><RefreshCcw size={16}/></button>
      </div>

      {/* 2. 申请流水列表 */}
      <div className="grid gap-3">
        {loading && requests.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm text-center"><Skeleton active /></div>
        ) : requests.length === 0 ? (
            <div className="bg-white py-20 rounded-2xl border border-slate-200 border-dashed text-center">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-4">当前暂无匹配的调休审计记录</span>} />
            </div>
        ) : (
            requests.map(r => (
                <div key={r.id} className="bg-white p-4 px-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-4 min-w-[180px]">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm border-2 border-white shadow-sm">
                            {r.employee_name?.charAt(0)}
                        </div>
                        <div>
                            <div className="text-sm font-black text-slate-800">{r.employee_name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">{r.department_name} · #{r.employee_no}</div>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center gap-10 px-8">
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-slate-300 uppercase mb-1">原定班次</span>
                            <div className="text-xs font-black text-slate-700 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{formatDate(r.original_schedule_date)}</div>
                        </div>
                        <div className="flex flex-col items-center opacity-20"><ArrowRight size={16}/><span className="text-[8px] font-black mt-1 uppercase">Swap</span></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-slate-300 uppercase mb-1">调休日期</span>
                            <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 shadow-sm">{formatDate(r.new_schedule_date)}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 min-w-[220px] justify-end">
                        <div className="text-right">
                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">申请提交于</div>
                            <div className="text-[10px] font-bold text-slate-500">{formatDateTime(r.created_at)}</div>
                        </div>
                        <button onClick={() => { setSelectedRequest(r); setShowDetailModal(true); }}
                            className="h-10 px-6 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-slate-200 transition-all active:scale-95 hover:bg-black">
                            核销审计
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* 分页 */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-end pt-4">
            <Pagination size="small" current={pagination.page} pageSize={pagination.limit} total={pagination.total} showSizeChanger={false} onChange={p => setPagination(prev=>({...prev, page:p}))} />
        </div>
      )}

      {/* 详情审计弹窗：极致毛玻璃 */}
      <Modal
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={null}
        width={520}
        centered
        closable={false}
        styles={{ 
            body: { padding: 0, overflowX: 'hidden', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(30px)' },
            mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.1)' }
        }}
      >
        <div className="flex flex-col">
            <div className="px-8 py-6 border-b border-white/20 bg-white/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg"><ShieldCheck size={18}/></div>
                    <div>
                        <h2 className="text-base font-black text-slate-900">调休申请审计</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">Application Audit Log</p>
                    </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><X size={18}/></button>
            </div>

            <div className="p-8 space-y-6">
                <div className="p-5 bg-white/50 border border-white rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">申请人基本身份</div>
                    <div className="flex items-center gap-4">
                        <Avatar className="bg-indigo-100 text-indigo-600 font-black">{selectedRequest?.employee_name?.charAt(0)}</Avatar>
                        <div>
                            <div className="text-sm font-black text-slate-800">{selectedRequest?.employee_name}</div>
                            <div className="text-[10px] font-bold text-slate-400">{selectedRequest?.department_name} · #{selectedRequest?.employee_no}</div>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-white/50 border border-white rounded-2xl shadow-sm grid grid-cols-2 gap-6 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center scale-150 rotate-12"><Calendar size={120}/></div>
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">拟定交换日期</div>
                        <div className="text-xs font-black text-slate-700">{formatDate(selectedRequest?.original_schedule_date)}</div>
                        <div className="text-[9px] text-slate-400 font-bold mt-1">({selectedRequest?.original_shift_name || '默认班次'})</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">拟定休息日期</div>
                        <div className="text-xs font-black text-indigo-600">{formatDate(selectedRequest?.new_schedule_date)}</div>
                        <div className="text-[9px] text-indigo-300 font-bold mt-1">({selectedRequest?.new_shift_name || '调休假'})</div>
                    </div>
                </div>

                <div className="p-5 bg-white/50 border border-white rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">申请事由/备注</div>
                    <div className="text-[11px] font-bold text-slate-600 leading-relaxed italic">“ {selectedRequest?.reason || '未填写详细理由'} ”</div>
                </div>

                {selectedRequest?.status === 'pending' ? (
                    <div className="space-y-4 pt-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">审计审批决策</div>
                        <textarea value={approvalNote} onChange={e=>setApprovalNote(e.target.value)} placeholder="请输入审批备注(拒绝时必填)..." rows={3}
                            className="w-full p-4 bg-white/50 border border-white rounded-2xl text-[11px] font-bold outline-none focus:border-indigo-400 transition-all resize-none shadow-inner" />
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={()=>handleAction('reject')} disabled={processing} className="h-11 rounded-xl font-black text-xs border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all uppercase">物理驳回</button>
                            <button onClick={()=>handleAction('approve')} disabled={processing} className="h-11 rounded-xl font-black text-xs bg-slate-900 text-white shadow-lg shadow-slate-200 transition-all uppercase">审核通过</button>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 bg-slate-900 rounded-3xl text-white shadow-xl">
                        <div className="text-[9px] font-black text-blue-400 uppercase mb-3">最终审计结论</div>
                        <div className="flex items-center justify-between">
                            <Tag color={selectedRequest?.status === 'approved' ? 'green' : 'red'} className="m-0 border-none font-black text-[10px] uppercase">{selectedRequest?.status === 'approved' ? '已批准' : '已驳回'}</Tag>
                            <span className="text-[10px] font-bold text-white/40">{formatDateTime(selectedRequest?.updated_at)}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 text-[11px] font-bold italic text-white/80">“ {selectedRequest?.approval_note || '无审批备注'} ”</div>
                    </div>
                )}
            </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  )
}

export default CompensatoryApproval
