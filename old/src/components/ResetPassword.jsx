import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import { getApiUrl } from '../utils/apiConfig'
import { formatBeijingDate, getLocalDateString } from '../utils/date'
import { 
    KeyRound, 
    Search, 
    RefreshCcw, 
    ArrowRight,
    ShieldAlert,
    UserCheck,
    CheckCircle2,
    Lock,
    Calendar
} from 'lucide-react';
import { Select, ConfigProvider, InputNumber, Modal, Button, Typography, Space, Divider } from 'antd';

const { Text, Title } = Typography;

function ResetPassword() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpPage, setJumpPage] = useState(null)

  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => { fetchEmployees(); fetchDepartments(); }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/employees'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (error) { toast.error('获取员工列表失败') } finally { setLoading(false) }
  }

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/departments'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (error) {}
  }

  const handleQuickReset = (emp) => {
    Modal.confirm({
      title: <div className="text-lg font-black text-slate-900 flex items-center gap-2"><ShieldAlert className="text-rose-600" size={24} /> 账号安全凭证强制重置</div>,
      content: (
        <div className="py-2 space-y-3 font-black text-slate-800">
          <p className="text-[14px]">您确定要强制重置员工 <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">[{emp.real_name}]</span> 的登录密码吗？</p>
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs text-indigo-900 leading-relaxed uppercase tracking-widest font-black">
                ⚠️ 执行后：<br/>
                1. 原始密码将立即失效<br/>
                2. 该用户所有在线设备将强制踢出<br/>
                3. 新密码将统一设定为：<span className="text-sm text-rose-600 font-black">123456</span>
            </p>
          </div>
        </div>
      ),
      okText: '确认强制重置',
      cancelText: '取消',
      okButtonProps: { 
        style: { background: '#0f172a', color: '#fff', height: '36px', borderRadius: '6px', fontWeight: '900', border: 'none' } 
      },
      cancelButtonProps: { 
        style: { height: '36px', borderRadius: '6px', fontWeight: '900', border: '1px solid #64748b' } 
      },
      centered: true,
      width: 440,
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(getApiUrl(`/api/users/${emp.id}/reset-password`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          })

          if (response.ok) {
            toast.success(`[${emp.real_name}] 的密码已重置为 123456`);
          } else {
            const data = await response.json()
            toast.error(data.message || '操作失败')
          }
        } catch (error) { toast.error('重置请求通讯失败') }
      }
    });
  }

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

  const filteredEmployees = useMemo(() => {
    let list = [...employees];
    if (searchFilters.keyword) {
      const kw = searchFilters.keyword.toLowerCase();
      list = list.filter(emp => emp.real_name?.toLowerCase().includes(kw) || emp.username?.toLowerCase().includes(kw) || emp.employee_no?.toLowerCase().includes(kw));
    }
    if (searchFilters.department) {
      list = list.filter(emp => String(emp.department_id) === String(searchFilters.department));
    }
    if (searchFilters.dateFrom) {
      list = list.filter(emp => {
        const d = emp.hire_date || emp.created_at;
        return d && formatBeijingDate(d) >= searchFilters.dateFrom;
      });
    }
    if (searchFilters.dateTo) {
      list = list.filter(emp => {
        const d = emp.hire_date || emp.created_at;
        return d && formatBeijingDate(d) <= searchFilters.dateTo;
      });
    }
    return list;
  }, [searchFilters, employees])

  const totalUsers = filteredEmployees.length
  const totalPages = Math.ceil(totalUsers / pageSize)
  const getCurrentPageData = () => filteredEmployees.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '', dateFrom: '', dateTo: '' }); setCurrentPage(1); }

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) {
      pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-8 h-8 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-[#64748b] text-slate-700 hover:border-slate-900 hover:bg-slate-50'}`}>{i}</button>)
    }
    return pages
  }

  if (loading && employees.length === 0) return <div className="flex items-center justify-center h-64 text-slate-900 font-black">系统数据加载中...</div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#000000', borderRadius: 6, controlHeight: 36, colorBorder: '#64748b' },
        components: { Select: { colorBorder: '#64748b' }, Input: { colorBorder: '#64748b' } }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left font-black">
      {/* 1. 顶栏 - 紧凑化 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-11 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg"><KeyRound size={22} /></div>
            <div className="flex flex-col">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">账户重置中心</h1>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mt-0.5 tracking-tighter">系统登录凭证核准与密码强制重置</p>
            </div>
          </div>
          <button onClick={fetchEmployees} className="h-9 w-9 flex items-center justify-center bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all border-[1px] border-indigo-200"><RefreshCcw size={16} /></button>
        </div>

        {/* 2. 搜索条 - 紧凑化 */}
        <div className="bg-slate-50/40 px-6 py-4">
            <div className="flex items-center gap-3 w-full mb-4">
                <div className="flex-grow relative group">
                    <input type="text" placeholder="检索姓名、账号或工号..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                        className="w-full h-9 pl-10 pr-4 bg-white border-[1px] border-[#64748b] rounded-lg text-sm font-black text-slate-900 focus:border-slate-900 transition-all shadow-sm" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                </div>
                <div className="w-[240px]">
                    <Select showSearch allowClear placeholder="🏢 部门筛选" className="w-full h-9 font-black" 
                        value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <button onClick={clearFilters} className="h-9 px-6 bg-indigo-50 text-indigo-700 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all border-[1px] border-indigo-400">重置</button>
            </div>

            <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-1.5">
                    {[
                        { id: 'today', label: '今天', f: getLocalDateString(), t: getLocalDateString() },
                        { id: 'yesterday', label: '昨天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))), t: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))) },
                        { id: 'last7', label: '近 7 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-6))), t: getLocalDateString() },
                        { id: 'last30', label: '近 30 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-29))), t: getLocalDateString() },
                        { id: 'thisMonth', label: '本月', f: getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: getLocalDateString() }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => handleDateQuickSelect(btn.id)}
                            className={`h-8 px-4 rounded-lg text-[11px] font-black transition-all ${isDateActive(btn.f, btn.t) ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-[#64748b] text-slate-700 hover:border-slate-900'}`}>
                            {btn.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">入职周期：</span>
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={searchFilters.dateFrom} onChange={e => handleSearchChange('dateFrom', e.target.value)} className="h-8 px-3 bg-white border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 rounded-lg focus:border-slate-900 outline-none shadow-sm" />
                        <span className="text-slate-400 font-black">→</span>
                        <input type="date" value={searchFilters.dateTo} onChange={e => handleSearchChange('dateTo', e.target.value)} className="h-8 px-3 bg-white border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 rounded-lg focus:border-slate-900 outline-none shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 3. 员工主表 - 压缩间距 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px]">
                <th className="px-5 py-3 text-center font-black text-slate-900 uppercase tracking-widest">工号</th>
                <th className="px-4 py-3 text-center font-black text-slate-900 uppercase tracking-widest">员工姓名</th>
                <th className="px-4 py-3 text-center font-black text-slate-900 uppercase tracking-widest">系统账号</th>
                <th className="px-4 py-3 text-center font-black text-slate-900 uppercase tracking-widest">所属部门</th>
                <th className="px-4 py-3 text-center font-black text-slate-900 uppercase tracking-widest">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="5" className="py-20 text-center text-slate-600 font-black tracking-widest text-sm uppercase">未发现符合条件的档案</td></tr>
              ) : (
                getCurrentPageData().map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-all duration-200 group">
                    <td className="px-5 py-3 text-[14px] text-slate-900">{emp.employee_no || 'NA'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 overflow-hidden border border-slate-200 shadow-sm">
                          {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" /> : emp.real_name?.charAt(0)}
                        </div>
                        <span className="text-[14px] font-black text-slate-900">{emp.real_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-700 tracking-tighter">@{emp.username}</td>
                    <td className="px-4 py-3 text-center">
                        <span className="bg-slate-100 border-[1px] border-slate-300 px-2.5 py-1 rounded-md text-slate-900 font-black text-[11px] uppercase tracking-tighter">
                            {departments.find(d => d.id === emp.department_id)?.name || '未分配部门'}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                        <button onClick={() => handleQuickReset(emp)} 
                            className="flex items-center justify-center gap-1.5 mx-auto px-4 h-8 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-black transition-all shadow-md">
                            <Lock size={12} /> 强制重置密码
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. 分页器 - 紧凑化 */}
        <div className="px-6 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
            <div className="flex items-center gap-3 text-left">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">共 <span className="text-indigo-700">{totalUsers}</span> 个成员</span>
                <div className="h-3 w-[1px] bg-slate-300 mx-1" />
                <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="bg-white rounded-md border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 w-20" options={[10, 20, 50].map(v => ({ label: `${v}条`, value: v }))} />
            </div>
            {totalUsers > pageSize && (
              <div className="flex items-center gap-2">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 px-3 rounded-lg bg-white border-[1px] border-[#64748b] text-slate-900 hover:text-indigo-700 font-black text-xs disabled:opacity-30 transition-all">←</button>
                  <div className="flex gap-1 mx-1">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 px-3 rounded-lg bg-white border-[1px] border-[#64748b] text-slate-900 hover:text-indigo-700 font-black text-xs disabled:opacity-30 transition-all">→</button>
                  <div className="flex items-center gap-2 ml-3">
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-12 h-8 rounded-lg font-black text-center" controls={false} />
                      <button onClick={handleJumpPage} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all"><ArrowRight size={14} /></button>
                  </div>
              </div>
            )}
        </div>
      </div>
    </div>
    </ConfigProvider>
  )
}

export default ResetPassword;
