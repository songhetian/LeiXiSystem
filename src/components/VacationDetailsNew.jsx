import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import api from '../api';
import { Calendar, Clock, TrendingUp, Award, ArrowLeft, ArrowRight, RefreshCcw, Plane, Zap, Target } from 'lucide-react'
import { ConfigProvider, Card, Select, Button, Tag, Space, Pagination, Spin, Empty } from 'antd'
import OvertimeConversionModal from './OvertimeConversionModal'

const VacationDetailsNew = () => {
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('year') // 'year' | 'month'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [vacationBalances, setVacationBalances] = useState([])
  const [vacationTypes, setVacationTypes] = useState([])
  const [leaveRecords, setLeaveRecords] = useState([])
  const [conversionBalance, setConversionBalance] = useState(null)
  const [overtimeStats, setOvertimeStats] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [conversionModalVisible, setConversionModalVisible] = useState(false)
  const [conversionRules, setConversionRules] = useState([])

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)

  // 计算假期数据
  const [totalVacationDays, setTotalVacationDays] = useState(0)
  const [monthlyVacationDays, setMonthlyVacationDays] = useState(0)

  useEffect(() => {
    loadData();
    loadConversionRules();
  }, [selectedYear, selectedMonth, viewMode, currentPage, pageSize]);

  const loadConversionRules = async () => {
    try {
      const response = await api.get('/api/conversion-rules', { params: { source_type: 'overtime', enabled: true } });
      if (response.data.success) setConversionRules(response.data.data);
    } catch (e) { logger.error(e); }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const userStr = localStorage.getItem('user')
      if (!userStr) return;
      const user = JSON.parse(userStr)

      // 1. 获取员工信息
      const empRes = await api.get(`/api/employees/by-user/${user.id}`)
      if (!empRes.data.success) return;
      const emp = empRes.data.data
      setEmployee(emp)

      // 2. 并行获取假务资产数据
      const [typesRes, balanceRes, overtimeRes, conversionRes] = await Promise.all([
        api.get('/api/vacation-types'),
        api.get(`/api/vacation/type-balances/${emp.id}`, { params: { year: selectedYear } }),
        api.get('/api/overtime/stats', { params: { employee_id: emp.id } }),
        api.get(`/api/vacation/conversion-balance/${emp.id}`)
      ]);

      if (typesRes.data.success) setVacationTypes(typesRes.data.data.filter(t => t.code !== 'compensatory'));
      
      let baseBalance = 0;
      if (balanceRes.data.success) {
        const filtered = (balanceRes.data.data.balances || []).filter(b => b.type_code !== 'compensatory');
        setVacationBalances(filtered);
        baseBalance = filtered.reduce((sum, b) => sum + parseFloat(b.remaining || 0), 0);
      }

      if (overtimeRes.data.success) setOvertimeStats(overtimeRes.data.data);
      
      let convBalance = 0;
      if (conversionRes.data.success) {
        setConversionBalance(conversionRes.data.data);
        convBalance = parseFloat(conversionRes.data.data.remaining_days || 0);
      }
      setTotalVacationDays(baseBalance + convBalance);

      // 3. 获取月度额度 (仅月度模式)
      if (viewMode === 'month') {
        const holidayRes = await api.get('/api/holidays', { params: { year: selectedYear } });
        if (holidayRes.data.success) {
          const mTotal = (holidayRes.data.data || [])
            .filter(h => parseInt(h.month) === selectedMonth)
            .reduce((sum, h) => sum + parseFloat(h.days || 0), 0);
          setMonthlyVacationDays(mTotal);
        }
      }

      // 4. 获取历史核销明细
      const leaveRes = await api.get('/api/leave/records', {
        params: { employee_id: emp.id, status: 'approved', page: currentPage, limit: pageSize }
      });
      if (leaveRes.data.success) {
        setLeaveRecords(leaveRes.data.data || []);
        setTotalRecords(leaveRes.data.pagination?.total || 0);
      }

    } catch (error) { 
      logger.error('Vacation Load Failed:', error);
      toast.error('假期资产数据同步失败');
    } finally { setLoading(false) }
  }

  const handlePageChange = (p) => setCurrentPage(p);

  const handleConvertOvertime = () => {
    if (!overtimeStats || overtimeStats.remaining_hours < 1) return toast.info('当前暂无足够的加班时长可供转换');
    setConversionModalVisible(true);
  }

  const getDefaultOvertimeLeaveType = () => {
    const type = vacationTypes.find(t => t.code === 'compensatory');
    return type ? type.id : (vacationTypes[0]?.id || null);
  }

  if (loading && !employee) return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest animate-pulse">正在从物理库拉取假期资产...</div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      
      {/* 1. 物理缝合控制台 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 pl-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <Calendar size={20} />
            </div>
            <div>
                <h1 className="text-base font-black text-slate-900 tracking-tight">个人假期审计报告</h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">权益额度与使用明细核销</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="flex bg-slate-50 rounded-lg border border-slate-100 p-0.5 h-[36px]">
                <button onClick={() => { setViewMode('year'); setCurrentPage(1); }} className={`px-4 text-[11px] font-black rounded-md transition-all ${viewMode === 'year' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>年度视图</button>
                <button onClick={() => { setViewMode('month'); setCurrentPage(1); }} className={`px-4 text-[11px] font-black rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>月度视图</button>
            </div>

            <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
                <Select variant="borderless" className="w-24 font-black text-xs" value={selectedYear} onChange={setSelectedYear}
                    options={[0, 1, 2].map(i => { const y = new Date().getFullYear() - 1 + i; return { value: y, label: `${y}年` }; })} />
                {viewMode === 'month' && (
                    <Select variant="borderless" className="w-20 font-black text-xs border-l border-slate-100" value={selectedMonth} onChange={setSelectedMonth}
                        options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` }))} />
                )}
            </div>
            <button onClick={loadData} className="h-9 w-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-white transition-all ml-1 text-slate-400 hover:text-indigo-600 mr-2"><RefreshCcw size={16}/></button>
        </div>
      </div>

      {/* 2. 核心权益看板 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
            { 
                label: viewMode === 'month' ? '月度可用额度' : '当前总余额', 
                value: viewMode === 'month' ? monthlyVacationDays.toFixed(1) : totalVacationDays.toFixed(1),
                unit: '天', color: 'blue', icon: <Award size={18}/>,
                desc: viewMode === 'month' ? '当月法定假期额度' : '基础假期 + 加班转换'
            },
            { 
                label: '已转换假期', 
                value: Number(conversionBalance?.remaining_days ?? 0).toFixed(1), 
                unit: '天', color: 'purple', icon: <Zap size={18}/>,
                desc: `累计核销转换 ${Number(conversionBalance?.total_converted_days ?? 0).toFixed(1)} 天`
            },
            { 
                label: '加班时长待转', 
                value: Number(overtimeStats?.remaining_hours ?? 0).toFixed(1), 
                unit: 'h', color: 'orange', icon: <Clock size={18}/>,
                action: <button onClick={handleConvertOvertime} className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm hover:bg-indigo-700 transition-all ml-2 font-black uppercase">一键转换</button>,
                desc: '未进行假务核销的加班时长'
            },
            { 
                label: '本周期已休假', 
                value: totalRecords, 
                unit: '次', color: 'emerald', icon: <TrendingUp size={18}/>,
                desc: '本年度审核通过的记录数'
            }
        ].map((s, i) => (
            <div key={i} className={`bg-white border border-slate-200 p-5 rounded-2xl shadow-sm group transition-all hover:border-${s.color}-400`}>
                <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center`}>{s.icon}</div>
                    <div className="flex items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                        {s.action}
                    </div>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900 leading-none">{s.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{s.unit}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-50 text-[9px] font-bold text-slate-400 truncate">{s.desc}</div>
            </div>
        ))}
      </div>

      {/* 3. 使用明细审计列表 */}
      <Card 
        className="rounded-2xl border-slate-200 shadow-sm overflow-hidden" 
        styles={{ header: { padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }, body: { padding: '0' } }}
        title={<div className="flex items-center gap-2 text-xs font-black text-slate-700"><Plane size={14} className="text-blue-600"/><span>历史假期核销审计明细</span></div>}
      >
        <div className="overflow-hidden min-h-[200px]">
            {loading ? <div className="py-20 text-center"><Spin size="small"/></div> : leaveRecords.length === 0 ? (
                <div className="py-16 text-center text-slate-300 font-bold text-xs uppercase tracking-widest">暂无匹配的假务核销记录</div>
            ) : (
                <div className="divide-y divide-slate-50">
                    {leaveRecords.map(record => {
                        const type = vacationTypes.find(t => t.code === record.leave_type) || { name: record.leave_type === 'annual' ? '年假' : (record.leave_type === 'sick' ? '病假' : '其它') }
                        return (
                            <div key={record.id} className="p-4 px-6 hover:bg-slate-50 transition-all flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-1 h-8 rounded-full ${record.leave_type === 'annual' ? 'bg-blue-500' : (record.leave_type === 'sick' ? 'bg-rose-500' : 'bg-purple-500')}`}></div>
                                    <div>
                                        <div className="text-sm font-black text-slate-800">{type.name} <span className="text-[10px] text-slate-400 font-bold ml-2">#{record.days}天</span></div>
                                        <div className="text-[11px] font-bold text-slate-400 mt-0.5">{formatDate(record.start_date)} → {formatDate(record.end_date)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    {record.used_conversion_days > 0 && <Tag className="m-0 border-none bg-purple-50 text-purple-600 font-black text-[9px] px-2 rounded-full">含转换假 {record.used_conversion_days}天</Tag>}
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-900 uppercase">AUDIT PASSED</div>
                                        <div className="text-[9px] font-bold text-slate-300">{formatDate(record.created_at)} 存档</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
        {totalRecords > pageSize && (
            <div className="p-4 px-6 border-t border-slate-50 bg-slate-50/30 flex justify-end">
                <Pagination size="small" current={currentPage} pageSize={pageSize} total={totalRecords} onChange={handlePageChange} showSizeChanger={false} />
            </div>
        )}
      </Card>

      {/* 4. 加班转换审计模态框 */}
      {employee && conversionModalVisible && (
        <OvertimeConversionModal
          visible={conversionModalVisible}
          onClose={() => setConversionModalVisible(false)}
          onSuccess={loadData}
          employeeId={employee.id}
          overtimeHours={Number(overtimeStats?.remaining_hours || 0)}
          defaultLeaveType={getDefaultOvertimeLeaveType()}
          conversionRules={conversionRules}
        />
      )}
    </div>
    </ConfigProvider>
  )
}

export default VacationDetailsNew
