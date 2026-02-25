import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import Modal from './Modal'
import { getApiUrl } from '../utils/apiConfig'
import { 
    KeyRound, 
    Search, 
    X, 
    RefreshCcw, 
    Users, 
    Building2, 
    Lock, 
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    ShieldCheck,
    UserCheck,
    Smartphone,
    Mail
} from 'lucide-react';
import { Select, ConfigProvider, Tooltip, InputNumber } from 'antd';

const { Option } = Select;

function ResetPassword() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 分页状态 - 遵循标准化规范
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10) // 默认 10 条
  const [jumpPage, setJumpPage] = useState(null)

  // 搜索条件
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: ''
  })

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [])

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
    } catch (error) {
      toast.error('获取员工列表失败')
    } finally {
      setLoading(false)
    }
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

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) return toast.error('请输入新密码');
    if (newPassword !== confirmPassword) return toast.error('两次输入的密码不一致');
    if (newPassword.length < 6) return toast.error('密码长度至少6位');

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${selectedEmployee.id}/reset-password`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      })

      if (response.ok) {
        toast.success('账户密码已重置成功');
        setIsModalOpen(false); setNewPassword(''); setConfirmPassword(''); setSelectedEmployee(null);
      } else {
        const data = await response.json()
        toast.error(data.message || '操作失败')
      }
    } catch (error) {
      toast.error('网络通讯失败')
    } finally {
      setLoading(false)
    }
  }

  // 搜索过滤逻辑
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const kw = searchFilters.keyword.toLowerCase();
      const matchKW = !kw || (emp.real_name?.toLowerCase().includes(kw) || emp.username?.toLowerCase().includes(kw) || emp.employee_no?.toLowerCase().includes(kw));
      const matchDept = !searchFilters.department || String(emp.department_id) === String(searchFilters.department);
      return matchKW && matchDept;
    });
  }, [searchFilters, employees])

  const totalUsers = filteredEmployees.length
  const totalPages = Math.ceil(totalUsers / pageSize)
  const getCurrentPageData = () => filteredEmployees.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '' }); setCurrentPage(1); }

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) {
      pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{i}</button>)
    }
    return pages
  }

  if (loading && employees.length === 0) return <div className="flex items-center justify-center h-64 text-slate-900 font-black">系统数据加载中...</div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44 },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left">
      {/* 1. 顶栏 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><KeyRound size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">账户重置中心</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1">系统登录凭证核准与密码强制重置</p>
            </div>
          </div>
          <button onClick={fetchEmployees} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all shadow-inner"><RefreshCcw size={18} /></button>
        </div>

        {/* 2. 横向紧凑搜索条 */}
        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex items-center gap-4 max-w-5xl">
                <div className="flex-1 relative group">
                    <input type="text" placeholder="检索姓名、用户名或工号关键字..." value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)}
                        className="w-full h-11 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                </div>
                <div className="w-[240px]">
                    <Select showSearch allowClear placeholder="🏢 所属部门过滤" className="w-full h-11 font-black" variant="borderless" style={{ border:'2px solid #e2e8f0', borderRadius:'8px', background:'#fff' }}
                        value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <button onClick={clearFilters} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100"><X size={14} /> 重置</button>
            </div>
        </div>
      </div>

      {/* 3. 员工主表：全居中 + 字体扩张 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50">
                <th className="px-8 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">工号标识</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">员工实名</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">系统账号</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">所属部门</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">账号状态</th>
                <th className="px-6 py-6 text-center text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().length === 0 ? (
                <tr><td colSpan="6" className="py-32 text-center text-slate-900 font-black tracking-widest text-[15px] uppercase italic">未发现符合条件的成员档案</td></tr>
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
                    <td className="px-6 py-6 text-[13px] text-slate-700">
                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-600">{departments.find(d => d.id === emp.department_id)?.name || '未分配'}</span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm border border-white/50
                            ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-500'}`}>
                            {emp.status === 'active' ? '正常运行' : '锁定停用'}
                        </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                        <button onClick={() => { setSelectedEmployee(emp); setIsModalOpen(true); }} 
                            className="h-9 px-6 bg-slate-900 text-white text-[11px] font-black rounded-lg hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200">
                            强制重置密码
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
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200 rounded-b-2xl">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共计发现 <span className="text-indigo-600">{totalUsers}</span> 个成员档案</span>
                  <div className="h-4 w-[1px] bg-slate-300 mx-2" />
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">每页显示</span>
                  <Select size="small" value={pageSize} onChange={handlePageSizeChange} variant="borderless" className="bg-white rounded-lg shadow-sm border border-slate-300 text-[12px] font-black text-slate-900 w-24" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 transition-all shadow-sm">← 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 transition-all shadow-sm">下一页 →</button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[11px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1 border-2 border-slate-200" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg"><ArrowRight size={16} /></button>
                  </div>
              </div>
          </div>
        )}
      </div>

      {/* 重置密码决策 Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setNewPassword(''); setConfirmPassword(''); setSelectedEmployee(null); }} title="强制重置账户凭证">
        {selectedEmployee && (
          <div className="space-y-6 text-left font-black">
            <div className="p-6 bg-slate-50 rounded-xl border-2 border-white shadow-inner">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-center text-2xl font-black text-slate-400">
                        {selectedEmployee.real_name?.charAt(0)}
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg font-black text-slate-900">{selectedEmployee.real_name}</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Personnel Account Security</p>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                <Lock size={20} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">重置操作将立即使该账户当前的登录态失效，且新密码在下次登录时必须通过安全校验。</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">定义新登录密码</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="设置至少 6 位安全字符..."
                        className="w-full h-12 px-4 border-2 border-slate-100 rounded-lg focus:border-indigo-500 outline-none text-[15px]" />
                </div>
                <div>
                    <label className="block text-[13px] text-slate-700 uppercase mb-2 tracking-widest ml-1">重复确认新密码</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="请再次键入以防误操作..."
                        className="w-full h-12 px-4 border-2 border-slate-100 rounded-lg focus:border-indigo-500 outline-none text-[15px]" />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
              <button onClick={() => setIsModalOpen(false)} className="h-11 px-8 border-2 border-slate-100 text-slate-600 rounded-lg font-black uppercase text-xs">取消操作</button>
              <button onClick={handleResetPassword} disabled={loading} className="h-11 px-8 bg-slate-900 text-white rounded-lg font-black uppercase text-xs shadow-lg hover:bg-black transition-all">确认物理重置</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </ConfigProvider>
  )
}

export default ResetPassword;
