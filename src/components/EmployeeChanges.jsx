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
    ArrowLeft,
    ArrowRight,
    Calendar,
    RefreshCcw
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber } from 'antd';

const { Option } = Select;

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

  useEffect(() => { fetchChanges(); fetchDepartments(); fetchPositions(); }, [filter])

  const fetchChanges = async () => {
    try {
      const url = filter === 'all' ? getApiUrl('/api/employee-changes') : getApiUrl(`/api/employee-changes?type=${filter}`)
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      if (response.ok) setChanges(await response.json())
    } catch (e) { toast.error('同步流水失败') }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(getApiUrl('/api/departments'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (e) {}
  }

  const fetchPositions = async () => {
    try {
      const res = await fetch(getApiUrl('/api/positions?limit=1000'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      setPositions(data.filter(p => p.status === 'active'))
    } catch (e) {}
  }

  useEffect(() => {
    if (searchFilters.department) {
      setSearchFilteredPositions(positions.filter(p => !p.department_id || String(p.department_id) === String(searchFilters.department)))
    } else { setSearchFilteredPositions(positions) }
  }, [searchFilters.department, positions])

  const { filteredChanges, stats } = useMemo(() => {
    let list = [...changes]
    if (searchFilters.keyword) {
      const kw = searchFilters.keyword.toLowerCase()
      list = list.filter(c => c.real_name?.toLowerCase().includes(kw) || c.employee_no?.toLowerCase().includes(kw))
    }
    if (searchFilters.department) {
      list = list.filter(c => String(c.new_department_id) === String(searchFilters.department) || String(c.old_department_id) === String(searchFilters.department))
    }
    if (searchFilters.position) {
      list = list.filter(c => c.new_position_name === searchFilters.position || c.old_position_name === searchFilters.position)
    }
    if (searchFilters.dateFrom) list = list.filter(c => formatBeijingDate(c.change_date) >= searchFilters.dateFrom)
    if (searchFilters.dateTo) list = list.filter(c => formatBeijingDate(c.change_date) <= searchFilters.dateTo)

    const now = getBeijingDate(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear()
    return {
      filteredChanges: list,
      stats: {
        hire: list.filter(c => c.change_type === 'hire' && getBeijingDate(c.change_date).getMonth() === currentMonth && getBeijingDate(c.change_date).getFullYear() === currentYear).length,
        leave: list.filter(c => ['resign', 'terminate'].includes(c.change_type) && getBeijingDate(c.change_date).getMonth() === currentMonth && getBeijingDate(c.change_date).getFullYear() === currentYear).length,
        total: list.length
      }
    }
  }, [searchFilters, changes])

  const totalPages = Math.ceil(filteredChanges.length / pageSize)
  const getCurrentPageData = () => filteredChanges.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '', position: '', dateFrom: '', dateTo: '' }); setFilter('all'); setCurrentPage(1); }

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

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>{i}</button>)
    return pages
  }

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
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><History size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">变动记录追踪</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">全量人事变动流水与生命周期轨迹审计</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchChanges} className="h-11 bg-white border-[1px] border-indigo-200 text-indigo-600 font-black px-8 rounded-lg text-xs hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm"><RefreshCcw size={16} /> 同步流水</button>
            <button onClick={() => window.open(getApiUrl('/api/export/employee-changes'), '_blank')} className="h-11 bg-slate-900 text-white font-black px-8 rounded-lg text-xs hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200"><Download size={16} /> 导出审计报告</button>
          </div>
        </div>

        {/* 2. 横向紧凑搜索区 - 1px 深色强轮廓 */}
        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex-1 min-w-[280px]">
                    <div className="relative group">
                        <input type="text" placeholder="检索姓名或工号关键字..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                            className="w-full h-11 pl-12 pr-4 bg-white border-[1px] border-slate-500 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600" size={18} />
                    </div>
                </div>
                <div className="w-[180px]">
                    <Select showSearch allowClear placeholder="🏢 筛选部门" className="w-full h-11 font-black"
                        value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <div className="w-[180px]">
                    <Select showSearch allowClear placeholder="💼 筛选职位" className="w-full h-11 font-black"
                        disabled={!searchFilters.department} value={searchFilters.position || undefined} onChange={v => handleSearchChange('position', v)} options={searchFilteredPositions.map(p => ({ label: p.name, value: p.name }))} />
                </div>
                <div className="w-[150px]">
                    <Select placeholder="💠 全部类型" className="w-full h-11 font-black"
                        value={filter} onChange={setFilter} options={[{label:'💠 全部记录',value:'all'},{label:'🌱 入职记录',value:'hire'},{label:'🔄 部门调动',value:'transfer'},{label:'📈 晋升记录',value:'promotion'},{label:'🍂 员工离职',value:'terminate'}]} />
                </div>
                <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-400 shadow-sm">重置</button>
            </div>

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
                            className={`h-9 px-5 rounded-lg text-[11px] font-black transition-all ${isDateActive(btn.f, btn.t) ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>
                            {btn.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-bold">自定义变动周期：</span>
                    <div className="flex items-center gap-2">
                        <input type="date" value={searchFilters.dateFrom} onChange={e => handleSearchChange('dateFrom', e.target.value)} className="h-10 px-4 bg-white border-[1px] border-slate-500 text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm" />
                        <span className="text-slate-400 font-black">→</span>
                        <input type="date" value={searchFilters.dateTo} onChange={e => handleSearchChange('dateTo', e.target.value)} className="h-10 px-4 bg-white border-[1px] border-slate-500 text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 3. 主表 - 15px/13px 字体 + 全居中 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">变动日期</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">关联成员</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">记录类型</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">核心轨迹详情</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">审核批注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="5" className="py-32 text-center text-slate-900 font-black tracking-widest text-[15px] uppercase">暂无符合条件的轨迹流水</td></tr>
              ) : (
                getCurrentPageData().map((change) => (
                  <tr key={change.id} className="hover:bg-slate-50 transition-all duration-300 group">
                    <td className="px-8 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                            <span className="text-[15px] text-slate-900 leading-tight">{formatBeijingDate(change.change_date)}</span>
                            <span className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-tighter font-bold">EFFECTIVE DATE</span>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-black text-slate-700 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                          {change.real_name?.charAt(0) || '员'}
                        </div>
                        <div className="text-left">
                          <div className="text-[15px] text-slate-900">{change.real_name}</div>
                          <div className="text-[12px] text-slate-500 mt-0.5 tracking-tighter font-bold">工号: {change.employee_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm border border-white/50
                            ${change.change_type === 'hire' ? 'bg-emerald-100 text-emerald-900' : 
                              change.change_type === 'transfer' ? 'bg-blue-100 text-blue-900' : 
                              change.change_type === 'promotion' ? 'bg-violet-100 text-violet-900' : 'bg-rose-100 text-rose-900'}`}>
                            { {hire:'核准入职', transfer:'部门调动', promotion:'职级晋升', resign:'主动辞职', terminate:'辞退离职'}[change.change_type] || change.change_type }
                        </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <div className="text-[13px] text-slate-900 leading-relaxed font-bold">
                          {change.change_type === 'transfer' && <div className="flex items-center justify-center gap-2"><span className="text-slate-400 line-through">{change.old_department_name}</span><ArrowRightLeft size={12} className="text-indigo-500" /><span>{change.new_department_name}</span></div>}
                          {change.change_type === 'promotion' && <div className="flex items-center justify-center gap-2"><span className="text-slate-400 line-through">{change.old_position_name}</span><TrendingUp size={12} className="text-amber-500" /><span>{change.new_position_name}</span></div>}
                          {change.change_type === 'hire' && <span className="bg-indigo-50 px-2 py-0.5 rounded border-[1px] border-indigo-100">归属: {change.new_department_name}</span>}
                          {['resign', 'terminate'].includes(change.change_type) && <span className="bg-rose-50 px-2 py-0.5 rounded border-[1px] border-rose-100 text-rose-700">离任部门: {change.old_department_name}</span>}
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <Tooltip title={change.reason}><div className="text-[13px] text-slate-600 max-w-[180px] mx-auto truncate font-bold cursor-help">{change.reason || '无特殊备注说明'}</div></Tooltip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. 标准化分页器 */}
        {filteredChanges.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200 rounded-b-2xl">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共发现 <span className="text-indigo-600">{filteredChanges.length}</span> 条变动轨迹记录</span>
                  <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                  <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-24 font-black" options={[10, 20, 50, 100].map(v => ({ label: `${v} 条`, value: v }))} />
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
    </div>
    </ConfigProvider>
  );
}

export default EmployeeChanges;
