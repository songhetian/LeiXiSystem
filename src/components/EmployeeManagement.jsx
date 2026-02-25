import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import Modal from './Modal'
import EmployeeDetail from './EmployeeDetail'
import EmployeeBatchOperations from './EmployeeBatchOperations'
import UserDepartmentModal from './UserDepartmentModal' 
import { getApiUrl } from '../utils/apiConfig'
import { getImageUrl } from '../utils/fileUtils'
import { formatDate, getBeijingDateString, getLocalDateString, getBeijingDate } from '../utils/date'
import { 
    Switch, 
    Select, 
    ConfigProvider, 
    InputNumber, 
    Table as AntdTable, 
    Tag, 
    Tooltip, 
    Badge,
    Typography,
    Button
} from 'antd'
import { 
    Plus, 
    Search, 
    X, 
    Download, 
    RefreshCcw, 
    Users, 
    UserPlus, 
    ShieldCheck, 
    CheckCircle2, 
    ArrowRight,
    ArrowLeft,
    Phone,
    Mail,
    Edit3,
    Trash2,
    Lock,
    Unlock,
    UserMinus,
    AlertCircle,
    Layout,
    Settings,
    Star,
    History,
    TrendingUp
} from 'lucide-react';

const { Option } = Select;

function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [roles, setRoles] = useState([])
  const [filteredPositions, setFilteredPositions] = useState([])
  const [searchFilteredPositions, setSearchFilteredPositions] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState(null)
  const [viewingEmp, setViewingEmp] = useState(null)
  const [deletingEmp, setDeletingEmp] = useState(null)
  const [statusChangingEmp, setStatusChangingEmp] = useState(null)
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false)
  const [managerChangingEmp, setManagerChangingEmp] = useState(null)
  const [managerChangeValue, setManagerChangeValue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusChangeData, setStatusChangeData] = useState({
    newStatus: '',
    changeDate: new Date().toISOString().split('T')[0],
    reason: ''
  })
  const [dbError, setDbError] = useState(false);
  const [dbErrorMessage, setDbErrorMessage] = useState('');

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [jumpPage, setJumpPage] = useState(null)

  const [isUserDepartmentModalOpen, setIsUserDepartmentModalOpen] = useState(false);
  const [selectedUserForDepartment, setSelectedUserForDepartment] = useState(null);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchOperationType, setBatchOperationType] = useState('');

  const [isAssetConfirmModalOpen, setIsAssetConfirmModalOpen] = useState(false);
  const [assetConfirmData, setAssetConfirmData] = useState({ count: 0, deviceNos: '' });
  const [pendingAction, setPendingAction] = useState(null);

  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    position: '',
    status: 'active',
    rating: '',
    dateFrom: '',
    dateTo: ''
  })

  const [formData, setFormData] = useState({
    employee_no: '', real_name: '', email: '', phone: '', department_id: '', position: '',
    hire_date: new Date().toISOString().split('T')[0], rating: 3, status: 'active', avatar: '',
    emergency_contact: '', emergency_phone: '', address: '', education: '', skills: '',
    remark: '', role_id: '', is_department_manager: false, username: ''
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [avatarPreview, setAvatarPreview] = useState('')

  useEffect(() => { fetchEmployees(); fetchDepartments(); fetchPositions(); fetchRoles(); }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/employees'), { headers: { 'Authorization': `Bearer ${token}` } })
      const result = await response.json();
      setEmployees(result.success ? result.data : (Array.isArray(result) ? result : []))
    } catch (e) { toast.error('同步名册失败') } finally { setLoading(false) }
  }

  const fetchDepartments = async () => {
    const res = await fetch(getApiUrl('/api/departments'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    const data = await res.json(); setDepartments(data.filter(d => d.status === 'active'))
  }

  const fetchPositions = async () => {
    const res = await fetch(getApiUrl('/api/positions?limit=1000'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    const data = await res.json(); setPositions(data.filter(p => p.status === 'active'))
  }

  const fetchRoles = async () => {
    const res = await fetch(getApiUrl('/api/roles'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    if(res.ok) setRoles(await res.json())
  }

  useEffect(() => {
    if (searchFilters.department) {
      setSearchFilteredPositions(positions.filter(p => !p.department_id || String(p.department_id) === String(searchFilters.department)))
    } else { setSearchFilteredPositions(positions) }
  }, [searchFilters.department, positions])

  useEffect(() => {
    const timer = setTimeout(() => {
      let result = [...employees]
      if (searchFilters.keyword) {
        const kw = searchFilters.keyword.toLowerCase()
        result = result.filter(e => e.real_name?.toLowerCase().includes(kw) || e.employee_no?.toLowerCase().includes(kw) || e.phone?.includes(kw))
      }
      if (searchFilters.department) result = result.filter(e => String(e.department_id) === String(searchFilters.department))
      if (searchFilters.position) result = result.filter(e => e.position === searchFilters.position)
      if (searchFilters.status) result = result.filter(e => e.status === searchFilters.status)
      setFilteredEmployees(result)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchFilters, employees])

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, val) => setSearchFilters(prev => ({ ...prev, [field]: val }))
  const handleSearchDepartmentChange = (id) => setSearchFilters(prev => ({ ...prev, department: id, position: '' }))
  const clearFilters = () => setSearchFilters({ keyword: '', department: '', position: '', status: 'active', rating: '', dateFrom: '', dateTo: '' })

  const handleDepartmentChange = (departmentId) => { setFormData({ ...formData, department_id: departmentId, position: '' }) }

  const handleExport = () => {
    let url = `/api/export/employees?`;
    const params = new URLSearchParams();
    if (searchFilters.status) params.append('status', searchFilters.status);
    if (searchFilters.department) params.append('department_id', searchFilters.department);
    if (searchFilters.keyword) params.append('keyword', searchFilters.keyword);
    window.open(getApiUrl(url + params.toString()), '_blank');
  }

  const handleManagerToggle = async (checked, emp) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${emp.user_id}/department-manager`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isDepartmentManager: checked })
      })
      if (response.ok) { toast.success('身份已同步'); fetchEmployees(); }
    } catch (e) { toast.error('操作失败'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingEmp ? getApiUrl(`/api/employees/${editingEmp.id}`) : getApiUrl('/api/employees')
      const res = await fetch(url, {
        method: editingEmp ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(formData)
      })
      const result = await res.json();
      if (result.success) { toast.success('名册已更新'); setIsModalOpen(false); fetchEmployees(); resetForm(); }
      else { toast.error(result.message || '操作失败'); }
    } catch (e) { toast.error('网络同步失败'); }
  }

  const handleStatusChange = async () => {
    if (!statusChangingEmp) return
    try {
      const response = await fetch(getApiUrl(`/api/employees/${statusChangingEmp.id}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(statusChangeData)
      })
      if (response.ok) { toast.success('状态已变更'); setIsStatusModalOpen(false); fetchEmployees(); }
    } catch (e) { toast.error('操作失败'); }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingEmp) return
    try {
      const response = await fetch(getApiUrl(`/api/employees/${deletingEmp.id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) { toast.success('成员已移除'); setIsDeleteModalOpen(false); fetchEmployees(); }
    } catch (e) { toast.error('删除失败'); }
  }

  const handleBatchStatusUpdate = async () => {
    try {
      await fetch(getApiUrl('/api/employees/batch/status'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ employeeIds: selectedEmployeeIds, status: batchOperationType })
      })
      toast.success('批量同步完成'); setIsBatchModalOpen(false); setSelectedEmployeeIds([]); fetchEmployees();
    } catch (e) { toast.error('操作失败'); }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData(); formData.append('image', file)
    try {
      const res = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      const data = await res.json();
      if (data.url) { setAvatarPreview(data.url); setFormData(prev => ({ ...prev, avatar: data.url })); }
    } catch (e) { toast.error('头像上传失败'); }
  }

  const handleStatusClick = (emp) => { setStatusChangingEmp(emp); setStatusChangeData({ ...statusChangeData, newStatus: emp.status }); setIsStatusModalOpen(true); }
  const handleEdit = (emp) => { setEditingEmp(emp); setFormData({ ...emp, role_id: emp.role_id || '' }); setAvatarPreview(emp.avatar || ''); setIsModalOpen(true); }
  const handleManageUserDepartments = (emp) => { setSelectedUserForDepartment({ ...emp, id: emp.user_id }); setIsUserDepartmentModalOpen(true); }
  const handleUserDepartmentSuccess = () => { toast.success('数据可见性已更新'); fetchEmployees(); };
  const resetForm = () => { setFormData({ employee_no: '', real_name: '', email: '', phone: '', department_id: '', position: '', hire_date: getLocalDateString(), rating: 3, status: 'active', avatar: '', emergency_contact: '', emergency_phone: '', address: '', education: '', skills: '', remark: '', role_id: '', is_department_manager: false, username: '' }); setAvatarPreview(''); setEditingEmp(null); }

  const totalPages = Math.ceil(filteredEmployees.length / pageSize)
  const getCurrentPageData = () => filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>{i}</button>)
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
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5' }, Input: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left font-black">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><Users size={26} /></div>
            <div className="flex flex-col text-left">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">员工名册</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">企业人才档案管理与在职状态实时同步</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setEditingEmp(null); resetForm(); setIsModalOpen(true); }} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black shadow-lg flex items-center gap-2 transition-all active:scale-95 border-[1px] border-slate-800"><Plus size={16} /> 添加成员</button>
            <button onClick={handleExport} className="h-11 px-8 bg-indigo-50 text-indigo-600 font-black rounded-lg text-xs hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-200"><Download size={16} /> 下载名册</button>
            <button onClick={fetchEmployees} className="h-11 w-11 flex items-center justify-center bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-all border-[1px] border-slate-200"><RefreshCcw size={18} /></button>
          </div>
        </div>

        <div className="bg-slate-50/40 px-10 py-8">
          {selectedEmployeeIds.length > 0 && (
            <div className="mb-6 p-4 bg-slate-900 rounded-xl flex items-center justify-between px-10 animate-in shadow-xl">
              <div className="text-xs font-black text-white bg-white/10 px-4 py-1.5 rounded-full border border-white/10">已锁定 <span className="text-indigo-400">{selectedEmployeeIds.length}</span> 名成员</div>
              <div className="flex gap-2">
                <button onClick={() => { setBatchOperationType('active'); setIsBatchModalOpen(true); }} className="h-9 px-6 bg-emerald-600 text-white font-black rounded-lg text-[11px] hover:bg-emerald-500 border-[1px] border-emerald-400">一键激活</button>
                <button onClick={() => { setBatchOperationType('inactive'); setIsBatchModalOpen(true); }} className="h-9 px-6 bg-amber-600 text-white font-black rounded-lg text-[11px] hover:bg-amber-500 border-[1px] border-amber-400">批量停用</button>
                <button onClick={() => setSelectedEmployeeIds([])} className="h-9 px-6 bg-transparent text-slate-400 font-black text-[11px] hover:text-white transition-colors">取消选择</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[280px]">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">检索关键字</label>
              <div className="relative group">
                <input type="text" placeholder="姓名 / 工号 / 手机号..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-white border-[1px] border-slate-500 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600" size={16} />
              </div>
            </div>
            <div className="w-44">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">部门</label>
              <Select showSearch allowClear placeholder="全部部门" className="w-full h-11 font-black"
                value={searchFilters.department || undefined} onChange={v => handleSearchDepartmentChange(v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
            </div>
            <div className="w-44">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">在职状态</label>
              <Select placeholder="筛选状态" className="w-full h-11 font-black"
                value={searchFilters.status || undefined} onChange={v => handleSearchChange('status', v)} options={[{label:'🟢 激活在职',value:'active'},{label:'🟡 锁定停用',value:'inactive'},{label:'🔴 离职注销',value:'resigned'},{label:'⚪ 全部状态',value:''}]} />
            </div>
            <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-400 shadow-sm">重置</button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">入职周期：</span>
            <div className="flex items-center gap-2">
                <input type="date" value={searchFilters.dateFrom} onChange={e => handleSearchChange('dateFrom', e.target.value)} className="h-10 px-4 bg-white border-[1px] border-slate-500 text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm font-black" />
                <span className="text-slate-400 font-black">→</span>
                <input type="date" value={searchFilters.dateTo} onChange={e => handleSearchChange('dateTo', e.target.value)} className="h-10 px-4 bg-white border-[1px] border-slate-500 text-[11px] font-black text-slate-900 rounded-lg focus:border-indigo-500 outline-none transition-all shadow-sm font-black" />
            </div>
            <div className="h-4 w-[1px] bg-slate-300 mx-2" />
            {[
                { id: 'today', label: '今天', f: getLocalDateString(), t: getLocalDateString() },
                { id: 'last7', label: '近 7 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-6))), t: getLocalDateString() },
                { id: 'thisMonth', label: '本月累计', f: getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: getLocalDateString() }
            ].map(btn => (
                <button key={btn.id} onClick={() => { setSearchFilters({...searchFilters, dateFrom: btn.f, dateTo: btn.t}); setCurrentPage(1); }}
                    className={`h-9 px-5 rounded-lg text-[11px] font-black transition-all ${searchFilters.dateFrom === btn.f && searchFilters.dateTo === btn.t ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>
                    {btn.label}
                </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-6 py-6 text-center w-12"><input type="checkbox" checked={selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0} onChange={e => setSelectedEmployeeIds(e.target.checked ? filteredEmployees.map(e => e.id) : [])} className="w-4 h-4 rounded border-slate-400" /></th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">成员信息</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">组织架构</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">入职日期</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">状态</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">操作中心</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="6" className="py-32 text-center text-slate-900 font-black tracking-widest text-[15px] uppercase">暂无符合条件的成员档案记录</td></tr>
              ) : (
                getCurrentPageData().map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-all duration-300 group">
                    <td className="px-6 py-6 text-center"><input type="checkbox" checked={selectedEmployeeIds.includes(emp.id)} onChange={e => setSelectedEmployeeIds(e.target.checked ? [...selectedEmployeeIds, emp.id] : selectedEmployeeIds.filter(id => id !== emp.id))} className="w-4 h-4 rounded border-slate-400" /></td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-black text-slate-700 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                          {emp.avatar ? <img src={getImageUrl(emp.avatar)} className="w-full h-full object-cover" /> : emp.real_name?.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="text-[15px] text-slate-900 leading-tight">{emp.real_name}</div>
                          <div className="text-[12px] text-slate-500 mt-0.5 tracking-tighter">工号: {emp.employee_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[13px] text-slate-900 font-black">{emp.department_name}</span>
                            <span className="text-[11px] text-slate-500 font-bold mt-0.5">{emp.position || '未设职位'}</span>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                            <span className="text-[13px] text-slate-900">{formatDate(emp.hire_date)}</span>
                            <span className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-tighter">HIRED DATE</span>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <button onClick={() => handleStatusClick(emp)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm border border-white/50
                            ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              emp.status === 'resigned' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
                            {emp.status === 'active' ? '已激活' : emp.status === 'resigned' ? '已注销' : '停用中'}
                        </button>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setViewingEmp(emp); setIsDetailOpen(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all border-[1px] border-slate-300 shadow-sm"><Layout size={16} /></button>
                            <button onClick={() => handleEdit(emp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border-[1px] border-indigo-200 font-black text-[11px]"><Edit3 size={14} /> 修改</button>
                            <button onClick={() => handleDeleteClick(emp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-600 hover:text-white transition-all border-[1px] border-rose-200 font-black text-[11px]"><Trash2 size={14} /> 移除</button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200 rounded-b-2xl shadow-inner">
              <div className="flex items-center gap-4 text-left font-black">
                  <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共管理 <span className="text-indigo-600">{filteredEmployees.length}</span> 名在册成员</span>
                  <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">单页展示</span>
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

      {/* --- Modals 逻辑完整性保留 --- */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingEmp ? '成员资料修订' : '添加新成员'}>
        <form onSubmit={handleSubmit} className="space-y-4 font-black text-left">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-20 h-20 rounded-xl bg-slate-50 flex items-center justify-center text-2xl font-black text-slate-400 overflow-hidden border-[1px] border-slate-300">
              {avatarPreview ? <img src={getImageUrl(avatarPreview)} className="w-full h-full object-cover" /> : <span>{formData.real_name?.charAt(0) || '员'}</span>}
            </div>
            <div>
              <label className="px-4 py-2 bg-slate-900 text-white text-xs font-black cursor-pointer hover:bg-black inline-block rounded-lg shadow-lg">
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" /> 选择照片
              </label>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">JPG/PNG, MAX 2MB</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">成员姓名 *</label>
            <input type="text" required value={formData.real_name} onChange={e => setFormData({ ...formData, real_name: e.target.value })} className="w-full px-3 py-2 border-[1px] border-slate-500 rounded-lg text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">系统账号 *</label>
            <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2 border-[1px] border-slate-500 rounded-lg text-sm font-black bg-slate-50 outline-none" readOnly={!!editingEmp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">联系电话 *</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border-[1px] border-slate-500 rounded-lg text-sm font-black outline-none" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">所属部门 *</label>
            <Select value={formData.department_id || undefined} onChange={handleDepartmentChange} className="w-full h-10 font-black">{departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-6 py-2 border-[1px] border-slate-400 text-slate-600 rounded-lg font-black text-xs">取消</button>
            <button type="submit" className="px-8 py-2 bg-slate-900 text-white rounded-lg font-black text-xs shadow-lg hover:bg-black">保存入库</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="成员运行状态调整">
        <div className="space-y-4 font-black text-left">
          {statusChangingEmp && (
            <div className="p-4 bg-slate-50 border-[1px] border-slate-300 rounded-xl text-sm">
              <p><span className="text-slate-400 uppercase text-[10px] block mb-1">当前成员</span><span className="text-slate-900 font-black">{statusChangingEmp.real_name} (工号: {statusChangingEmp.employee_no})</span></p>
            </div>
          )}
          <div><label className="block text-[11px] text-slate-500 mb-1.5 uppercase font-black">目标状态 *</label>
          <Select value={statusChangeData.newStatus} onChange={v => setStatusChangeData({ ...statusChangeData, newStatus: v })} className="w-full h-11 font-black">
            <Option value="active">激活在职</Option><Option value="inactive">停用锁定</Option><Option value="resigned">离职注销</Option>
          </Select></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setIsStatusModalOpen(false)} className="px-6 py-2 border-[1px] border-slate-400 text-slate-600 rounded-lg font-black text-xs">取消</button>
            <button onClick={handleStatusChange} className="px-8 py-2 bg-slate-900 text-white rounded-lg font-black text-xs shadow-lg">确认修改</button>
          </div>
        </div>
      </Modal>

      <EmployeeDetail employee={viewingEmp} isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setViewingEmp(null); }} departments={departments} />
      <UserDepartmentModal isOpen={isUserDepartmentModalOpen} onClose={() => setIsUserDepartmentModalOpen(false)} user={selectedUserForDepartment} onSuccess={handleUserDepartmentSuccess} zIndex={3000} />
      
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="移除成员确认">
        <div className="space-y-4 font-black text-left text-slate-900">
          <p className="text-sm">确定要从名册中永久移除以下成员吗？</p>
          <div className="p-4 bg-rose-50 border-[1px] border-rose-200 rounded-xl text-xs leading-relaxed">
            <p>姓名：{deletingEmp?.real_name}</p>
            <p>工号：{deletingEmp?.employee_no}</p>
            <p className="mt-2 font-black text-rose-700 italic">警告：此操作不可撤销，关联的所有考勤、薪资流水将被物理冻结。</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2 border-[1px] border-slate-400 rounded-lg font-black text-xs">保留</button>
            <button onClick={handleDeleteConfirm} className="px-8 py-2 bg-rose-600 text-white rounded-lg font-black text-xs shadow-lg shadow-rose-200">确认物理移除</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="批量策略执行确认">
        <div className="space-y-4 font-black text-left">
          <p className="text-sm">确定将选中的 <span className="text-indigo-600">{selectedEmployeeIds.length}</span> 名成员批量变更为 <span className="text-slate-900 underline">{batchOperationType === 'active' ? '激活' : '停用'}</span> 状态吗？</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setIsBatchModalOpen(false)} className="px-6 py-2 border-[1px] border-slate-400 rounded-lg text-xs">取消</button>
            <button onClick={handleBatchStatusUpdate} className="px-8 py-2 bg-slate-900 text-white rounded-lg text-xs shadow-lg hover:bg-black">立即执行</button>
          </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  );
}

export default EmployeeManagement;
