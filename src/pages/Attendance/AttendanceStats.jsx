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
    AlertCircle, 
    XCircle, 
    TrendingUp, 
    Timer, 
    Plane, 
    Stethoscope, 
    UserCheck,
    BarChart3
} from 'lucide-react';
import { ConfigProvider, Select, Tooltip } from 'antd';

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
      toast.error('同步考勤月报失败')
    } finally { setLoading(false) }
  }

  const handleMonthChange = (offset) => {
    setSelectedMonth(prev => {
      let newMonth = prev.month + offset
      let newYear = prev.year
      if (newMonth < 1) { newMonth = 12; newYear--; }
      else if (newMonth > 12) { newMonth = 1; newYear++; }
      return { year: newYear, month: newMonth }
    })
  }

  const calculateAttendanceRate = () => {
    if (!report) return 0
    const workDays = 22 // 理想工作日
    const actualDays = report.attendance.clock_in_days
    return ((actualDays / workDays) * 100).toFixed(1)
  }

  const handleExport = () => {
    if (!employee) return
    const startDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`
    const endDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-31`
    window.open(getApiUrl(`/api/export/attendance/${employee.id}?startDate=${startDate}&endDate=${endDate}`), '_blank')
  }

  if (loading && !report) return <div className="flex items-center justify-center h-screen text-slate-900 font-black">考勤月报生成中...</div>

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left font-black">
      {/* 1. 顶栏：白话化标题 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><BarChart3 size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">我的考勤月报</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">打卡记录自动汇总与异常缺勤月度报告</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleExport} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200 border-[1px] border-slate-800"><Download size={16} /> 导出报表</button>
            <button onClick={fetchMonthlyReport} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all border-[1px] border-indigo-100"><RefreshCcw size={18} /></button>
          </div>
        </div>

        {/* 2. 紧凑月份切换条 */}
        <div className="bg-slate-50/40 px-10 py-6">
            <div className="flex items-center justify-center gap-8">
                <button onClick={() => handleMonthChange(-1)} className="p-2.5 rounded-lg border-[1px] border-slate-400 hover:bg-white transition-all text-slate-600"><ArrowLeft size={20} /></button>
                <div className="flex items-center gap-3">
                    <Calendar size={22} className="text-indigo-600" />
                    <span className="text-2xl font-black text-slate-900 tracking-tighter">{selectedMonth.year}年 {selectedMonth.month}月</span>
                </div>
                <button onClick={() => handleMonthChange(1)} className="p-2.5 rounded-lg border-[1px] border-slate-400 hover:bg-white transition-all text-slate-600"><ArrowRight size={20} /></button>
            </div>
        </div>
      </div>

      {!report ? (
        <div className="bg-white p-20 rounded-2xl border border-slate-200 text-center text-slate-400 font-black text-lg">该月暂无考勤明细数据</div>
      ) : (
        <>
          {/* 3. 核心统计：内嵌式卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="md:col-span-2 bg-slate-900 p-8 rounded-2xl shadow-xl shadow-slate-200 relative overflow-hidden group transition-all">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-2">准时出勤率</p>
                        <h2 className="text-5xl font-black text-white tracking-tighter">{calculateAttendanceRate()}%</h2>
                    </div>
                    <div className="text-right text-white/80">
                        <div className="text-sm font-black mb-1">本月打卡 {report.attendance.clock_in_days} 天</div>
                        <div className="text-[10px] font-bold opacity-60">标准工作日 22 天</div>
                    </div>
                </div>
                <div className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-700"><CheckCircle2 size={160} /></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border-[1px] border-slate-300 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">正常出勤</span>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border-[1px] border-emerald-100 group-hover:scale-110 transition-all"><CheckCircle2 size={20} /></div>
                </div>
                <div>
                    <span className="text-3xl font-black text-slate-900">{report.attendance.normal_days}</span>
                    <span className="text-[13px] font-black text-slate-400 ml-2">天</span>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border-[1px] border-slate-300 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">迟到/早退</span>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border-[1px] border-amber-100 group-hover:scale-110 transition-all"><Timer size={20} /></div>
                </div>
                <div>
                    <span className="text-3xl font-black text-slate-900">{report.attendance.late_days + report.attendance.early_days}</span>
                    <span className="text-[13px] font-black text-slate-400 ml-2">次</span>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 工作时长卡片 */}
            <div className="bg-white p-6 rounded-2xl border-[1px] border-slate-300 shadow-sm hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border-[1px] border-indigo-100"><Clock size={20} /></div>
                    <h3 className="text-[15px] font-black text-slate-900">打卡时长统计</h3>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border-[1px] border-slate-200 flex justify-between items-center shadow-inner">
                        <span className="text-[13px] font-black text-slate-600">总计工时</span>
                        <span className="text-[18px] font-black text-indigo-600">{report.attendance.total_work_hours.toFixed(1)}h</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border-[1px] border-slate-200 flex justify-between items-center shadow-inner">
                        <span className="text-[13px] font-black text-slate-600">平均工时</span>
                        <span className="text-[18px] font-black text-emerald-600">
                            {report.attendance.clock_in_days > 0 ? (report.attendance.total_work_hours / report.attendance.clock_in_days).toFixed(1) : 0}h
                        </span>
                    </div>
                </div>
            </div>

            {/* 请假统计 */}
            <div className="bg-white p-6 rounded-2xl border-[1px] border-slate-300 shadow-sm hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border-[1px] border-amber-100"><Plane size={20} /></div>
                    <h3 className="text-[15px] font-black text-slate-900">本月请假汇总</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { key: 'annual', label: '年假', color: 'blue' },
                        { key: 'sick', label: '病假', color: 'rose' },
                        { key: 'personal', label: '事假', color: 'amber' }
                    ].map(type => (
                        <div key={type.key} className="p-3 bg-slate-50 border-[1px] border-slate-200 rounded-xl text-center shadow-inner">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{type.label}</p>
                            <p className={`text-lg font-black text-${type.color}-600`}>{report.leave[type.key] || 0}<span className="text-[10px] ml-0.5">天</span></p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 p-3 bg-slate-100 rounded-lg text-center text-[11px] text-slate-500 font-bold border-[1px] border-slate-200">假期余额请在“假期管理”中查验</div>
            </div>

            {/* 加班统计 */}
            <div className="bg-white p-6 rounded-2xl border-[1px] border-slate-300 shadow-sm hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border-[1px] border-purple-100"><TrendingUp size={20} /></div>
                    <h3 className="text-[15px] font-black text-slate-900">本月加班明细</h3>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-[13px] font-black text-slate-600">加班次数</span>
                        <span className="text-[18px] font-black text-purple-600">{report.overtime.count} 次</span>
                    </div>
                    <div className="flex items-center justify-between px-2">
                        <span className="text-[13px] font-black text-slate-600">总计耗时</span>
                        <span className="text-[18px] font-black text-purple-600">{report.overtime.total_hours.toFixed(1)}h</span>
                    </div>
                    <div className="h-[1px] bg-slate-100 my-2" />
                    <button className="w-full h-10 bg-purple-50 text-purple-700 border-[1px] border-purple-200 rounded-lg font-black text-[11px] hover:bg-purple-100 transition-all">查看加班原始流水</button>
                </div>
            </div>
          </div>
        </>
      )}
    </div>
    </ConfigProvider>
  )
}

export default AttendanceStats;
