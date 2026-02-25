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
    Power
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber } from 'antd';

const { Option } = Select;

function PositionManagement() {
  const [positions, setPositions] = useState([])
  const [departments, setDepartments] = useState([])
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

  useEffect(() => { fetchPositions(); fetchDepartments(); }, [])

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
      const data = await res.json(); const depts = Array.isArray(data) ? data : (data.success ? data.data : [])
      setDepartments(depts.filter(d => d.status === 'active'))
    } catch (e) {}
  }

  const filteredPositions = useMemo(() => {
    return positions.filter(pos => {
      const kw = searchFilters.keyword.toLowerCase();
      const matchKW = !kw || (pos.name?.toLowerCase().includes(kw) || pos.description?.toLowerCase().includes(kw));
      const matchDept = !searchFilters.department || String(pos.department_id) === String(searchFilters.department);
      return matchKW && matchDept;
    });
  }, [searchFilters, positions])

  const totalPages = Math.ceil(filteredPositions.length / pageSize)
  const getCurrentPageData = () => filteredPositions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '' }); setCurrentPage(1); }

  const handleEdit = (pos) => { setEditingPos(pos); setFormData({ name: pos.name, department_id: pos.department_id || '', description: pos.description || '', status: pos.status }); setIsModalOpen(true); }
  const handleDelete = (id) => {
    setConfirmDialogConfig({
      title: '销毁职位定义', message: '确定要删除此职位吗？该操作不可撤销。',
      onConfirm: async () => {
        const res = await fetch(getApiUrl(`/api/positions/${id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        if ((await res.json()).success) { toast.success('职位已移除'); fetchPositions(); }
      }
    }); setIsConfirmDialogOpen(true);
  }

  const handleStatusChange = async (newStatus) => {
    if (!statusChangingPos) return;
    setConfirmDialogConfig({
      title: '状态变更核准', message: `将此职位设为${newStatus === 'active' ? '启用' : '停用'}，对应的所有员工将同步更新状态。是否继续？`,
      onConfirm: async () => {
        const res = await fetch(getApiUrl(`/api/positions/${statusChangingPos.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ ...statusChangingPos, status: newStatus }) })
        const result = await res.json();
        if (result.success) { toast.success('状态已同步'); setIsStatusModalOpen(false); fetchPositions(); }
      }
    }); setIsConfirmDialogOpen(true);
  }

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) {
      pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{i}</button>)
    }
    return pages
  }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44 },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left">
      {/* 1. 顶栏 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100"><Briefcase size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">职位架构定义</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1">企业职能分类与岗位编制管控</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setEditingPos(null); setFormData({name:'', department_id:'', description:'', status:'active'}); setIsModalOpen(true); }} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black transition-all flex items-center gap-2 shadow-lg"><Plus size={16} /> 定义新岗位</button>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setViewMode('card')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><TableIcon size={18} /></button>
            </div>
            <button onClick={fetchPositions} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><RefreshCcw size={18} /></button>
          </div>
        </div>

        {/* 2. 横向紧凑搜索条 - 边框精细化 1px + 深色 */}
        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[300px]">
                    <div className="relative group">
                        <input type="text" placeholder="检索职位名称、职能描述关键字..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                            className="w-full h-11 pl-12 pr-4 bg-white border-[1px] border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                    </div>
                </div>
                <div className="w-[240px]">
                    <Select showSearch allowClear placeholder="🏢 所属部门筛选" className="w-full h-11 font-black" variant="borderless" style={{ border:'1px solid #cbd5e1', borderRadius:'8px', background:'#fff' }}
                        value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-100 shadow-sm">重置</button>
            </div>
        </div>
      </div>

      {/* 3. 视图展现：语义化色彩按钮 */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">职位官方名称</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">归属部门</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">职能说明</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">状态</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">操作中心</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().map(pos => (
                <tr key={pos.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-8 py-6 text-[15px] text-slate-900">{pos.name}</td>
                  <td className="px-6 py-6 text-[13px] text-slate-700">
                    <span className="bg-slate-50 px-2 py-1 rounded-md border-[1px] border-slate-200 text-slate-600 font-bold">{departments.find(d => d.id === pos.department_id)?.name || '未分配'}</span>
                  </td>
                  <td className="px-6 py-6 text-[13px] text-slate-600 max-w-xs truncate mx-auto">{pos.description || '-'}</td>
                  <td className="px-6 py-6 text-center">
                    <button onClick={() => { setStatusChangingPos(pos); setIsStatusModalOpen(true); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-black border-[1px] transition-all ${pos.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}>{pos.status === 'active' ? '运行中' : '已锁定'}</button>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(pos)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border-[1px] border-indigo-100 font-black text-[11px]"><Edit3 size={14} /> 修改</button>
                        <button onClick={() => handleDelete(pos.id)} className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-600 hover:text-white transition-all border-[1px] border-rose-100 font-black text-[11px]"><Trash2 size={14} /> 销毁</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {getCurrentPageData().map(pos => (
            <div key={pos.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-xl hover:border-indigo-200 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-[15px] font-black text-slate-900">{pos.name}</h3>
                    <button onClick={() => { setStatusChangingPos(pos); setIsStatusModalOpen(true); }} className={`px-2 py-0.5 rounded text-[10px] font-black border-[1px] ${pos.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{pos.status === 'active' ? 'ACTIVE' : 'LOCKED'}</button>
                </div>
                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-500 mb-4"><Building2 size={14} className="text-slate-300" />{departments.find(d => d.id === pos.department_id)?.name || '未分配部门'}</div>
                <p className="text-[13px] text-slate-600 line-clamp-2 min-h-[40px] mb-6 leading-relaxed font-bold">{pos.description || '暂无职能说明...'}</p>
                <div className="flex gap-2 pt-4 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(pos)} className="flex-1 h-10 bg-white border-[1px] border-indigo-200 text-indigo-700 text-[11px] font-black rounded-lg hover:bg-indigo-600 hover:text-white transition-all">编辑</button>
                    <button onClick={() => handleDelete(pos.id)} className="flex-1 h-10 bg-white border-[1px] border-rose-200 text-rose-700 text-[11px] font-black rounded-lg hover:bg-rose-600 hover:text-white transition-all font-black">销毁</button>
                </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. 标准化分页器 */}
      {filteredPositions.length > 10 && (
        <div className="mt-8 px-10 py-8 bg-slate-50/50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4 text-left">
                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共计发现 <span className="text-indigo-600">{filteredPositions.length}</span> 个在册职位</span>
                <div className="h-4 w-[1px] bg-slate-300 mx-2" />
                <Select size="small" value={pageSize} onChange={handlePageSizeChange} variant="borderless" className="bg-white rounded-lg border-[1px] border-slate-300 text-[12px] font-black text-slate-900 w-24 shadow-sm" options={[8, 12, 24, 48].map(v => ({ label: `${v} 项`, value: v }))} />
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-300 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 transition-all shadow-sm">← 上一页</button>
                <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-300 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 transition-all shadow-sm">下一页 →</button>
                <div className="flex items-center gap-2 ml-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                    <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1 border-[1px] border-slate-300" controls={false} />
                    <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg shadow-slate-200"><ArrowRight size={16} /></button>
                </div>
            </div>
        </div>
      )}

      {/* Modals 样式微调 */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingPos ? '职位架构修订' : '定义新职位'}>
        <form onSubmit={async (e) => { e.preventDefault(); const res = await fetch(getApiUrl(editingPos ? `/api/positions/${editingPos.id}` : '/api/positions'), { method: editingPos ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(formData) }); if((await res.json()).success){ toast.success('同步成功'); setIsModalOpen(false); fetchPositions(); resetForm(); } }} className="space-y-6 text-left font-black">
          <div><label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">职位官方名称 <span className="text-rose-500">*</span></label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-12 px-4 border-[1px] border-slate-300 rounded-lg focus:border-indigo-500 outline-none text-[15px] font-black shadow-inner" /></div>
          <div><label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">所属组织部门</label><Select value={formData.department_id || undefined} onChange={v => setFormData({...formData, department_id: v})} placeholder="请选择部门..." className="w-full h-12 font-black" size="large" style={{ border:'1px solid #d1d5db', borderRadius:'8px' }} variant="borderless">{departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select></div>
          <div><label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">职能详细说明</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full p-4 border-[1px] border-slate-300 rounded-lg focus:border-indigo-500 outline-none text-[15px] font-black resize-none shadow-inner" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-8 h-11 border-[1px] border-slate-200 text-slate-600 rounded-lg font-black uppercase text-xs hover:bg-slate-50">取消</button><button type="submit" className="px-8 h-11 bg-slate-900 text-white rounded-lg font-black uppercase text-xs shadow-xl shadow-slate-200 hover:bg-black transition-all">保存职位</button></div>
        </form>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="职位运行状态调整">
        {statusChangingPos && <div className="space-y-6 text-left font-black">
            <div className="p-6 bg-slate-50 rounded-xl border-[1px] border-slate-200 shadow-inner"><p className="text-[10px] text-slate-400 uppercase mb-1">当前目标职位</p><h2 className="text-lg text-slate-900">{statusChangingPos.name}</h2></div>
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border-[1px] border-amber-100"><ShieldAlert className="text-amber-600 shrink-0" size={20} /><p className="text-xs text-amber-800 leading-relaxed">变更职位状态将强制同步更新该岗位下所有成员的访问权限，请核实后执行。</p></div>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleStatusChange('active')} className={`p-6 border-[1px] rounded-2xl transition-all ${statusChangingPos.status === 'active' ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-emerald-300'}`}><Power size={24} className="mx-auto mb-3 text-emerald-600" /><div className="text-sm">立即启用</div></button>
                <button onClick={() => handleStatusChange('inactive')} className={`p-6 border-[1px] rounded-2xl transition-all ${statusChangingPos.status === 'inactive' ? 'border-rose-500 bg-rose-50 shadow-md' : 'border-slate-200 hover:border-rose-300'}`}><Power size={24} className="mx-auto mb-3 text-rose-600" /><div className="text-sm">锁定停用</div></button>
            </div>
        </div>}
      </Modal>

      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} zIndex={5000} />
    </div>
    </ConfigProvider>
  )
}

export default PositionManagement;
