import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import Modal from './Modal'
import { getApiUrl } from '../utils/apiConfig'
import { formatBeijingDate, getBeijingDateString, getLocalDateString, getBeijingDate } from '../utils/date'
import { 
    CheckCircle2, 
    XCircle, 
    Search, 
    Filter, 
    UserCheck, 
    Clock, 
    ShieldCheck, 
    AlertCircle, 
    X,
    User,
    ArrowLeft,
    ArrowRight,
    RefreshCcw,
    Calendar,
    Mail,
    Phone,
    FileText
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber } from 'antd';

const { Option } = Select;

function EmployeeApproval() {
  const [pendingUsers, setPendingUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [approvalNote, setApprovalNote] = useState('')

  const [statusFilter, setStatusFilter] = useState('pending')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpPage, setJumpPage] = useState(null)

  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => { fetchPendingUsers(); fetchDepartments(); }, [])
  useEffect(() => { fetchPendingUsers(); }, [statusFilter])

  const fetchPendingUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users-pending?status=${statusFilter}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setPendingUsers(data.data || (Array.isArray(data) ? data : []))
    } catch (error) { toast.error('加载列表失败') } finally { setLoading(false) }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(getApiUrl('/api/departments'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (e) {}
  }

  const filteredUsers = useMemo(() => {
    let list = [...pendingUsers]
    if (searchFilters.keyword) {
      const kw = searchFilters.keyword.toLowerCase()
      list = list.filter(u => u.real_name?.toLowerCase().includes(kw) || u.username?.toLowerCase().includes(kw) || u.phone?.includes(kw))
    }
    if (searchFilters.department) {
      list = list.filter(u => String(u.department_id) === String(searchFilters.department))
    }
    if (searchFilters.dateFrom) list = list.filter(u => formatBeijingDate(u.created_at) >= searchFilters.dateFrom)
    if (searchFilters.dateTo) list = list.filter(u => formatBeijingDate(u.created_at) <= searchFilters.dateTo)
    return list
  }, [searchFilters, pendingUsers])

  const totalUsers = filteredUsers.length
  const totalPages = Math.ceil(totalUsers / pageSize)
  const getCurrentPageData = () => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '', dateFrom: '', dateTo: '' }); setCurrentPage(1); }

  const handleDateQuickSelect = (type) => {
    const now = new Date(); let from = '', to = getLocalDateString(now);
    switch(type) {
      case 'today': from = to; break;
      case 'yesterday': const yest = new Date(); yest.setDate(yest.getDate() - 1); from = to = getLocalDateString(yest); break;
      case 'last7': const last7 = new Date(); last7.setDate(last7.getDate() - 6); from = getLocalDateString(last7); break;
      case 'last30': const last30 = new Date(); last30.setDate(last30.getDate() - 29); from = getLocalDateString(last30); break;
      case 'thisMonth': from = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)); break;
    }
    setSearchFilters(prev => ({ ...prev, dateFrom: from, dateTo: to })); setCurrentPage(1);
  }

  const isDateActive = (f, t) => searchFilters.dateFrom === f && searchFilters.dateTo === t;

  const handleApprove = async () => {
    if (!selectedUser) return
    try {
      const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ note: approvalNote })
      })
      if (response.ok) { toast.success('审核已通过'); setIsDetailModalOpen(false); fetchPendingUsers(); }
    } catch (e) { toast.error('操作失败') }
  }

  const handleReject = async () => {
    if (!selectedUser || !approvalNote.trim()) return toast.error('拒绝时请务必填写原因')
    try {
      const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ note: approvalNote })
      })
      if (response.ok) { toast.success('已驳回申请'); setIsDetailModalOpen(false); fetchPendingUsers(); }
    } catch (e) { toast.error('操作失败') }
  }

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>{i}</button>)
    return pages
  }

  if (loading && pendingUsers.length === 0) return <div className="flex items-center justify-center h-64 text-slate-900 font-black tracking-widest">系统数据同步中...</div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5' }, Input: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left font-black">
      {/* 1. 顶栏 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><ShieldCheck size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">入职审核中心</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">成员注册申请与生命周期权限核准</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1 shadow-inner">
            {[
                { id: 'pending', label: '待处理', color: 'amber', icon: Clock },
                { id: 'active', label: '已核准', color: 'emerald', icon: CheckCircle2 },
                { id: 'rejected', label: '已驳回', color: 'rose', icon: XCircle }
            ].map(tab => (
                <button key={tab.id} onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-black transition-all ${statusFilter === tab.id ? `bg-white text-${tab.color}-600 shadow-sm border-[1px] border-${tab.color}-200 scale-105` : 'text-slate-500 hover:text-slate-900'}`}>
                    <tab.icon size={16} /> {tab.label}
                </button>
            ))}
          </div>
        </div>

        {/* 2. 横向铺满搜索区 - 雷犀标准布局 */}
        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex items-center gap-4 w-full mb-6">
                <div className="flex-grow relative group">
                    <input type="text" placeholder="检索姓名、账号或手机号码关键字..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                        className="w-full h-11 pl-12 pr-4 bg-white border-[1px] border-slate-500 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600" size={18} />
                </div>
                <div className="w-[300px]">
                    <Select showSearch allowClear placeholder="🏢 筛选意向部门" className="w-full h-11 font-black" variant="borderless" style={{ border:'1px solid #64748b', borderRadius:'8px', background:'#fff' }}
                        value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-400 shadow-sm">重置</button>
            </div>

            <div className="flex items-center justify-between gap-6 border-t border-slate-200 pt-6">
                <div className="flex items-center gap-2">
                    {[
                        { id: 'today', label: '今天', f: getLocalDateString(), t: getLocalDateString() },
                        { id: 'yesterday', label: '昨天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))), t: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))) },
                        { id: 'last7', label: '近 7 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-6))), t: getLocalDateString() },
                        { id: 'last30', label: '近 30 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-29))), t: getLocalDateString() },
                        { id: 'thisMonth', label: '本月累计', f: getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: getLocalDateString() }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => handleDateQuickSelect(btn.id)}
                            className={`h-11 px-6 rounded-lg text-[11px] font-black transition-all ${isDateActive(btn.f, btn.t) ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-[#64748b] text-slate-600 hover:border-slate-900'}`}>
                            {btn.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">自定义申请周期：</span>
                    <div className="flex items-center gap-2">
                        <input type="date" value={searchFilters.dateFrom} onChange={e => handleSearchChange('dateFrom', e.target.value)} className="h-11 px-4 bg-white border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm" />
                        <span className="text-slate-400 font-black">→</span>
                        <input type="date" value={searchFilters.dateTo} onChange={e => handleSearchChange('dateTo', e.target.value)} className="h-11 px-4 bg-white border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 3. 申请主表 - 15px/13px 字体标准 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">申请人档案</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">意向部门</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">通讯联络</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">申请时间</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">处理状态</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">管理决策</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="6" className="py-32 text-center text-slate-900 font-black tracking-widest text-[15px] uppercase">暂无待处理的审核流水记录</td></tr>
              ) : (
                getCurrentPageData().map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-all duration-300 group">
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-black text-slate-700 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.real_name?.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="text-[15px] text-slate-900 leading-tight">{user.real_name}</div>
                          <div className="text-[12px] text-slate-500 mt-0.5 tracking-tighter">账号: {user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <span className="text-[13px] text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border-[1px] border-slate-300 font-bold">{user.department_name || '未分配'}</span>
                    </td>
                    <td className="px-6 py-6 text-center font-black">
                        <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1.5 text-[13px] text-slate-900"><Phone size={12} className="text-indigo-500" /> {user.phone || '-'}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Mail size={12} className="text-slate-400" /> {user.email || '-'}</div>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center font-black">
                        <div className="inline-flex flex-col items-center">
                            <span className="text-[13px] text-slate-900">{formatBeijingDate(user.created_at)}</span>
                            <span className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-tighter">SUBMITTED DATE</span>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm border border-white/50
                            ${user.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-300' : 
                              user.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'}`}>
                            {user.status === 'pending' ? '等待核准' : user.status === 'active' ? '核准通过' : '申请驳回'}
                        </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <button onClick={() => { setSelectedUser(user); setApprovalNote(user.approval_note || ''); setIsDetailModalOpen(true); }} 
                            className="flex items-center gap-1.5 mx-auto px-4 py-2 bg-indigo-50 text-indigo-700 text-[11px] font-black rounded-lg hover:bg-indigo-600 hover:text-white transition-all border-[1px] border-indigo-500 shadow-sm">
                            <FileText size={14} /> {statusFilter === 'pending' ? '立即审核' : '档案详情'}
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. 标准化分页器 */}
        {totalUsers > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共检索到 <span className="text-indigo-600">{totalUsers}</span> 份注册申请</span>
                  <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                  <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-24 font-black" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">← 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">下一页 →</button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1 border-[1px] border-slate-500" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg shadow-slate-200"><ArrowRight size={16} /></button>
                  </div>
              </div>
          </div>
        )}
      </div>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="入职审批决策中心">
        {selectedUser && (
          <div className="space-y-6 text-left font-black">
            <div className="p-6 bg-slate-50 rounded-xl border-[1px] border-slate-300 shadow-inner">
                <div className="flex items-center gap-5 mb-6">
                    <div className="w-16 h-16 rounded-xl bg-white border-[1px] border-slate-200 flex items-center justify-center text-2xl font-black text-slate-400">{selectedUser.real_name?.charAt(0)}</div>
                    <div className="text-left">
                        <h2 className="text-lg font-black text-slate-900">{selectedUser.real_name}</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 tracking-tighter">Personnel Application Credentials</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-left border-t border-slate-200 pt-6">
                    {[
                        { label: '注册账号', val: selectedUser.username },
                        { label: '联系方式', val: selectedUser.phone || '未填' },
                        { label: '电子邮箱', val: selectedUser.email || '未填' },
                        { label: '意向部门', val: selectedUser.department_name || '待定' },
                        { label: '提交时间', val: new Date(selectedUser.created_at).toLocaleString('zh-CN') }
                    ].map((item, idx) => (
                        <div key={idx} className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{item.label}</span>
                            <span className="text-sm font-black text-slate-800">{item.val}</span>
                        </div>
                    ))}
                </div>
            </div>

            {statusFilter === 'pending' ? (
              <div className="text-left">
                <label className="block text-[11px] font-black text-slate-700 mb-2 uppercase tracking-widest ml-1">决策批注意见</label>
                <textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} rows="3" placeholder="请填写核准通过或驳回申请的具体原因..."
                  className="w-full px-4 py-3 bg-white border-[1px] border-slate-500 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none shadow-inner"
                />
              </div>
            ) : selectedUser.approval_note && (
              <div className="text-left">
                <label className="block text-[11px] font-black text-slate-700 mb-2 uppercase tracking-widest ml-1">历次审批批注</label>
                <div className="w-full px-4 py-3 bg-slate-100 border-[1px] border-slate-300 rounded-lg text-slate-900 text-sm font-bold shadow-inner">{selectedUser.approval_note}</div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button onClick={() => setIsDetailModalOpen(false)} className="h-11 px-8 border-[1px] border-slate-400 text-slate-600 rounded-lg font-black uppercase text-xs hover:bg-slate-50 transition-all">取消</button>
              {statusFilter === 'pending' && (
                <>
                  <button onClick={handleReject} className="h-11 px-8 bg-rose-600 text-white text-xs font-black rounded-lg hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all active:scale-95 border-[1px] border-rose-500">拒绝申请</button>
                  <button onClick={handleApprove} className="h-11 px-8 bg-slate-900 text-white text-xs font-black rounded-lg hover:bg-black shadow-xl shadow-slate-200 transition-all active:scale-95 border-[1px] border-slate-800">通过核准</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
    </ConfigProvider>
  )
}

export default EmployeeApproval;
