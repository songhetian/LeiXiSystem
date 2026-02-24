import React, { useState, useEffect, useMemo } from 'react'
import { getBeijingDate, formatBeijingDate, getBeijingDateString, getLocalDateString } from '../utils/date'
import { toast } from 'sonner'
import { getApiUrl } from '../utils/apiConfig'
import { 
    History, 
    Search, 
    PlusCircle, 
    Download, 
    CheckCircle2, 
    Trash2, 
    Edit3, 
    Shield, 
    Star,
    X,
    Filter,
    ChevronLeft,
    ChevronRight,
    Zap,
    Users,
    ArrowRightLeft,
    TrendingUp,
    LogOut,
    ArrowUpCircle,
    ArrowLeft,
    ArrowRight,
    Calendar,
    RefreshCcw
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber } from 'antd';

function EmployeeChanges() {
  const [changes, setChanges] = useState([])
  const [filter, setFilter] = useState('all')
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [searchFilteredPositions, setSearchFilteredPositions] = useState([])

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpPage, setJumpPage] = useState(null)

  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    position: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    fetchChanges()
    fetchDepartments()
    fetchPositions()
  }, [filter])

  const fetchChanges = async () => {
    try {
      const token = localStorage.getItem('token')
      const url = filter === 'all'
        ? getApiUrl('/api/employee-changes')
        : getApiUrl(`/api/employee-changes?type=${filter}`)

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) return toast.error('数据加载失败');
      const data = await response.json()
      setChanges(data)
    } catch (e) { toast.error('网络通讯失败') }
  }

  const fetchDepartments = async () => {
    const res = await fetch(getApiUrl('/api/departments'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    const data = await res.json()
    setDepartments(data.filter(d => d.status === 'active'))
  }

  const fetchPositions = async () => {
    const res = await fetch(getApiUrl('/api/positions?limit=1000'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    const data = await res.json()
    setPositions(data.filter(p => p.status === 'active'))
  }

  useEffect(() => {
    if (searchFilters.department) {
      setSearchFilteredPositions(positions.filter(p => !p.department_id || p.department_id === parseInt(searchFilters.department)))
    } else { setSearchFilteredPositions(positions) }
  }, [searchFilters.department, positions])

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const handleSearchDepartmentChange = (val) => { setSearchFilters(prev => ({ ...prev, department: val, position: '' })); setCurrentPage(1); }
  const handleCustomDateChange = (field, value) => { if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return; setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }

  const clearFilters = () => { setSearchFilters({ keyword: '', department: '', position: '', dateFrom: '', dateTo: '' }); setFilter('all'); setCurrentPage(1); }

  const { filteredChanges, stats } = useMemo(() => {
    let filtered = [...changes]
    if (searchFilters.keyword) {
      const kw = searchFilters.keyword.toLowerCase()
      filtered = filtered.filter(c => c.real_name?.toLowerCase().includes(kw) || c.employee_no?.toLowerCase().includes(kw))
    }
    if (searchFilters.department) {
      filtered = filtered.filter(c => c.new_department_id === parseInt(searchFilters.department) || c.old_department_id === parseInt(searchFilters.department))
    }
    if (searchFilters.position) {
      filtered = filtered.filter(c => c.new_position_name === searchFilters.position || c.old_position_name === searchFilters.position)
    }
    if (searchFilters.dateFrom) filtered = filtered.filter(c => formatBeijingDate(c.change_date) >= searchFilters.dateFrom)
    if (searchFilters.dateTo) filtered = filtered.filter(c => formatBeijingDate(c.change_date) <= searchFilters.dateTo)

    const now = getBeijingDate(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear()
    return {
      filteredChanges: filtered,
      stats: {
        hire: filtered.filter(c => c.change_type === 'hire' && getBeijingDate(c.change_date).getMonth() === currentMonth && getBeijingDate(c.change_date).getFullYear() === currentYear).length,
        leave: filtered.filter(c => ['resign', 'terminate'].includes(c.change_type) && getBeijingDate(c.change_date).getMonth() === currentMonth && getBeijingDate(c.change_date).getFullYear() === currentYear).length,
        transfer: filtered.filter(c => c.change_type === 'transfer' && getBeijingDate(c.change_date).getMonth() === currentMonth && getBeijingDate(c.change_date).getFullYear() === currentYear).length,
        promotion: filtered.filter(c => c.change_type === 'promotion' && getBeijingDate(c.change_date).getMonth() === currentMonth && getBeijingDate(c.change_date).getFullYear() === currentYear).length,
        total: filtered.length
      }
    }
  }, [searchFilters, changes])

  const totalPages = Math.ceil(filteredChanges.length / pageSize)
  const getCurrentPageData = () => filteredChanges.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const getChangeTypeText = (t) => ({ hire:'入职', transfer:'调动', promotion:'晋升', resign:'辞职', terminate:'离职' }[t] || t)
  const getChangeTypeConfig = (t) => ({ hire:{bg:'bg-emerald-100',text:'text-emerald-900'}, transfer:{bg:'bg-blue-100',text:'text-blue-900'}, promotion:{bg:'bg-violet-100',text:'text-violet-900'}, resign:{bg:'bg-amber-100',text:'text-amber-900'}, terminate:{bg:'bg-rose-100',text:'text-rose-900'} }[t] || {bg:'bg-slate-100',text:'text-slate-900'})

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) {
      pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{i}</button>)
    }
    return pages
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

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44 },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900">
      {/* 1. 顶栏：商务精致 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100"><History size={26} /></div>
            <div className="flex flex-col text-left">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">变动记录追踪</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1">员工人事变动历史流水中心</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchChanges} className="h-11 bg-white border-2 border-indigo-100 text-indigo-600 font-black px-8 rounded-lg text-xs hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-2 shadow-sm"><RefreshCcw size={16} /> 刷新同步</button>
            <button onClick={() => window.open(getApiUrl('/api/export/employee-changes'), '_blank')} className="h-11 bg-indigo-600 text-white font-black px-8 rounded-lg text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"><Download size={16} /> 导出流水</button>
          </div>
        </div>

        {/* 2. 旗舰级横向整合搜索区 */}
        <div className="bg-slate-50/40 px-10 py-8">
            {/* 第一行：多维过滤 + 搜索 */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex-1 min-w-[280px] text-left">
                    <div className="relative group">
                        <input type="text" placeholder="检索姓名或工号..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                            className="w-full h-11 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                    </div>
                </div>
                <div className="w-[180px]">
                    <Select showSearch allowClear placeholder="🏢 筛选部门" className="w-full h-11 font-black" variant="borderless" style={{ border:'2px solid #e2e8f0', borderRadius:'8px', background:'#fff' }}
                        value={searchFilters.department || undefined} onChange={handleSearchDepartmentChange} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <div className="w-[180px]">
                    <Select showSearch allowClear placeholder="💼 筛选职位" className="w-full h-11 font-black" variant="borderless" style={{ border:'2px solid #e2e8f0', borderRadius:'8px', background:'#fff' }}
                        disabled={!searchFilters.department} value={searchFilters.position || undefined} onChange={v => handleSearchChange('position', v)} options={searchFilteredPositions.map(p => ({ label: p.name, value: p.name }))} />
                </div>
                <div className="w-[150px]">
                    <Select placeholder="💠 全部类型" className="w-full h-11 font-black" variant="borderless" style={{ border:'2px solid #e2e8f0', borderRadius:'8px', background:'#fff' }}
                        value={filter} onChange={setFilter} options={[{label:'💠 全部变动',value:'all'},{label:'🌱 入职记录',value:'hire'},{label:'🔄 部门调动',value:'transfer'},{label:'📈 晋升记录',value:'promotion'},{label:'🍂 员工离职',value:'terminate'}]} />
                </div>
                <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2"><X size={14} /> 重置</button>
            </div>

            {/* 第二行：日期快捷 + 自定义区间 (整合成一行) */}
            <div className="flex flex-wrap items-center justify-between gap-6 border-t border-slate-200 pt-6">
                <div className="flex items-center gap-2">
                    {[
                        { id: 'today', label: '今天', f: getLocalDateString(), t: getLocalDateString() },
                        { id: 'yesterday', label: '昨天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))), t: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))) },
                        { id: 'last7', label: '近 7 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-6))), t: getLocalDateString() },
                        { id: 'last30', label: '近 30 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-29))), t: getLocalDateString() },
                        { id: 'thisMonth', label: '本月累计', f: getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: getLocalDateString() }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => handleDateQuickSelect(btn.id)}
                            className={`h-9 px-5 rounded-lg text-[11px] font-black transition-all ${isDateActive(btn.f, btn.t) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600'}`}>
                            {btn.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 font-bold">自定义区间：</span>
                    <div className="flex items-center gap-2">
                        <input type="date" value={searchFilters.dateFrom} onChange={e => handleCustomDateChange('dateFrom', e.target.value)} className="h-10 px-4 bg-white border-2 border-slate-200 text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all" />
                        <span className="text-slate-400 font-bold">→</span>
                        <input type="date" value={searchFilters.dateTo} onChange={e => handleCustomDateChange('dateTo', e.target.value)} className="h-10 px-4 bg-white border-2 border-slate-200 text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 3. 看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[ { label: '当前结果', val: stats.total, color: 'indigo', icon: CheckCircle2 }, { label: '本月入职', val: stats.hire, color: 'emerald', icon: PlusCircle }, { label: '本月离职', val: stats.leave, color: 'rose', icon: LogOut }, { label: '本月调动', val: stats.transfer, color: 'blue', icon: ArrowRightLeft }, { label: '本月晋升', val: stats.promotion, color: 'amber', icon: TrendingUp } ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center group hover:border-indigo-400 transition-all">
                <div className={`w-10 h-10 rounded-lg bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}><item.icon size={20} /></div>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{item.label}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{item.val}</h3>
            </div>
          ))}
      </div>

      {/* 4. 主表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">变动日期</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">变动成员</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">记录类型</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">变动内容</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">备注缘由</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChanges.length === 0 ? (
                <tr><td colSpan="5" className="py-32 text-center text-slate-900 font-black tracking-widest text-xs uppercase italic">暂无相关变动记录流水</td></tr>
              ) : (
                getCurrentPageData().map((change) => {
                  const config = getChangeTypeConfig(change.change_type);
                  return (
                    <tr key={change.id} className="hover:bg-indigo-50/30 transition-all duration-300 group">
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                            <span className="text-[13px] font-black text-slate-900 tracking-tighter">{formatBeijingDate(change.change_date)}</span>
                            <span className="text-[9px] font-bold text-slate-700 uppercase mt-0.5">生效日期</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-black text-slate-700 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                            {change.real_name?.charAt(0) || '员'}
                          </div>
                          <div className="text-left">
                            <div className="text-[14px] font-black text-slate-900">{change.real_name}</div>
                            <div className="text-[10px] font-bold text-slate-700 mt-0.5 tracking-tighter">工号: {change.employee_no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${config.bg} ${config.text} border border-white/50`}>{getChangeTypeText(change.change_type)}</span>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="text-[12px] font-black text-slate-900 leading-relaxed max-w-[240px] mx-auto">
                          {change.change_type === 'hire' && <div className="flex flex-col items-center gap-1"><span className="text-slate-700 text-[10px]">入职部门</span><span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-lg text-[11px] font-bold">{change.new_department_name || '-'}</span></div>}
                          {change.change_type === 'transfer' && <div className="flex items-center justify-center gap-3"><span className="text-slate-500 line-through opacity-70 font-medium">{change.old_department_name || '-'}</span><ArrowRightLeft size={12} className="text-indigo-600" /><span className="text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg font-bold">{change.new_department_name || '-'}</span></div>}
                          {change.change_type === 'promotion' && <div className="flex items-center justify-center gap-3"><span className="text-slate-500 line-through opacity-70 font-medium">{change.old_position_name || '-'}</span><ArrowUpCircle size={12} className="text-amber-600" /><span className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg font-bold">{change.new_position_name || '-'}</span></div>}
                          {['resign', 'terminate'].includes(change.change_type) && <div className="flex flex-col items-center gap-1"><span className="text-slate-700 text-[10px]">原所属部门</span><span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded-lg text-[11px] font-bold">{change.old_department_name || '-'}</span></div>}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <Tooltip title={change.reason}><div className="text-[11px] font-black text-slate-700 max-w-[180px] mx-auto truncate italic cursor-help">{change.reason || '未填写具体原因'}</div></Tooltip>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. 分页器 */}
        {filteredChanges.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">共计 <span className="text-indigo-600">{filteredChanges.length}</span> 条流水</span>
                  <div className="h-4 w-[1px] bg-slate-300 mx-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">单页展示</span>
                  <Select size="small" value={pageSize} onChange={handlePageSizeChange} variant="borderless" className="bg-white rounded-lg shadow-sm border border-slate-300 text-[11px] font-black text-slate-900 w-24" options={[10, 20, 50, 100].map(v => ({ label: `${v} 条`, value: v }))} />
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-black text-xs"><ArrowLeft size={14} /> 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-black text-xs">下一页 <ArrowRight size={14} /></button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg"><ArrowRight size={16} /></button>
                  </div>
              </div>
          </div>
        )}
      </div>
    </div>
    </ConfigProvider>
  );
}

export default EmployeeChanges;
