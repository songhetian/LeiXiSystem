import logger from '@/utils/logger';
import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { getApiUrl } from '../utils/apiConfig'
import { 
    LayoutGrid, 
    Table as TableIcon, 
    Plus, 
    Search, 
    X, 
    RefreshCcw, 
    Briefcase, 
    Building2, 
    Info, 
    ShieldCheck,
    ArrowRight,
    ArrowLeft,
    Edit3,
    Trash2,
    CheckCircle2,
    Power,
    ShieldAlert,
    Users
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber } from 'antd';

const { Option } = Select;

function PositionManagement() {
  const [positions, setPositions] = useState([])
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([]) 
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [editingPos, setEditingPos] = useState(null)
  const [statusChangingPos, setStatusChangingPos] = useState(null)
  const [viewMode, setViewMode] = useState('card')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpPage, setJumpPage] = useState(null)
  const [searchFilters, setSearchFilters] = useState({ keyword: '', department: '' })
  
  const [formData, setFormData] = useState({ name: '', department_id: '', description: '', status: 'active' })
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({ title: '', message: '', onConfirm: null })

  useEffect(() => { fetchPositions(); fetchDepartments(); fetchEmployees(); }, [])

  const fetchPositions = async () => {
    try {
      const res = await fetch(getApiUrl('/api/positions?limit=1000'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const result = await res.json()
      setPositions(result.success ? result.data : [])
    } catch (e) { toast.error('加载职位失败'); }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(getApiUrl('/api/departments'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json(); 
      const depts = Array.isArray(data) ? data : (data.success ? data.data : [])
      setDepartments(depts.filter(d => d.status === 'active'))
    } catch (e) {}
  }

  const fetchEmployees = async () => {
    try {
      const res = await fetch(getApiUrl('/api/employees'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const result = await res.json()
      setEmployees(result.success ? result.data : (Array.isArray(result) ? result : []))
    } catch (e) { logger.error('员工同步失败'); }
  }

  const getEmployeeCount = (pos) => {
    if (!Array.isArray(employees)) return 0;
    return employees.filter(emp => {
        const isMatchId = String(emp.position_id) === String(pos.id);
        const isMatchName = emp.position_name === pos.name;
        const isActive = emp.status === 'active';
        return (isMatchId || isMatchName) && isActive;
    }).length;
  }

  const filteredPositions = useMemo(() => {
    return positions.filter(pos => {
      const kw = (searchFilters.keyword || '').toLowerCase();
      const matchKW = !kw || (pos.name?.toLowerCase().includes(kw) || pos.description?.toLowerCase().includes(kw));
      const matchDept = !searchFilters.department || String(pos.department_id) === String(searchFilters.department);
      return matchKW && matchDept;
    });
  }, [searchFilters, positions])

  const totalPages = Math.ceil(filteredPositions.length / pageSize)
  const getCurrentPageData = () => filteredPositions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '' }); setCurrentPage(1); }

  const handleEdit = (pos) => { setEditingPos(pos); setFormData({ name: pos.name, department_id: pos.department_id || '', description: pos.description || '', status: pos.status }); setIsModalOpen(true); }
  
  const handleDelete = (pos) => {
    const count = getEmployeeCount(pos);
    if (count > 0) return toast.error(`安全拦截：职位 "${pos.name}" 下仍有 ${count} 名在职员工，请先移除人员关联。`);
    setConfirmDialogConfig({
      title: '删除职位节点', message: `确定要移除 "${pos.name}" 职位吗？`,
      onConfirm: async () => {
        const res = await fetch(getApiUrl(`/api/positions/${pos.id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        if ((await res.json()).success) { toast.success('已删除'); fetchPositions(); }
      }
    }); setIsConfirmDialogOpen(true);
  }

  const handleStatusChange = async (newStatus) => {
    if (!statusChangingPos) return;
    if (newStatus === 'inactive' && getEmployeeCount(statusChangingPos) > 0) {
        return toast.error(`安全拦截：职位下有在职员工，不可切换至停用状态。`);
    }
    setConfirmDialogConfig({
      title: '运行状态核准', message: `确定要将 "${statusChangingPos.name}" 切换至 ${newStatus === 'active' ? '激活' : '停用'}？`,
      onConfirm: async () => {
        const res = await fetch(getApiUrl(`/api/positions/${statusChangingPos.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ ...statusChangingPos, status: newStatus }) })
        if ((await res.json()).success) { toast.success('状态已同步'); setIsStatusModalOpen(false); fetchPositions(); }
      }
    }); setIsConfirmDialogOpen(true);
  }

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>{i}</button>)
    return pages
  }

  const resetForm = () => { setFormData({ name: '', department_id: '', description: '', status: 'active' }); setEditingPos(null); }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { 
            Select: { 
                controlOutline: 'transparent', 
                selectorBg: '#ffffff', 
                colorBorder: '#64748b', 
                colorBorderHover: '#4f46e5',
                optionSelectedBg: '#f5f3ff',
                optionSelectedColor: '#4f46e5',
                paddingSM: 12
            }, 
            Input: { 
                colorBorder: '#64748b', 
                colorBorderHover: '#4f46e5',
                activeBorderColor: '#4f46e5'
            } 
        }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left font-black">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><Briefcase size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">职位管理</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">企业职能分类与岗位编制安全管控</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setEditingPos(null); resetForm(); setIsModalOpen(true); }} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black shadow-lg flex items-center gap-2 transition-all active:scale-95 border-[1px] border-slate-800"><Plus size={16} /> 新增职位</button>
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border-[1px] border-slate-200">
                <button onClick={() => setViewMode('card')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm border-[1px] border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm border-[1px] border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><TableIcon size={18} /></button>
            </div>
            <button onClick={fetchPositions} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all border-[1px] border-indigo-200"><RefreshCcw size={18} /></button>
          </div>
        </div>

        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[300px]">
                    <div className="relative group">
                        <input type="text" placeholder="检索职位名称、关键字..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                            className="w-full h-11 pl-12 pr-4 bg-white border-[1px] border-slate-500 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm font-black" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600" size={18} />
                    </div>
                </div>
                <div className="w-[240px]">
                    <Select showSearch allowClear placeholder="🏢 所属部门筛选" className="w-full h-11 font-black"
                        value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-400 shadow-sm">重置</button>
            </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">官方职位名称</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">归属部门</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">现有人数</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">运行状态</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">操作中心</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().map(pos => {
                const empCount = getEmployeeCount(pos);
                return (
                  <tr key={pos.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-8 py-6 text-[15px] text-slate-900">{pos.name}</td>
                    <td className="px-6 py-6 text-[13px] text-slate-700">
                      <span className="bg-slate-50 px-2.5 py-1 rounded-md border-[1px] border-slate-300 text-slate-600 font-bold">{departments.find(d => String(d.id) === String(pos.department_id))?.name || '未分配'}</span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <div className={`flex items-center justify-center gap-1.5 w-fit mx-auto px-4 py-1.5 rounded-lg border-[1px] transition-all
                            ${empCount > 0 ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`}>
                            <Users size={12} /> <span className="text-[13px] font-black">{empCount} 人</span>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <button onClick={() => { setStatusChangingPos(pos); setIsStatusModalOpen(true); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-black border-[1px] transition-all ${pos.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 hover:bg-emerald-100 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-300 shadow-inner'}`}>{pos.status === 'active' ? '已激活' : '已停用'}</button>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(pos)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border-[1px] border-indigo-500 font-black text-[11px] shadow-sm"><Edit3 size={14} /> 修改</button>
                          <button onClick={() => handleDelete(pos)} className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-600 hover:text-white transition-all border-[1px] border-rose-500 font-black text-[11px] shadow-sm"><Trash2 size={14} /> 删除</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {getCurrentPageData().map(pos => {
            const empCount = getEmployeeCount(pos);
            return (
              <div key={pos.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-xl hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start mb-4">
                      <h3 className="text-[15px] font-black text-slate-900">{pos.name}</h3>
                      <button onClick={() => { setStatusChangingPos(pos); setIsStatusModalOpen(true); }} className={`px-2 py-0.5 rounded text-[10px] font-black border-[1px] ${pos.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>{pos.status === 'active' ? '激活' : '锁定'}</button>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-slate-500 mb-4"><Building2 size={14} className="text-slate-400" />{departments.find(d => String(d.id) === String(pos.department_id))?.name || '未分配部门'}</div>
                  <div className={`flex items-center justify-between gap-2 p-4 rounded-xl border-[1px] mb-6 shadow-inner transition-all
                      ${empCount > 0 ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${empCount > 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-400'}`}>
                              <Users size={14} />
                          </div>
                          <span className="text-[13px] font-black text-slate-700">在职员工</span>
                      </div>
                      <span className={`text-lg font-black ${empCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{empCount}</span>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(pos)} className="flex-1 h-10 bg-white border-[1px] border-indigo-500 text-indigo-700 text-[11px] font-black rounded-lg hover:bg-indigo-600 hover:text-white transition-all">修改</button>
                      <button onClick={() => handleDelete(pos)} className="flex-1 h-10 bg-white border-[1px] border-rose-500 text-rose-700 text-[11px] font-black rounded-lg hover:bg-rose-600 hover:text-white transition-all">删除</button>
                  </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredPositions.length > 10 && (
        <div className="mt-8 px-10 py-8 bg-slate-50/50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-4 text-left font-black">
                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共发现 <span className="text-indigo-600">{filteredPositions.length}</span> 个职位定义</span>
                <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-24 font-black" options={[8, 12, 24, 48].map(v => ({ label: `${v} 条`, value: v }))} />
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

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingPos ? '职位架构修订' : '定义新职位'}>
        <form onSubmit={async (e) => { e.preventDefault(); const res = await fetch(getApiUrl(editingPos ? `/api/positions/${editingPos.id}` : '/api/positions'), { method: editingPos ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(formData) }); if((await res.json()).success){ toast.success('同步成功'); setIsModalOpen(false); fetchPositions(); resetForm(); } }} className="space-y-6 text-left font-black">
          <div><label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">职位名称 *</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-12 px-4 border-[1px] border-slate-500 rounded-lg focus:border-indigo-500 outline-none text-[15px] font-black shadow-inner" /></div>
          <div><label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">所属部门</label><Select value={formData.department_id || undefined} onChange={v => setFormData({...formData, department_id: v})} placeholder="请选择..." className="w-full h-12 font-black" size="large">{departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select></div>
          <div><label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">详细职能说明</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full p-4 border-[1px] border-slate-500 rounded-lg focus:border-indigo-500 outline-none text-[15px] font-black resize-none shadow-inner" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-8 h-11 border-[1px] border-slate-400 text-slate-600 rounded-lg font-black uppercase text-xs hover:bg-slate-50 transition-all">取消</button><button type="submit" className="px-8 h-11 bg-slate-900 text-white rounded-lg font-black uppercase text-xs shadow-xl shadow-slate-200 hover:bg-black transition-all">保存职位</button></div>
        </form>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="职位运行状态调整">
        {statusChangingPos && <div className="space-y-6 text-left font-black">
            <div className="p-6 bg-slate-50 rounded-xl border-[1px] border-slate-400 shadow-inner"><p className="text-[10px] text-slate-500 uppercase mb-1">当前目标职位</p><h2 className="text-lg text-slate-900">{statusChangingPos.name}</h2></div>
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border-[1px] border-amber-400 shadow-sm"><ShieldAlert className="text-amber-600 shrink-0" size={20} /><p className="text-xs text-amber-800 leading-relaxed">变更状态将同步关联成员权限，停用前必须确保在职人数为 0。</p></div>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleStatusChange('active')} className={`p-6 border-[1px] rounded-2xl transition-all ${statusChangingPos.status === 'active' ? 'border-emerald-600 bg-emerald-50 shadow-md scale-[1.02]' : 'border-slate-400 hover:border-emerald-500'}`}><Power size={24} className="mx-auto mb-3 text-emerald-600" /><div className="text-sm">立即激活</div></button>
                <button onClick={() => handleStatusChange('inactive')} className={`p-6 border-[1px] rounded-2xl transition-all ${statusChangingPos.status === 'inactive' ? 'border-rose-600 bg-rose-50 shadow-md scale-[1.02]' : 'border-slate-400 hover:border-rose-500'}`}><Power size={24} className="mx-auto mb-3 text-rose-600" /><div className="text-sm">锁定停用</div></button>
            </div>
        </div>}
      </Modal>

      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} zIndex={5000} />
    </div>
    </ConfigProvider>
  )
}

export default PositionManagement;
