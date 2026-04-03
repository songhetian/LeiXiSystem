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
    ShieldAlert,
    Users,
    Edit3,
    Trash2,
    Power
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber, Typography, Button, Space, Tag, Input } from 'antd';

const { Option } = Select;
const { Text, Title } = Typography;

function PositionManagement() {
  const [positions, setPositions] = useState([])
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([]) 
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [editingPos, setEditingPos] = useState(null)
  const [statusChangingPos, setStatusChangingPos] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  
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
    return employees.filter(emp => (String(emp.position_id) === String(pos.id) || emp.position_name === pos.name) && emp.status === 'active').length;
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
    if (getEmployeeCount(pos) > 0) return toast.error(`职位 "${pos.name}" 下仍有在职员工，无法删除。`);
    setConfirmDialogConfig({
      title: '删除职位', message: `确定要彻底移除职位 "${pos.name}" 吗？`,
      onConfirm: async () => {
        const res = await fetch(getApiUrl(`/api/positions/${pos.id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        if ((await res.json()).success) { toast.success('已移除'); fetchPositions(); }
      }
    }); setIsConfirmDialogOpen(true);
  }

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'inactive' && getEmployeeCount(statusChangingPos) > 0) return toast.error(`职位下有在职员工，不可停用。`);
    try {
      const res = await fetch(getApiUrl(`/api/positions/${statusChangingPos.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ ...statusChangingPos, status: newStatus }) })
      if ((await res.json()).success) { toast.success('状态已更新'); setIsStatusModalOpen(false); fetchPositions(); }
    } catch { toast.error('操作失败') }
  }

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-8 h-8 rounded text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-400 text-slate-700 hover:border-slate-900'}`}>{i}</button>)
    return pages
  }

  const resetForm = () => { setFormData({ name: '', department_id: '', description: '', status: 'active' }); setEditingPos(null); }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#000000', borderRadius: 6, controlHeight: 36, colorBorder: '#64748b' }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen text-left font-black">
      {/* 1. Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <Space size={16}>
            <div className="w-11 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg"><Briefcase size={22} /></div>
            <div>
                <h1 className="text-lg font-black text-slate-900 m-0">职位架构管理</h1>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">职能分类定义与岗位编制编制管控</p>
            </div>
          </Space>
          <Space>
            <Button onClick={() => { resetForm(); setIsModalOpen(true); }} type="primary" icon={<Plus size={14} />} className="font-black bg-slate-900 text-white h-9 border-none">新增职位</Button>
            <Button onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')} icon={viewMode === 'table' ? <LayoutGrid size={14} /> : <TableIcon size={14} />} className="font-black h-9 border-slate-400 text-slate-900">{viewMode === 'table' ? '卡片' : '表格'}</Button>
            <Button onClick={fetchPositions} icon={<RefreshCcw size={14} />} className="font-black h-9 border-slate-400 text-slate-900" />
          </Space>
        </div>
        <div className="bg-slate-50/40 px-6 py-4">
            <div className="flex items-center gap-3">
                <Input placeholder="检索职位..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                    className="flex-1 h-9 font-black border-slate-400" prefix={<Search size={16} className="text-slate-500" />} />
                <Select placeholder="归属部门" allowClear className="w-48 h-9 font-black" value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)}
                    options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                <Button onClick={clearFilters} className="h-9 px-6 border-slate-400 font-black">重置</Button>
            </div>
        </div>
      </div>

      {/* 2. Content */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px]">
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">官方职位名称</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">归属部门</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">在职人数</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">运行状态</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">管理决策</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().map(pos => (
                <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4"><Text className="text-[14px] font-black text-slate-900">{pos.name}</Text></td>
                  <td className="px-6 py-4"><Tag className="m-0 border-none bg-slate-100 text-slate-900 font-black">{departments.find(d => String(d.id) === String(pos.department_id))?.name || '未分配'}</Tag></td>
                  <td className="px-6 py-4">
                    <Tag className={`m-0 font-black border-none px-3 py-0.5 ${getEmployeeCount(pos) > 0 ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-50 text-slate-400'}`}>
                        <Users size={12} className="inline mr-1" /> {getEmployeeCount(pos)}
                    </Tag>
                  </td>
                  <td className="px-6 py-4">
                    <Tag onClick={() => { setStatusChangingPos(pos); setIsStatusModalOpen(true); }} className={`m-0 font-black border-none cursor-pointer ${pos.status === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-500'}`}>
                        {pos.status === 'active' ? '运行中' : '已停用'}
                    </Tag>
                  </td>
                  <td className="px-6 py-4">
                    <Space size={4}>
                      <Button size="small" icon={<Edit3 size={12} />} onClick={() => handleEdit(pos)} className="text-[11px] font-black text-blue-700 border-blue-200 bg-blue-50">编辑</Button>
                      <Button size="small" icon={<Trash2 size={12} />} onClick={() => handleDelete(pos)} className="text-[11px] font-black text-rose-700 border-rose-200 bg-rose-50">移除</Button>
                    </Space>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {getCurrentPageData().map(pos => (
            <div key={pos.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-3">
                <Title level={5} className="m-0 font-black text-slate-900">{pos.name}</Title>
                <Tag color={pos.status === 'active'?'success':'default'} className="m-0 font-black">{pos.status === 'active'?'运行中':'已停用'}</Tag>
              </div>
              <div className="flex items-center gap-2 mb-4"><Building2 size={14} className="text-slate-400" /><Text className="text-[12px] text-slate-600 font-bold">{departments.find(d => String(d.id) === String(pos.department_id))?.name || '未分配部门'}</Text></div>
              <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center mb-4">
                <Text className="text-[11px] font-black text-slate-500 uppercase">当前在职</Text>
                <Text className="text-lg font-black text-slate-900">{getEmployeeCount(pos)}</Text>
              </div>
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <Button block size="small" onClick={() => handleEdit(pos)} className="font-black text-blue-700 border-blue-200">编辑</Button>
                <Button block size="small" onClick={() => handleDelete(pos)} className="font-black text-rose-700 border-rose-200">移除</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页器 */}
      <div className="px-6 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-200 mt-4 rounded-xl">
          <Text className="text-[11px] font-black text-slate-900 uppercase">共计 <span className="text-indigo-700">{filteredPositions.length}</span> 个职位定义</Text>
          <div className="flex items-center gap-2">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 px-3 rounded-lg bg-white border border-slate-400 text-slate-900 font-black text-xs disabled:opacity-30">←</button>
              <div className="flex gap-1 mx-1">{renderPageNumbers()}</div>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 px-3 rounded-lg bg-white border border-slate-400 text-slate-900 font-black text-xs disabled:opacity-30">→</button>
              <div className="flex items-center gap-2 ml-3">
                  <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-12 h-8 rounded-lg font-black text-center pt-1 border border-slate-400" controls={false} />
                  <button onClick={handleJumpPage} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-md"><ArrowRight size={14} /></button>
              </div>
          </div>
      </div>

      {/* 3. Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingPos ? '职位修订' : '定义新职位'}>
        <form onSubmit={async (e) => { e.preventDefault(); const res = await fetch(getApiUrl(editingPos ? `/api/positions/${editingPos.id}` : '/api/positions'), { method: editingPos ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(formData) }); if((await res.json()).success){ toast.success('同步成功'); setIsModalOpen(false); fetchPositions(); resetForm(); } }} className="space-y-4 font-black">
          <div><label className="block text-[13px] font-black text-slate-700 mb-1">职位官方名称 *</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded-lg font-black text-slate-900 outline-none focus:border-slate-900" /></div>
          <div><label className="block text-[13px] font-black text-slate-700 mb-1">归属部门</label><Select value={formData.department_id || undefined} onChange={v => setFormData({...formData, department_id: v})} placeholder="请选择部门..." className="w-full h-9 font-black">{departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select></div>
          <div><label className="block text-[13px] font-black text-slate-700 mb-1">详细职能说明</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full p-3 border border-slate-300 rounded-lg font-black text-slate-900 outline-none focus:border-slate-900 resize-none" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-6 h-9 border border-slate-300 rounded-lg text-[13px] font-black text-slate-600">放弃</button><button type="submit" className="px-8 h-9 bg-slate-900 text-white rounded-lg text-[13px] font-black">确认保存</button></div>
        </form>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="职位运行状态调整">
        {statusChangingPos && <div className="space-y-6 text-left font-black">
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-400 shadow-inner"><p className="text-[10px] text-slate-500 uppercase mb-1">目标职位</p><h2 className="text-lg text-slate-900 m-0">{statusChangingPos.name}</h2></div>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleStatusChange('active')} className={`p-6 border rounded-2xl transition-all ${statusChangingPos.status === 'active' ? 'border-emerald-600 bg-emerald-50 scale-[1.02]' : 'border-slate-300 hover:border-emerald-500'}`}><Power size={24} className="mx-auto mb-3 text-emerald-600" /><div className="text-sm">立即激活</div></button>
                <button onClick={() => handleStatusChange('inactive')} className={`p-6 border rounded-2xl transition-all ${statusChangingPos.status === 'inactive' ? 'border-rose-600 bg-rose-50 scale-[1.02]' : 'border-slate-300 hover:border-rose-500'}`}><Power size={24} className="mx-auto mb-3 text-rose-600" /><div className="text-sm">锁定停用</div></button>
            </div>
        </div>}
      </Modal>

      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} zIndex={5000} />
    </div>
    </ConfigProvider>
  )
}

export default PositionManagement;
