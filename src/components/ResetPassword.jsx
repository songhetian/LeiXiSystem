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
import { Select, ConfigProvider, InputNumber, Modal, Button } from 'antd';

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
      title: <div className="text-lg font-black text-slate-900 flex items-center gap-2"><ShieldAlert className="text-rose-500" size={24} /> 账号安全凭证强制重置</div>,
      content: (
        <div className="py-4 space-y-3 font-black text-slate-700">
          <p className="text-[15px]">您确定要强制重置员工 <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">[{emp.real_name}]</span> 的登录密码吗？</p>
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs text-indigo-700 leading-relaxed uppercase tracking-widest font-black">
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
        style: { background: '#0f172a', color: '#fff', height: '44px', borderRadius: '8px', fontWeight: '900', border: 'none' } 
      },
      cancelButtonProps: { 
        style: { height: '44px', borderRadius: '8px', fontWeight: '900', border: '1px solid #64748b' } 
      },
      centered: true,
      width: 480,
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
      pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-[#64748b] text-slate-600 hover:border-slate-900 hover:bg-slate-50'}`}>{i}</button>)
    }
    return pages
  }

  if (loading && employees.length === 0) return <div className="flex items-center justify-center h-64 text-slate-900 font-black">系统数据加载中...</div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b' }, Input: { colorBorder: '#64748b' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left font-black">
      {/* 1. 顶栏 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><KeyRound size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">账户重置中心</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">系统登录凭证核准与密码强制重置</p>
            </div>
          </div>
          <button onClick={fetchEmployees} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all border-[1px] border-indigo-200"><RefreshCcw size={18} /></button>
        </div>

        {/* 2. 横向铺满搜索条 - 雷犀标准布局 */}
        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex items-center gap-4 w-full mb-6">
                <div className="flex-grow relative group">
                    <input type="text" placeholder="检索姓名、用户名或工号关键字..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                        className="w-full h-11 pl-12 pr-4 bg-white border-[1px] border-[#64748b] rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600" size={18} />
                </div>
                <div className="w-[300px]">
                    <Select showSearch allowClear placeholder="🏢 所属部门过滤" className="w-full h-11 font-black" variant="borderless" style={{ border:'1px solid #64748b', borderRadius:'8px', background:'#fff' }}
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
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">自定义入职周期：</span>
                    <div className="flex items-center gap-2">
                        <input type="date" value={searchFilters.dateFrom} onChange={e => handleSearchChange('dateFrom', e.target.value)} className="h-11 px-4 bg-white border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm" />
                        <span className="text-slate-400 font-black">→</span>
                        <input type="date" value={searchFilters.dateTo} onChange={e => handleSearchChange('dateTo', e.target.value)} className="h-11 px-4 bg-white border-[1px] border-[#64748b] text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 3. 员工主表 - 高轮廓 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">工号标识</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">员工实名</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">系统账号</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">所属部门</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="5" className="py-32 text-center text-slate-900 font-black tracking-widest text-[15px] uppercase italic">未发现符合条件的成员档案</td></tr>
              ) : (
                getCurrentPageData().map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-all duration-300 group">
                    <td className="px-8 py-6 text-[15px] text-slate-900">{emp.employee_no || 'NA'}</td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-black text-slate-700 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                          {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" /> : emp.real_name?.charAt(0)}
                        </div>
                        <span className="text-[15px] font-black text-slate-900">{emp.real_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-[13px] text-slate-600 tracking-tighter">@{emp.username}</td>
                    <td className="px-6 py-6 text-center">
                        <span className="bg-slate-50 border-[1px] border-[#64748b] px-3 py-1.5 rounded-md text-slate-600 font-black text-xs uppercase tracking-tighter">
                            {departments.find(d => d.id === emp.department_id)?.name || '未分配部门'}
                        </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <button onClick={() => handleQuickReset(emp)} 
                            className="flex items-center gap-1.5 mx-auto px-5 h-[44px] bg-slate-900 text-white text-[11px] font-black rounded-lg hover:bg-black transition-all border-[1px] border-slate-900 shadow-lg shadow-slate-100">
                            <Lock size={14} className="mr-1" /> 强制重置凭证
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. 分页器 - 高轮廓 */}
        <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200 rounded-b-2xl">
            <div className="flex items-center gap-4 text-left">
                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">管理共计 <span className="text-indigo-600">{totalUsers}</span> 个成员档案</span>
                <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                <Select size="small" value={pageSize} onChange={handlePageSizeChange} variant="borderless" className="bg-white rounded-lg border-[1px] border-[#64748b] text-[12px] font-black text-slate-900 w-24 shadow-sm" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
            </div>
            {totalUsers > pageSize && (
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-[1px] border-[#64748b] text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">← 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-[1px] border-[#64748b] text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">下一页 →</button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1 border-[1px] border-[#64748b]" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg shadow-slate-200"><ArrowRight size={16} /></button>
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
