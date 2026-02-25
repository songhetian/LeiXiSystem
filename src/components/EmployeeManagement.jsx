import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import Modal from './Modal'
import EmployeeDetail from './EmployeeDetail'
import EmployeeBatchOperations from './EmployeeBatchOperations'
import UserDepartmentModal from './UserDepartmentModal' 
import { getApiUrl } from '../utils/apiConfig'
import { getImageUrl } from '../utils/fileUtils'
import { formatDate, getBeijingDateString, getLocalDateString } from '../utils/date'
import { 
    Switch, 
    Select, 
    ConfigProvider, 
    InputNumber, 
    Table, 
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
    TrendingUp,
    ShieldAlert
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
    try {
      const res = await fetch(getApiUrl('/api/roles'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      if(res.ok) setRoles(await res.json())
    } catch (e) {}
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
      if (searchFilters.dateFrom) result = result.filter(e => formatDate(e.hire_date) >= searchFilters.dateFrom)
      if (searchFilters.dateTo) result = result.filter(e => formatDate(e.hire_date) <= searchFilters.dateTo)
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
      if (response.ok) { fetchEmployees(); }
    } catch (e) { toast.error('操作失败'); }
  };

  const performSubmit = async () => {
    try {
      const url = editingEmp ? getApiUrl(`/api/employees/${editingEmp.id}`) : getApiUrl('/api/employees')
      const res = await fetch(url, { method: editingEmp ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(formData) })
      if ((await res.json()).success) { toast.success('名册已更新'); setIsModalOpen(false); fetchEmployees(); resetForm(); }
    } catch (e) { toast.error('网络同步失败'); }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.real_name || !formData.phone || !formData.department_id) return toast.error('请完整填写必填项');
    if (editingEmp && formData.status !== 'active' && editingEmp.status === 'active') {
        const assetRes = await fetch(getApiUrl(`/api/assets/employee/${editingEmp.user_id}`), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const assetData = await assetRes.json();
        if (assetData.success && assetData.data?.length > 0) {
            setAssetConfirmData({ count: assetData.data.length, deviceNos: assetData.data.map(d => d.asset_no).join(', ') });
            setPendingAction(() => performSubmit); setIsAssetConfirmModalOpen(true); return;
        }
    }
    await performSubmit();
  }

  const handleStatusChange = async () => {
    if (!statusChangingEmp) return
    const perform = async () => {
        const response = await fetch(getApiUrl(`/api/employees/${statusChangingEmp.id}/status-closure`), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ status: statusChangeData.newStatus, reason: statusChangeData.reason, changeDate: statusChangeData.changeDate }) })
        if (response.ok) { toast.success('状态已更新'); setIsStatusModalOpen(false); fetchEmployees(); }
    }
    if (statusChangeData.newStatus !== 'active') {
        const assetRes = await fetch(getApiUrl(`/api/assets/employee/${statusChangingEmp.user_id}`), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const assetData = await assetRes.json();
        if (assetData.success && assetData.data?.length > 0) {
            setAssetConfirmData({ count: assetData.data.length, deviceNos: assetData.data.map(d => d.asset_no).join(', ') });
            setPendingAction(() => perform); setIsAssetConfirmModalOpen(true); return;
        }
    }
    await perform();
  }

  const handleDeleteConfirm = async () => {
    if (!deletingEmp) return
    const response = await fetch(getApiUrl(`/api/employees/${deletingEmp.id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    if (response.ok) { toast.success('成员已移除'); setIsDeleteModalOpen(false); fetchEmployees(); }
  }

  const handleBatchStatusUpdate = async () => {
    await fetch(getApiUrl('/api/employees/batch-closure'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ ids: selectedEmployeeIds, status: batchOperationType, reason: '批量操作' }) })
    toast.success('批量同步完成'); setIsBatchModalOpen(false); setSelectedEmployeeIds([]); fetchEmployees();
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onloadend = () => { setAvatarPreview(reader.result); setFormData({ ...formData, avatar: reader.result }); }; reader.readAsDataURL(file);
  }

  const handleStatusClick = (emp) => { setStatusChangingEmp(emp); setStatusChangeData({ ...statusChangeData, newStatus: emp.status, changeDate: getLocalDateString() }); setIsStatusModalOpen(true); }
  const handleEdit = (emp) => { setEditingEmp(emp); setFormData({ ...emp, role_id: emp.role_id || '' }); setAvatarPreview(emp.avatar || ''); setIsModalOpen(true); }
  const handleManageUserDepartments = (emp) => { setSelectedUserForDepartment({ ...emp, id: emp.user_id }); setIsUserDepartmentModalOpen(true); }
  const handleUserDepartmentSuccess = () => { toast.success('权限已同步'); fetchEmployees(); };
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
        components: { 
            Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5', optionSelectedBg: '#f5f3ff', optionSelectedColor: '#4f46e5', paddingSM: 12 }, 
            Input: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' } 
        }
    }}>
    <div className="p-8 font-black text-left text-slate-900">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <div className="flex flex-col text-left">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">员工名册</h1>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">企业人才档案管理与在职状态同步中心</p>
          </div>
          <div className="flex items-center gap-3">
            <EmployeeBatchOperations onImportSuccess={fetchEmployees} />
            <button onClick={() => { resetForm(); setEditingEmp(null); setIsModalOpen(true); }} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black shadow-lg flex items-center gap-2 transition-all active:scale-95 border-[1px] border-slate-800"><Plus size={16} /> 添加成员</button>
            <button onClick={handleExport} className="h-11 px-8 bg-indigo-50 text-indigo-600 font-black rounded-lg text-xs hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-200"><Download size={16} /> 下载名册</button>
            <button onClick={fetchEmployees} className="h-11 w-11 flex items-center justify-center bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-all border-[1px] border-slate-200 shadow-inner"><RefreshCcw size={18} /></button>
          </div>
        </div>

        <div className="bg-slate-50/40 px-10 py-8 space-y-6">
          {selectedEmployeeIds.length > 0 && (
            <div className="p-4 bg-slate-900 rounded-xl flex items-center justify-between px-10 animate-in shadow-xl">
              <div className="text-xs font-black text-white bg-white/10 px-4 py-1.5 rounded-full border border-white/10">已锁定 <span className="text-indigo-400">{selectedEmployeeIds.length}</span> 名成员</div>
              <div className="flex gap-2">
                <button onClick={() => { setBatchOperationType('active'); setIsBatchModalOpen(true); }} className="h-9 px-6 bg-emerald-600 text-white font-black rounded-lg text-[11px] hover:bg-emerald-500 border-[1px] border-emerald-400">一键激活</button>
                <button onClick={() => { setBatchOperationType('inactive'); setIsBatchModalOpen(true); }} className="h-9 px-6 bg-amber-600 text-white font-black rounded-lg text-[11px] hover:bg-amber-500 border-[1px] border-amber-400">批量停用</button>
                <button onClick={handleBatchLogout} className="h-9 px-6 bg-gray-700 text-white font-black rounded-lg text-[11px] hover:bg-gray-600 border-[1px] border-gray-500">强制下线</button>
                <button onClick={() => setSelectedEmployeeIds([])} className="h-9 px-6 bg-transparent text-slate-400 font-black text-[11px] hover:text-white transition-colors">取消选择</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">检索关键字</label>
              <div className="relative group">
                <input type="text" placeholder="姓名 / 工号 / 手机号..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-white border-[1px] border-slate-500 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600" size={16} />
              </div>
            </div>
            <div className="w-44">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">部门筛选</label>
              <Select showSearch allowClear placeholder="全部部门" className="w-full h-11 font-black" popupClassName="custom-flagship-select-dropdown"
                value={searchFilters.department || undefined} onChange={v => handleSearchDepartmentChange(v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
            </div>
            <div className="w-44">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">职位筛选</label>
              <Select showSearch allowClear placeholder="全部职位" className="w-full h-11 font-black" popupClassName="custom-flagship-select-dropdown"
                disabled={!searchFilters.department} value={searchFilters.position || undefined} onChange={v => handleSearchChange('position', v)} options={searchFilteredPositions.map(p => ({ label: p.name, value: p.name }))} />
            </div>
            <div className="w-36">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">运行状态</label>
              <Select placeholder="筛选状态" className="w-full h-11 font-black" popupClassName="custom-flagship-select-dropdown"
                value={searchFilters.status || undefined} onChange={v => handleSearchChange('status', v)} options={[{label:'🟢 激活在职',value:'active'},{label:'🟡 停用锁定',value:'inactive'},{label:'🔴 离职注销',value:'resigned'},{label:'⚪ 全部记录',value:''}]} />
            </div>
            <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-400 shadow-sm">重置</button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
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
                { id: 'last30', label: '近 30 天', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-29))), t: getLocalDateString() },
                { id: 'thisMonth', label: '本月累计', f: getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: getLocalDateString() }
            ].map(btn => (
                <button key={btn.id} onClick={() => { setSearchFilters({...searchFilters, dateFrom: btn.f, dateTo: btn.t}); setCurrentPage(1); }}
                    className={`h-9 px-5 rounded-lg text-[11px] font-black transition-all ${searchFilters.dateFrom === btn.f && searchFilters.dateTo === btn.t ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>
                    {btn.label}
                </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-6 py-6 text-center w-12"><input type="checkbox" checked={selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0} onChange={e => setSelectedEmployeeIds(e.target.checked ? filteredEmployees.map(e => e.id) : [])} className="w-4 h-4 rounded border-slate-400" /></th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">成员档案</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">组织部门</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">职位</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">入职日期</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">状态</th>
                <th className="px-6 py-6 text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">操作中心</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="7" className="py-32 text-center text-slate-900 font-black tracking-widest text-[15px] uppercase italic">暂无符合条件的成员记录</td></tr>
              ) : (
                getCurrentPageData().map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-all duration-300 group">
                    <td className="px-6 py-6 text-center"><input type="checkbox" checked={selectedEmployeeIds.includes(emp.id)} onChange={e => setSelectedEmployeeIds(e.target.checked ? [...selectedEmployeeIds, emp.id] : selectedEmployeeIds.filter(id => id !== emp.id))} className="w-4 h-4 rounded border-slate-400" /></td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-black text-slate-700 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                          {emp.avatar ? <img src={getImageUrl(emp.avatar)} className="w-full h-full object-cover" /> : emp.real_name?.charAt(0)}
                        </div>
                        <div className="text-left font-black">
                          <div className="text-[15px] text-slate-900 leading-tight">{emp.real_name}</div>
                          <div className="text-[12px] text-slate-500 mt-0.5 tracking-tighter">工号: {emp.employee_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center font-black">
                        <span className="text-[13px] text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border-[1px] border-slate-300">{emp.department_name}</span>
                    </td>
                    <td className="px-6 py-6 text-center font-black">
                        <span className="text-[13px] text-slate-500">{emp.position_name || '-'}</span>
                    </td>
                    <td className="px-6 py-6 text-center font-black">
                        <span className="text-[13px] text-slate-900">{formatDate(emp.hire_date)}</span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <button onClick={() => handleStatusClick(emp)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-white/50 shadow-sm
                            ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              emp.status === 'resigned' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
                            {emp.status === 'active' ? '已激活' : emp.status === 'resigned' ? '已注销' : '停用中'}
                        </button>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setViewingEmp(emp); setIsDetailOpen(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all border-[1px] border-slate-300 shadow-sm"><Layout size={16} /></button>
                            <button onClick={() => handleEdit(emp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border-[1px] border-indigo-200 font-black text-[11px] shadow-sm">修改</button>
                            <button onClick={() => handleDeleteClick(emp)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-600 hover:text-white transition-all border-[1px] border-rose-200 font-black text-[11px] shadow-sm">移除</button>
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

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingEmp ? '资料修改' : '成员录入'}>
        <form onSubmit={handleSubmit} className="space-y-4 font-black text-left">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-20 h-20 rounded-xl bg-slate-50 flex items-center justify-center text-2xl font-black text-slate-400 overflow-hidden border-[1px] border-slate-300">
              {avatarPreview ? <img src={getImageUrl(avatarPreview)} className="w-full h-full object-cover" /> : <span>{formData.real_name?.charAt(0) || '员'}</span>}
            </div>
            <div>
              <label className="px-4 py-2 bg-slate-900 text-white text-xs font-black cursor-pointer hover:bg-black inline-block rounded-lg shadow-lg">
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" /> 选择照片
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">成员姓名 *</label>
            <input type="text" required value={formData.real_name} onChange={e => setFormData({ ...formData, real_name: e.target.value })} className="w-full h-11 px-3 border-[1px] border-slate-500 rounded-lg text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">系统账号 *</label>
            <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full h-11 px-3 border-[1px] border-slate-500 rounded-lg text-sm font-black bg-slate-50 outline-none" readOnly={!!editingEmp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">联系电话 *</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full h-11 px-3 border-[1px] border-slate-500 rounded-lg text-sm font-black outline-none" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">所属部门 *</label>
            <Select value={formData.department_id || undefined} onChange={handleDepartmentChange} className="w-full h-11 font-black">{departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">职位 *</label>
            <Select value={formData.position || undefined} onChange={v => setFormData({...formData, position: v})} disabled={!formData.department_id} className="w-full h-11 font-black">{filteredPositions.map(p => <Option key={p.id} value={p.name}>{p.name}</Option>)}</Select></div>
            <div><label className="block text-[11px] text-slate-500 mb-1.5 font-black uppercase tracking-widest">入职日期</label>
            <input type="date" value={formData.hire_date} onChange={e => setFormData({ ...formData, hire_date: e.target.value })} className="w-full h-11 px-3 border-[1px] border-slate-500 rounded-lg text-sm font-black" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-6 py-2 border-[1px] border-slate-400 text-slate-600 rounded-lg font-black text-xs hover:bg-slate-50">取消</button>
            <button type="submit" className="px-8 py-2 bg-slate-900 text-white rounded-lg font-black text-xs shadow-lg hover:bg-black">保存入库</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="成员状态调整">
        <div className="space-y-4 font-black text-left">
          {statusChangingEmp && (
            <div className="p-4 bg-slate-50 border-[1px] border-slate-300 rounded-xl text-sm">
              <p><span className="text-slate-400 uppercase text-[10px] block mb-1">当前成员</span><span className="text-slate-900 font-black">{statusChangingEmp.real_name} (工号: {statusChangingEmp.employee_no})</span></p>
            </div>
          )}
          <div><label className="block text-[11px] text-slate-500 mb-1.5 uppercase font-black">目标状态 *</label>
          <Select value={statusChangeData.newStatus} onChange={v => setStatusChangeData({ ...statusChangeData, newStatus: v })} className="w-full h-11 font-black"><Option value="active">激活在职</Option><Option value="inactive">停用锁定</Option><Option value="resigned">离职注销</Option></Select></div>
          <div><label className="block text-[11px] text-slate-500 mb-1.5 uppercase font-black">变动原因</label><textarea value={statusChangeData.reason} onChange={e => setStatusChangeData({...statusChangeData, reason: e.target.value})} rows="2" className="w-full p-3 border-[1px] border-slate-500 rounded-lg text-sm font-black resize-none outline-none" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button onClick={() => setIsStatusModalOpen(false)} className="px-6 py-2 border-[1px] border-slate-400 text-slate-600 rounded-lg font-black text-xs">取消</button><button onClick={handleStatusChange} className="px-8 py-2 bg-slate-900 text-white rounded-lg font-black text-xs shadow-lg">确认修改</button></div>
        </div>
      </Modal>

      <EmployeeDetail employee={viewingEmp} isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setViewingEmp(null); }} departments={departments} />
      <UserDepartmentModal isOpen={isUserDepartmentModalOpen} onClose={() => setIsUserDepartmentModalOpen(false)} user={selectedUserForDepartment} onSuccess={handleUserDepartmentSuccess} zIndex={3000} />
      
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="移除确认">
        <div className="space-y-4 font-black text-left text-slate-900">
          <p className="text-sm">确定要从名册中永久移除该成员吗？关联资产将自动标记为待回收。</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2 border-[1px] border-slate-400 rounded-lg font-black text-xs">取消</button>
            <button onClick={handleDeleteConfirm} className="px-8 py-2 bg-rose-600 text-white rounded-lg font-black text-xs shadow-lg">确认物理移除</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="批量操作执行">
        <div className="space-y-4 font-black text-left">
          <p className="text-sm text-slate-900">确定将选中的 <span className="text-indigo-600">{selectedEmployeeIds.length}</span> 名成员批量变更为 <span className="underline">{batchOperationType === 'active' ? '在职' : '离职/停用'}</span> 状态吗？</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setIsBatchModalOpen(false)} className="px-6 py-2 border-[1px] border-slate-400 rounded-lg text-xs">取消</button>
            <button onClick={handleBatchStatusUpdate} className="px-8 py-2 bg-slate-900 text-white rounded-lg text-xs shadow-lg hover:bg-black">立即执行</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isAssetConfirmModalOpen} onClose={() => { setIsAssetConfirmModalOpen(false); setPendingAction(null); }} title="资产回收预警" size="small">
        <div className="space-y-4 font-black text-left">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center gap-3">
            <ShieldAlert size={20} /><p className="text-xs">该员工名下仍有 <span className="font-bold underline">{assetConfirmData.count}</span> 台设备。</p>
          </div>
          <p className="text-[10px] text-slate-400 italic font-bold leading-relaxed">确认后，上述资产将自动转为“闲置”并解除绑定。</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => { setIsAssetConfirmModalOpen(false); setPendingAction(null); }} className="px-6 py-2 border-[1px] border-slate-400 rounded-lg text-xs">取消操作</button>
            <button onClick={async () => { if (pendingAction) await pendingAction(); setIsAssetConfirmModalOpen(false); setPendingAction(null); }} className="px-8 py-2 bg-amber-600 text-white rounded-lg text-xs shadow-lg">确认并继续</button>
          </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  )
}

export default EmployeeManagement;
