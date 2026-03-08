import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { formatDate, getBeijingDate, formatBeijingDate } from '../../utils/date'
import api from '../../api'
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { ConfigProvider } from 'antd';

export default function AttendanceHome({ onNavigate }) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [employee, setEmployee] = useState(null)
  const [user, setUser] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState(null)
  const [shifts, setShifts] = useState([])
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState(null)
  const [attendanceRules, setAttendanceRules] = useState(null) 
  const [restShiftId, setRestShiftId] = useState(null) 
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  })

  const navigate = (tab) => {
    if (onNavigate) onNavigate(tab)
  }

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      fetchEmployeeInfo(userData.id)
    }
  }, [])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const response = await api.get(`/api/employees/by-user/${userId}`)
      if (response.data.success && response.data.data) {
        setEmployee(response.data.data)
      } else {
        toast.error('未找到员工信息，请联系管理员')
      }
    } catch (error) {
      logger.error('获取员工信息失败:', error)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchAttendanceSettings()
    loadRestShift()
  }, [])

  useEffect(() => {
    if (employee) {
      fetchTodayRecord()
      fetchTodaySchedule()
      fetchShifts()
    }
  }, [employee])

  const fetchAttendanceSettings = async () => {
    try {
      const response = await api.get('/attendance/settings')
      if (response.data.success) {
        const settings = response.data.data
        setAttendanceRules({
          late_threshold: settings.late_minutes || 30,
          early_threshold: settings.early_leave_minutes || 30,
          clock_in_advance: settings.early_clock_in_minutes || 60,
          clock_out_delay: settings.late_clock_out_minutes || 120
        })
      }
    } catch (error) {
      setAttendanceRules({ late_threshold: 30, early_threshold: 30, clock_in_advance: 60, clock_out_delay: 120 })
    }
  }

  const loadRestShift = async () => {
    try {
      const response = await api.get('/shifts/rest')
      if (response.data.success) setRestShiftId(response.data.data.id)
    } catch (error) {}
  }

  const fetchTodayRecord = async () => {
    if (!employee) return
    try {
      const response = await api.get('/attendance/today', { params: { employee_id: employee.id } })
      if (response.data.success) setTodayRecord(response.data.data)
    } catch (error) {}
  }

  const fetchTodaySchedule = async () => {
    if (!employee) return
    try {
      const today = formatBeijingDate()
      // 获取当前排班，后端现在已支持返回 late_threshold, early_threshold, use_global_threshold
      const response = await api.get('/schedules', { params: { employee_id: employee.id, start_date: today, end_date: today } })
      if (response.data.success && response.data.data.length > 0) {
        setTodaySchedule(response.data.data[0])
      } else {
        setTodaySchedule(null)
      }
    } catch (error) {}
  }

  const fetchShifts = async () => {
    try {
      const response = await api.get('/shifts', { params: { limit: 100, is_active: 1 } })
      if (response.data.success) setShifts(response.data.data)
    } catch (error) {}
  }

  const handleSelectShift = async () => {
    if (!selectedShift || !employee) return toast.error('请选择班次')
    setLoading(true)
    try {
      const today = formatBeijingDate()
      const response = await api.post('/schedules/self', { employee_id: employee.id, user_id: user.id, schedule_date: today, shift_id: selectedShift })
      if (response.data.success) {
        toast.success('班次选择成功')
        setShowShiftModal(false)
        setSelectedShift(null)
        await fetchTodaySchedule()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '班次选择失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const response = await api.post('/attendance/clock-in', { employee_id: employee.id, user_id: user.id })
      if (response.data.success) {
        toast.success(response.data.message)
        if (response.data.data) setTodayRecord(prev => ({ ...prev, ...response.data.data }))
        await fetchTodayRecord()
        await fetchTodaySchedule()
      }
    } catch (error) {
      const msg = error.response?.data?.message || '打卡失败'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const response = await api.post('/attendance/clock-out', { employee_id: employee.id, user_id: user.id })
      if (response.data.success) {
        toast.success(response.data.message)
        if (response.data.data) setTodayRecord(prev => ({ ...prev, ...response.data.data }))
        await fetchTodayRecord()
        await fetchTodaySchedule()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '签退失败')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date) => date.toLocaleTimeString('zh-CN', { hour12: false })
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '--:--'
    const date = new Date(dateTimeStr)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const getStatusBadge = (status) => {
    const badges = {
      normal: { text: '正常', color: 'bg-green-500 text-white' },
      late: { text: '迟到', color: 'bg-red-500 text-white' },
      early: { text: '早退', color: 'bg-orange-500 text-white' },
      absent: { text: '缺勤', color: 'bg-gray-500 text-white' },
      leave: { text: '请假', color: 'bg-blue-500 text-white' },
      early_leave: { text: '早退', color: 'bg-orange-500 text-white' },
      late_and_early_leave: { text: '迟到且早退', color: 'bg-rose-600 text-white' }
    }
    const badge = badges[status] || badges.normal
    return <span className={`px-3 py-1 rounded text-[10px] font-black ${badge.color}`}>{badge.text}</span>
  }

  const checkClockInTime = () => {
    if (todaySchedule && todaySchedule.shift_id == restShiftId) return { allowed: false, message: '今日为休息日，无需打卡' }
    if (!todaySchedule || !todaySchedule.start_time) return { allowed: false, message: '请先排班后再打卡' }
    
    const now = new Date()
    const [h, m] = todaySchedule.start_time.split(':')
    const startDateTime = new Date()
    startDateTime.setHours(parseInt(h), parseInt(m), 0, 0)
    
    // 逻辑判定口径对齐
    let lateThreshold;
    if (todaySchedule.use_global_threshold == 1) {
      lateThreshold = attendanceRules?.late_threshold || 30;
    } else {
      lateThreshold = (todaySchedule.late_threshold !== null && todaySchedule.late_threshold !== undefined) 
        ? todaySchedule.late_threshold 
        : 5; 
    }

    const clockInAdvance = attendanceRules?.clock_in_advance || 60
    const earlyClockInTime = new Date(startDateTime.getTime() - clockInAdvance * 60000)
    
    if (now < earlyClockInTime) return { allowed: false, message: `需在上班前${clockInAdvance}分钟内打卡` }
    return { allowed: true, message: '' }
  }

  const checkClockOutTime = () => {
    if (todaySchedule && todaySchedule.shift_id == restShiftId) return { allowed: false, message: '今日为休息日' }
    if (!todaySchedule || !todaySchedule.end_time) return { allowed: false, message: '暂无排班' }
    
    const now = new Date()
    const [h, m] = todaySchedule.end_time.split(':')
    const endDateTime = new Date()
    endDateTime.setHours(parseInt(h), parseInt(m), 0, 0)
    
    // 逻辑判定口径对齐
    let earlyThreshold;
    if (todaySchedule.use_global_threshold == 1) {
      earlyThreshold = attendanceRules?.early_threshold || 30;
    } else {
      earlyThreshold = (todaySchedule.early_threshold !== null && todaySchedule.early_threshold !== undefined) 
        ? todaySchedule.early_threshold 
        : 5; 
    }

    // 🔴 核心修复：0 表示严格执行，只有到达下班时间才允许
    const allowedClockOutTime = new Date(endDateTime.getTime() - earlyThreshold * 60000)
    
    if (now < allowedClockOutTime) {
      const diffMin = Math.ceil((allowedClockOutTime - now) / 60000);
      return { 
        allowed: false, 
        message: earlyThreshold > 0 
          ? `需在下班前${earlyThreshold}分钟内才允许签退` 
          : `尚未到达下班时间，还需等待 ${diffMin} 分钟` 
      }
    }
    return { allowed: true, message: '' }
  }

  const clockInCheck = checkClockInTime()
  const clockOutCheck = checkClockOutTime()
  const isRestDay = todaySchedule && todaySchedule.shift_id == restShiftId

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 40 } }}>
    <div className="min-h-screen p-4 bg-slate-50/50 text-left">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex justify-between items-center border border-slate-100">
          <div>
            <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">考勤打卡 {employee && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"># {employee.employee_no}</span>}</h1>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">{formatDate(currentTime)}</p>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black text-blue-600 font-mono tracking-tighter leading-none">{formatTime(currentTime)}</div>
             <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">当前服务器时间</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-2"><div className="w-1.5 h-4 bg-blue-600 rounded-full"></div><h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">今日考勤状态</h2></div>
                {todaySchedule && todaySchedule.shift_id ? (
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded shadow-sm">{todaySchedule.shift_name}</span>
                    <span className="text-slate-500">{todaySchedule.start_time} - {todaySchedule.end_time}</span>
                  </div>
                ) : (
                  <button onClick={() => setShowShiftModal(true)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-black transition-all shadow-md active:scale-95 flex items-center gap-1"><span>📅 选择班次</span></button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-black mb-2 uppercase">上班打卡</div>
                  <div className={`text-lg font-black ${todayRecord?.clock_in_time ? 'text-slate-800' : 'text-slate-300'}`}>{formatDateTime(todayRecord?.clock_in_time)}</div>
                   {todayRecord?.status && ['late', 'leave', 'late_and_early_leave'].includes(todayRecord.status) && <div className="mt-2 scale-90">{getStatusBadge(todayRecord.status)}</div>}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-black mb-2 uppercase">下班打卡</div>
                  <div className={`text-lg font-black ${todayRecord?.clock_out_time ? 'text-slate-800' : 'text-slate-300'}`}>{formatDateTime(todayRecord?.clock_out_time)}</div>
                  {todayRecord?.status && ['early_leave', 'early', 'leave', 'late_and_early_leave'].includes(todayRecord.status) && <div className="mt-2 scale-90">{getStatusBadge(todayRecord.status)}</div>}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-black mb-2 uppercase">计薪工时</div>
                  <div className="text-lg font-black text-slate-800">{todayRecord?.work_hours ? `${todayRecord.work_hours}h` : '--'}</div>
                   {todayRecord?.status && todayRecord.status === 'normal' && <div className="mt-2 scale-90">{getStatusBadge(todayRecord.status)}</div>}
                </div>
              </div>

              {!todaySchedule && <div className="bg-amber-50 border border-amber-200 rounded p-4 flex items-center gap-3 text-amber-700 mb-5 shadow-sm"><span>⚠️</span><span className="font-medium">暂无排班，请先排班</span></div>}
              {isRestDay && <div className="bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center gap-3 text-emerald-700 mb-5 shadow-sm"><span>🛌</span><span className="font-medium">休息日，无需打卡</span></div>}

              {!isRestDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {todayRecord?.clock_in_time ? (
                    <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-black border border-slate-200">已完成上班打卡</button>
                  ) : (
                    <button onClick={handleClockIn} disabled={loading || !clockInCheck.allowed} className={`w-full py-3 rounded-xl text-sm font-black transition-all shadow-lg ${loading ? 'bg-slate-200 text-slate-400' : clockInCheck.allowed ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>{loading ? '处理中...' : '上班签到'}</button>
                  )}
                   {!todayRecord?.clock_in_time && <div className="mt-2 text-center text-[10px] min-h-[16px]">{clockInCheck.message ? <span className={clockInCheck.allowed ? "text-blue-600 font-bold" : "text-slate-400 font-medium"}>{clockInCheck.message}</span> : (todaySchedule && <span className="text-blue-600 font-bold">签到时段已开启 ({todaySchedule.start_time})</span>)}</div>}
                </div>
                <div>
                  {todayRecord?.clock_out_time ? (
                    <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-black border border-slate-200">已完成下班打卡</button>
                  ) : !todayRecord?.clock_in_time ? (
                    <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-black border border-slate-200">等待上班签到</button>
                  ) : (
                    <button onClick={handleClockOut} disabled={loading || !clockOutCheck.allowed} className={`w-full py-3 rounded-xl text-sm font-black transition-all shadow-lg ${loading ? 'bg-slate-200 text-slate-400' : clockOutCheck.allowed ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>{loading ? '处理中...' : '下班签退'}</button>
                  )}
                   {(!todayRecord?.clock_out_time && todayRecord?.clock_in_time) && <div className="mt-2 text-center text-[10px] min-h-[16px]">{clockOutCheck.message ? <span className={clockOutCheck.allowed ? "text-indigo-600 font-bold" : "text-slate-400 font-medium"}>{clockOutCheck.message}</span> : (todaySchedule && <span className="text-indigo-600 font-bold">签退时段已开启 ({todaySchedule.end_time})</span>)}</div>}
                </div>
              </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
             <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 h-full">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-50"><div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div><h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">快捷自助功能</h2></div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate('attendance-records')} className="p-4 border border-slate-50 rounded-xl hover:bg-blue-50 text-center transition-all group">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">📋</div>
                    <div className="text-xs text-slate-700 font-black mt-2">打卡月报</div>
                  </button>
                  <button onClick={() => navigate('attendance-leave-apply')} className="p-4 border border-slate-50 rounded-xl hover:bg-amber-50 text-center transition-all group">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">🏖️</div>
                    <div className="text-xs text-slate-700 font-black mt-2">在线请假</div>
                  </button>
                  <button onClick={() => navigate('attendance-overtime-apply')} className="p-4 border border-slate-50 rounded-xl hover:bg-purple-50 text-center transition-all group">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">⏰</div>
                    <div className="text-xs text-slate-700 font-black mt-2">加班申请</div>
                  </button>
                   <button onClick={() => navigate('attendance-stats')} className="p-4 border border-slate-50 rounded-xl hover:bg-emerald-50 text-center transition-all group">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                    <div className="text-xs text-slate-700 font-black mt-2">数据统计</div>
                  </button>
                </div>
             </div>

             {todayRecord?.status && ['late', 'early_leave', 'early', 'late_and_early_leave'].includes(todayRecord.status) && (
                <div className={`rounded-xl p-4 text-[11px] font-bold flex items-center gap-3 animate-pulse ${(todayRecord.status === 'late' || todayRecord.status === 'late_and_early_leave') ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'} shadow-sm`}><span>⚠️</span><span>系统提醒：您今日考勤存在异常状态</span></div>
             )}
          </div>
        </div>

        <div className="mt-12 pt-6 mb-10 border-t border-slate-100 opacity-40 hover:opacity-100 transition-opacity relative z-[100]">
          <div className="flex items-center gap-3 justify-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">系统调试控制台:</span>
              <button onClick={() => setConfirmDialog({ isOpen: true, title: '清除打卡记录', message: '此操作将彻底抹除今日打卡数据，抹除后可重新打卡。是否继续？', type: 'danger', onConfirm: async () => { try { const today = formatBeijingDate(); await api.delete('/attendance/today', { params: { employee_id: employee?.id, date: today } }); toast.success('打卡记录已清除'); await fetchTodayRecord(); } catch (error) { toast.error('清除失败'); } } })} className="px-3 py-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg text-[10px] font-black border border-slate-200 transition-all uppercase">清除今日打卡</button>
              <button onClick={() => setConfirmDialog({ isOpen: true, title: '重置今日班次', message: '确定要重置今日的班次安排吗？重置后需重新选择班次。', type: 'danger', onConfirm: async () => { try { const today = formatBeijingDate(); await api.delete('/schedules/today', { params: { employee_id: employee?.id, schedule_date: today } }); toast.success('排班已重置'); setTodaySchedule(null); await fetchTodaySchedule(); } catch (error) { toast.error('重置失败'); } } })} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg text-[10px] font-black border border-slate-200 transition-all uppercase">重置今日班次</button>
          </div>
        </div>

        {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[6000] backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 text-left">
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-base font-black ${confirmDialog.type === 'danger' ? 'text-rose-600' : 'text-blue-600'}`}>{confirmDialog.title}</h3>
                  <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 transition-colors"><X size={18} /></button>
                </div>
                <div className="mb-6"><p className="text-xs font-bold text-slate-500 leading-relaxed">{confirmDialog.message}</p></div>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 h-10 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 transition-all font-black text-[11px] uppercase">取消</button>
                  <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, isOpen: false })); }} className={`flex-1 h-10 rounded-xl transition-all font-black text-[11px] uppercase shadow-lg ${confirmDialog.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-100' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-100'}`}>确认</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showShiftModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[5000] backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-100 overflow-hidden">
              <div className="p-6 text-left">
                <div className="flex justify-between items-center mb-5"><h3 className="text-base font-black text-blue-600 uppercase tracking-widest">申报今日班次</h3><button onClick={() => { setShowShiftModal(false); setSelectedShift(null); }} className="text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 transition-colors"><X size={18} /></button></div>
                <div className="mb-6">
                  <p className="text-[11px] font-bold text-slate-400 mb-4 uppercase">请选择您今日的排班计划，提交后即可生效签到。</p>
                  {shifts.length === 0 ? <div className="text-center py-8 text-slate-300">📋<p className="text-xs font-black">暂无可用班次列表</p></div> : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {shifts.map((shift) => (
                        <label key={shift.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedShift === shift.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                          <input type="radio" name="shift" value={shift.id} checked={selectedShift === shift.id} onChange={() => setSelectedShift(shift.id)} className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                          <div className="flex-1"><div className="text-xs font-black text-slate-800">{shift.name}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{shift.start_time} - {shift.end_time} {shift.department_name && <span className="ml-2 px-1.5 py-0 bg-slate-100 text-slate-500 rounded text-[9px]">{shift.department_name}</span>}</div></div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowShiftModal(false); setSelectedShift(null); }} className="flex-1 h-10 bg-slate-50 text-slate-500 rounded-xl font-black text-[11px] uppercase">放弃</button>
                  <button onClick={handleSelectShift} disabled={!selectedShift || loading} className={`flex-1 h-10 rounded-xl transition-all font-black text-[11px] uppercase shadow-lg ${!selectedShift || loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'}`}>{loading ? '同步中...' : '确认生效'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </ConfigProvider>
  )
}
