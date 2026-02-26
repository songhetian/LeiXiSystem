import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'
import { apiGet } from '../../utils/apiClient'
import { 
    Calendar, 
    Download, 
    RefreshCcw, 
    Clock, 
    ArrowLeft, 
    ArrowRight, 
    CheckCircle2, 
    TrendingUp, 
    Timer, 
    Plane, 
    Activity,
    Target
} from 'lucide-react';
import { ConfigProvider, Select, Tooltip, Card, Spin } from 'antd';
import { 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip 
} from 'recharts';

function AttendanceStats() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })
  const [employee, setEmployee] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      fetchEmployeeInfo(userData.id)
    }
  }, [])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const res = await apiGet(`/api/employees/by-user/${userId}`)
      if (res.success && res.data) setEmployee(res.data)
    } catch (e) {}
  }

  useEffect(() => {
    if (employee) fetchMonthlyReport()
  }, [selectedMonth, employee])

  const fetchMonthlyReport = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await apiGet('/api/attendance/monthly-report', {
        params: { employee_id: employee.id, year: selectedMonth.year, month: selectedMonth.month }
      })
      if (res.success) setReport(res.data)
    } catch (error) {
      toast.error('同步效能数据失败')
    } finally { setLoading(false) }
  }

  const handleMonthChange = (offset) => {
    setSelectedMonth(prev => {
      let newMonth = prev.month + offset
      let newYear = prev.year
      if (newMonth < 1) { newMonth = 12; newYear--; }
      else if (newMonth > 12) { newMonth = 1; newYear++; }
      
      // 物理锁定：禁止跳转到未来月份
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (newYear > currentYear || (newYear === currentYear && newMonth > currentMonth)) {
        message.warning('无法查看未来月份的效能报告');
        return prev;
      }
      
      return { year: newYear, month: newMonth }
    })
  }

  // --- 可视化数据预处理 ---
  const pieData = useMemo(() => {
    if (!report) return []
    return [
        { name: '正常出勤', value: report.attendance.normal_days, color: '#10b981' },
        { name: '迟到早退', value: report.attendance.late_days + report.attendance.early_days, color: '#f59e0b' },
        { name: '缺勤异常', value: report.attendance.absent_days || 0, color: '#ef4444' },
        { name: '请假对冲', value: report.attendance.leave_days, color: '#3b82f6' }
    ].filter(d => d.value > 0)
  }, [report])

  if (loading && !report) return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 44, colorBorder: '#64748b' }
    }}>
    <div className="space-y-8 animate-in fade-in duration-500 text-left font-black">
      
      {/* 1. 效能月份控制台 */}
      <div className="bg-white border border-slate-500 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                    <Activity size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">我的职场效能报告</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">个人月度出勤表现汇总</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => handleMonthChange(-1)} className="p-2.5 rounded-xl border border-slate-300 hover:border-slate-900 transition-all"><ArrowLeft size={18}/></button>
                <div className="px-6 py-2 bg-slate-900 text-white rounded-xl text-lg font-black min-w-[160px] text-center">
                    {selectedMonth.year}年 {selectedMonth.month}月
                </div>
                <button 
                    onClick={() => handleMonthChange(1)} 
                    className={`p-2.5 rounded-xl border border-slate-300 transition-all ${
                        (selectedMonth.year === new Date().getFullYear() && selectedMonth.month === new Date().getMonth() + 1)
                        ? 'opacity-20 cursor-not-allowed'
                        : 'hover:border-slate-900'
                    }`}
                >
                    <ArrowRight size={18}/>
                </button>
                <button onClick={fetchMonthlyReport} className="h-11 w-11 flex items-center justify-center bg-slate-50 border border-slate-300 rounded-xl hover:bg-white transition-all ml-2"><RefreshCcw size={18}/></button>
            </div>
        </div>
      </div>

      {!report ? (
        <Card className="rounded-3xl border-slate-500 p-20 text-center text-slate-400 font-black">该月效能数据尚未同步完成</Card>
      ) : (
        <>
          {/* 2. 效能看板：可视化与核心指标 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* 可视化环形图 */}
            <Card className="rounded-3xl border-slate-500 shadow-sm" title={<span className="text-[11px] uppercase tracking-widest text-slate-400">出勤比例分布</span>}>
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%" cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={8}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #64748b', fontWeight: 900 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                    {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                            <span className="text-[11px] font-black text-slate-600">{d.name}: {d.value}天</span>
                        </div>
                    ))}
                </div>
            </Card>

            {/* 核心效能指标 - 多彩透明风格 */}
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    { label: '本月出勤天数', value: report.attendance.clock_in_days, unit: '天', color: 'emerald', icon: <CheckCircle2 size={24}/>, desc: '较上月增长 2.1%' },
                    { label: '累计工作时长', value: report.attendance.total_work_hours.toFixed(1), unit: '小时', color: 'indigo', icon: <Clock size={24}/>, desc: '平均每日 8.2h' },
                    { label: '异常告警次数', value: report.attendance.late_days + report.attendance.early_days, unit: '次', color: 'rose', icon: <Timer size={24}/>, desc: '包含迟到与早退' },
                    { label: '职场积分参考', value: '98.5', unit: '分', color: 'amber', icon: <Target size={24}/>, desc: '当前绩效评级：优' }
                ].map((s, i) => (
                    <div key={i} className={`bg-${s.color}-500/10 border border-${s.color}-500/30 p-8 rounded-3xl flex flex-col justify-between group transition-all hover:scale-[1.02]`}>
                        <div className="flex items-start justify-between">
                            <div className={`w-14 h-14 rounded-2xl bg-${s.color}-500/20 text-${s.color}-600 flex items-center justify-center border border-${s.color}-500/20`}>
                                {s.icon}
                            </div>
                            <div className="text-right">
                                <p className={`text-[11px] font-black text-${s.color}-700 uppercase tracking-widest`}>{s.label}</p>
                                <h2 className={`text-4xl font-black text-${s.color}-900 mt-1`}>{s.value}<span className="text-sm ml-1 opacity-60">{s.unit}</span></h2>
                            </div>
                        </div>
                        <div className={`mt-6 pt-4 border-t border-${s.color}-500/10 flex items-center gap-2 text-[10px] font-black text-${s.color}-600`}>
                            <TrendingUp size={12}/> {s.desc}
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* 3. 业务分类详情区 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="rounded-3xl border-slate-500 shadow-sm" title={<div className="flex items-center gap-2"><Plane size={16} className="text-blue-600"/><span>请假统计汇总</span></div>}>
                <div className="space-y-4">
                    {[
                        { label: '年假累计', value: report.leave.annual || 0, color: 'blue' },
                        { label: '病假累计', value: report.leave.sick || 0, color: 'rose' },
                        { label: '事假累计', value: report.leave.personal || 0, color: 'amber' }
                    ].map((l, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[13px] font-black text-slate-600">{l.label}</span>
                            <span className={`text-lg font-black text-${l.color}-600`}>{l.value} <span className="text-[10px]">天</span></span>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="rounded-3xl border-slate-500 shadow-sm" title={<div className="flex items-center gap-2"><TrendingUp size={16} className="text-purple-600"/><span>加班明细汇总</span></div>}>
                <div className="flex flex-col items-center justify-center py-6">
                    <div className="text-5xl font-black text-purple-600 mb-2">{report.overtime.total_hours.toFixed(1)}<span className="text-sm font-bold text-slate-400 ml-1">h</span></div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">本月累计加班时长</p>
                </div>
                <div className="h-px bg-slate-100 my-4"></div>
                <div className="flex justify-between px-4">
                    <div className="text-center">
                        <div className="text-xl font-black text-slate-900">{report.overtime.count}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase">累计次数</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-black text-slate-900">{(report.overtime.total_hours / (report.overtime.count || 1)).toFixed(1)}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase">平均时长/次</div>
                    </div>
                </div>
            </Card>

            <Card className="rounded-3xl border-slate-500 shadow-sm" title={<div className="flex items-center gap-2"><RefreshCcw size={16} className="text-emerald-600"/><span>异常补卡明细</span></div>}>
                <div className="flex flex-col items-center justify-center py-6">
                    <div className="text-5xl font-black text-emerald-600 mb-2">{report.attendance.makeup_count || 0}<span className="text-sm font-bold text-slate-400 ml-1">次</span></div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">本月异常修正记录</p>
                </div>
                <button className="w-full mt-6 h-11 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all">查看补卡历史记录</button>
            </Card>
          </div>
        </>
      )}
    </div>
    </ConfigProvider>
  )
}

export default AttendanceStats;
