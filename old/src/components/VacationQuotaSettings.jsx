import React, { useState, useEffect } from 'react'
import { toast } from 'sonner';
import api from '../api';
import { Search, Save, RotateCcw, Settings, X, Users, Calendar, Filter, RefreshCcw } from 'lucide-react'
import { ConfigProvider, Select, Card, Table, Avatar, Tag, InputNumber, Button, Pagination, Empty, Skeleton, Modal } from 'antd'

const VacationQuotaSettings = () => {
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({ department_id: '', search: '', year: new Date().getFullYear() })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ annual_leave_total: 0, sick_leave_total: 0, compensatory_leave_total: 0 })
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchForm, setBatchForm] = useState({ adjustmentType: 'set', values: { annual_leave_total: '', sick_leave_total: '', compensatory_leave_total: '' }, reason: '' })

  useEffect(() => { loadDepartments(); }, [])
  useEffect(() => { loadData(); }, [filters.department_id, filters.year, pagination.page]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => { if (loading === false) { setPagination(prev => ({ ...prev, page: 1 })); loadData(); } }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const loadDepartments = async () => {
    try {
      const response = await api.get('/departments/list');
      if (response.data.success) setDepartments(response.data.data.filter(d => d.status === 'active'));
    } catch (e) {}
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const params = { year: filters.year, page: pagination.page, limit: pagination.limit, department_id: filters.department_id, search: filters.search };
      const response = await api.get('/vacation/balance/all', { params });
      if (response.data.success) {
        setEmployees(response.data.data)
        setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }))
      }
    } catch (error) { toast.error('假务数据同步失败'); }
    finally { setLoading(false); }
  }

  const handleEdit = (employee) => {
    setEditingId(employee.employee_id)
    setEditForm({ annual_leave_total: employee.annual_leave_total, sick_leave_total: employee.sick_leave_total, compensatory_leave_total: employee.compensatory_leave_total })
  }

  const handleSave = async (employee) => {
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      const response = await api.post('/vacation/balance/adjust', { employee_id: employee.employee_id, year: filters.year, adjustments: editForm, operator_id: user.id, reason: '管理员手动调整额度' });
      if (response.data.success) { toast.success('额度更新成功'); setEditingId(null); loadData(); }
    } catch (e) { toast.error('更新失败'); }
  }

  const handleBatchSave = async () => {
    if (!batchForm.reason.trim()) return toast.error('请填写调整原因');
    const hasValue = Object.values(batchForm.values).some(v => v !== '' && v !== null);
    if (!hasValue) return toast.error('请至少填写一项调整数值');

    try {
      const user = JSON.parse(localStorage.getItem('user'))
      const response = await api.post('/vacation/balance/batch-adjust', {
        filters: { department_id: filters.department_id, search: filters.search, year: filters.year },
        adjustment_type: batchForm.adjustmentType, adjustments: batchForm.values, operator_id: user.id, reason: batchForm.reason
      });
      if (response.data.success) { toast.success(`批量操作成功`); setShowBatchModal(false); setBatchForm({ adjustmentType: 'set', values: { annual_leave_total: '', sick_leave_total: '', compensatory_leave_total: '' }, reason: '' }); loadData(); }
    } catch (e) { toast.error('批量操作失败'); }
  }

  const columns = [
    {
        title: '员工名册身份',
        key: 'identity',
        render: (_, r) => (
            <div className="flex items-center gap-3">
                <Avatar size="small" className="bg-blue-50 text-blue-600 font-black">{r.real_name?.charAt(0)}</Avatar>
                <div>
                    <div className="text-[13px] font-black text-slate-800">{r.real_name}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">#{r.employee_no}</div>
                </div>
            </div>
        )
    },
    { title: '所属部门', dataIndex: 'department_name', key: 'dept', render: (t) => <span className="text-[11px] font-bold text-slate-500">{t}</span> },
    {
        title: '年假总额 (天)',
        key: 'annual',
        align: 'center',
        render: (_, r) => editingId === r.employee_id ? 
            <InputNumber size="small" step={0.5} value={editForm.annual_leave_total} onChange={v=>setEditForm({...editForm, annual_leave_total: v})} className="w-20 font-black" /> :
            <span className="text-xs font-black text-slate-700">{r.annual_leave_total}</span>
    },
    {
        title: '病假总额 (天)',
        key: 'sick',
        align: 'center',
        render: (_, r) => editingId === r.employee_id ? 
            <InputNumber size="small" step={0.5} value={editForm.sick_leave_total} onChange={v=>setEditForm({...editForm, sick_leave_total: v})} className="w-20 font-black" /> :
            <span className="text-xs font-black text-slate-700">{r.sick_leave_total}</span>
    },
    {
        title: '调休总额 (天)',
        key: 'comp',
        align: 'center',
        render: (_, r) => editingId === r.employee_id ? 
            <InputNumber size="small" step={0.5} value={editForm.compensatory_leave_total} onChange={v=>setEditForm({...editForm, compensatory_leave_total: v})} className="w-20 font-black" /> :
            <span className="text-xs font-black text-slate-700">{r.compensatory_leave_total}</span>
    },
    {
        title: '操作',
        key: 'action',
        align: 'right',
        render: (_, r) => (
            <div className="flex justify-end gap-2">
                {editingId === r.employee_id ? (
                    <>
                        <button onClick={() => handleSave(r)} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm"><Save size={14}/></button>
                        <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition-all shadow-sm"><RotateCcw size={14}/></button>
                    </>
                ) : (
                    <button onClick={() => handleEdit(r)} className="h-8 px-4 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">调整额度</button>
                )}
            </div>
        )
    }
  ];

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' },
        components: { Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900, fontSize: 12 } }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 font-black text-left">
      
      {/* 1. 物理缝合控制台 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <div className="px-3 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-100/50">
                <Calendar size={14} className="text-slate-400" />
            </div>
            <Select value={filters.year} onChange={v=>setFilters({...filters, year:v})} className="w-24 !border-none flagship-select h-full" variant="borderless"
                options={[0, 1, 2].map(i => { const y = new Date().getFullYear() - 1 + i; return { value: y, label: `${y}年` }; })} />
          </div>

          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <div className="px-3 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-100/50">
                <Users size={14} className="text-slate-400" />
            </div>
            <Select placeholder="全部部门" allowClear value={filters.department_id || undefined} onChange={v=>setFilters({...filters, department_id:v})}
                className="w-40 !border-none flagship-select h-full" variant="borderless" options={departments.map(d => ({ label: d.name, value: d.id }))} />
          </div>

          <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-100 px-3 h-[36px] min-w-[150px]">
            <Search size={14} className="text-slate-300 mr-2" />
            <input placeholder="搜索姓名或工号..." className="w-full bg-transparent outline-none text-[11px] font-black placeholder:text-slate-300"
                value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowBatchModal(true)} className="h-[36px] px-6 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-black hover:border-slate-400 transition-all shadow-sm">批量调整</button>
            <button onClick={loadData} className="h-9 w-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-white transition-all text-slate-400 hover:text-indigo-600"><RefreshCcw size={16}/></button>
          </div>
      </div>

      {/* 2. 数据表格 */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={employees} rowKey="id" loading={loading} size="small" className="flagship-table"
            pagination={{ current: pagination.page, pageSize: pagination.limit, total: pagination.total, showSizeChanger: false, size: 'small', onChange: p=>setPagination(prev=>({...prev, page:p})) }} />
      </Card>

      {/* 批量调整弹窗：极致毛玻璃 */}
      <Modal open={showBatchModal} onCancel={() => setShowBatchModal(false)} footer={null} width={520} centered closable={false}
        styles={{ body: { padding: 0, overflowX: 'hidden', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(30px)' }, mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.1)' } }}>
        <div className="flex flex-col font-black text-left">
            <div className="px-8 py-6 border-b border-white/20 bg-white/40 flex justify-between items-center text-slate-900">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg"><Settings size={18}/></div>
                    <div>
                        <h2 className="text-base font-black">批量额度调整审计</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Batch Quota Adjustment</p>
                    </div>
                </div>
                <button onClick={() => setShowBatchModal(false)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><X size={18}/></button>
            </div>

            <div className="p-8 space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] font-bold text-blue-700 leading-relaxed">
                    注意：此操作将物理影响 <span className="font-black text-blue-900">{pagination.total}</span> 位符合当前筛选条件的员工。
                </div>

                <div className="space-y-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">调整模式</div>
                    <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-100">
                        {[{id:'set',label:'设定固定值'},{id:'increase',label:'增加额度'},{id:'decrease',label:'减少额度'}].map(m=>(
                            <button key={m.id} onClick={()=>setBatchForm({...batchForm, adjustmentType:m.id})}
                                className={`flex-1 py-2 rounded-lg text-[11px] font-black transition-all ${batchForm.adjustmentType===m.id?'bg-white text-indigo-600 shadow-sm':'text-slate-400 hover:text-slate-600'}`}>
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {['annual_leave_total','sick_leave_total','compensatory_leave_total'].map(f=>(
                        <div key={f}>
                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 ml-1">{f.includes('annual')?'年假':(f.includes('sick')?'病假':'调休假')}</label>
                            <InputNumber placeholder="不调整" className="w-full font-black rounded-xl" value={batchForm.values[f]} onChange={v=>setBatchForm({...batchForm, values:{...batchForm.values, [f]:v}})} />
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">审计备注</div>
                    <textarea value={batchForm.reason} onChange={e=>setBatchForm({...batchForm, reason:e.target.value})} placeholder="请输入调整原因..." rows={3}
                        className="w-full p-4 bg-white/50 border border-white rounded-2xl text-[11px] font-bold outline-none focus:border-indigo-400 transition-all resize-none shadow-inner" />
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={()=>setShowBatchModal(false)} className="flex-1 h-11 rounded-xl font-black text-xs border border-slate-200 text-slate-500 uppercase transition-all hover:bg-slate-50">放弃操作</button>
                    <button onClick={handleBatchSave} className="flex-1 h-11 rounded-xl font-black text-xs bg-slate-900 text-white shadow-lg shadow-slate-200 transition-all active:scale-95 uppercase">物理固化调整</button>
                </div>
            </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  )
}

export default VacationQuotaSettings
