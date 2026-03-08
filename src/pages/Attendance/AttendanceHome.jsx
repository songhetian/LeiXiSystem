import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { formatDate, getBeijingDate, formatBeijingDate } from '../../utils/date'
import api from '../../api'
import { toast } from 'sonner';
import { X } from 'lucide-react';

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
  const [showTimeoutModal, setShowTimeoutModal] = useState(false)
  const [timeoutMessage, setTimeoutMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0) // 用于强制刷新
  const [attendanceRules, setAttendanceRules] = useState(null) // 考勤规则
  const [restShiftId, setRestShiftId] = useState(null) // 休息班次ID
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  })

  // 自定义确认对话框组件
  const CustomConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[6000] backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-100 overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-base font-black ${
                confirmDialog.type === 'danger'
                  ? 'text-rose-600'
                  : 'text-blue-600'
              }`}>
                {confirmDialog.title}
              </h3>
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold text-slate-500 leading-relaxed">{confirmDialog.message}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 h-10 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 transition-all font-black text-[11px] uppercase"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 h-10 rounded-xl transition-all font-black text-[11px] uppercase shadow-lg ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-100'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-100'
                }`}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 导航函数
  const navigate = (tab) => {
    if (onNavigate) {
      onNavigate(tab)
    }
  }

  // 获取当前登录用户信息
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      // 获取员工信息
      fetchEmployeeInfo(userData.id)
    }
  }, [])

  // 获取员工信息
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
      toast.error('获取员工信息失败')
    }
  }

  // 更新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 获取考勤设置（只需获取一次）
  useEffect(() => {
    fetchAttendanceSettings()
    loadRestShift()
  }, [])

  // 获取今日打卡状态和排班信息
  useEffect(() => {
    if (employee) {
      fetchTodayRecord()
      fetchTodaySchedule()
      fetchShifts()
    }
  }, [employee])

  // 获取考勤设置
  const fetchAttendanceSettings = async () => {
    try {
      const response = await api.get('/attendance/settings')
      if (response.data.success) {
        const settings = response.data.data
        // 转换为前端使用的格式
        setAttendanceRules({
          late_threshold: settings.late_minutes || 30,
          early_threshold: settings.early_leave_minutes || 30,
          clock_in_advance: settings.early_clock_in_minutes || 60,
          clock_out_delay: settings.late_clock_out_minutes || 120
        })
      }
    } catch (error) {
      logger.error('获取考勤设置失败:', error)
      // 如果获取失败，使用默认规则
      setAttendanceRules({
        late_threshold: 30,
        early_threshold: 30,
        clock_in_advance: 60,
        clock_out_delay: 120
      })
    }
  }

  const loadRestShift = async () => {
    try {
      const response = await api.get('/shifts/rest')
      if (response.data.success) {
        setRestShiftId(response.data.data.id)
      }
    } catch (error) {
      logger.error('获取休息班次失败:', error)
    }
  }

  const fetchTodayRecord = async () => {
    if (!employee) return

    try {
      const response = await api.get('/attendance/today', {
        params: { employee_id: employee.id }
      })
      if (response.data.success) {
        setTodayRecord(response.data.data)
      }
    } catch (error) {
      logger.error('获取今日打卡状态失败:', error)
    }
  }

  // 获取今日排班信息
  const fetchTodaySchedule = async () => {
    if (!employee) {
      return
    }

    try {
      // 使用北京时间获取今日日期，避免时区问题
      const today = formatBeijingDate(); // 使用格式化后的日期字符串

      const response = await api.get('/schedules', {
        params: {
          employee_id: employee.id,
          start_date: today,
          end_date: today
        }
      })

      if (response.data.success && response.data.data.length > 0) {
        const schedule = response.data.data[0]
        setTodaySchedule(schedule)
      } else {
        setTodaySchedule(null)
      }
    } catch (error) {
      logger.error('获取今日排班信息失败:', error)
    }
  }

  // 获取班次列表
  const fetchShifts = async () => {
    try {
      const response = await api.get('/shifts', {
        params: { limit: 100, is_active: 1 }
      })
      if (response.data.success) {
        setShifts(response.data.data)
      }
    } catch (error) {
      logger.error('获取班次列表失败:', error)
    }
  }

  // 为自己选择班次排班
  const handleSelectShift = async () => {
    if (!selectedShift) {
      toast.error('请选择班次')
      return
    }

    if (!employee) {
      toast.error('员工信息未加载，请刷新页面')
      return
    }

    setLoading(true)

    try {
      // 使用北京时间获取今日日期，避免时区问题
      const today = formatBeijingDate(); // 使用格式化后的日期

      const response = await api.post('/schedules/self', {
        employee_id: employee.id,
        user_id: user.id,
        schedule_date: today,
        shift_id: selectedShift
      })

      if (response.data.success) {
        toast.success('班次选择成功')
        setShowShiftModal(false)
        setSelectedShift(null)
        // 重新获取今日排班信息
        fetchTodaySchedule()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '班次选择失败')
    } finally {
      setLoading(false)
    }
  }

  // 上班打卡
  const handleClockIn = async (isMakeup = false) => {
    if (!employee) {
      toast.error('员工信息未加载，请刷新页面')
      return
    }

    // 移除补打卡检查，始终允许员工打卡
    // 原有的时间检查逻辑已移除，员工可以随时打卡
    // 系统会根据实际打卡时间自动判断状态

    setLoading(true)

    try {
      const response = await api.post('/attendance/clock-in', {
        employee_id: employee.id,
        user_id: user.id
      })

      if (response.data.success) {
        toast.success(response.data.message)
        fetchTodayRecord()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '打卡失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async (isMakeup = false) => {
    if (!employee) {
      toast.error('员工信息未加载，请刷新页面')
      return
    }

    // 移除补打卡检查，始终允许员工打卡
    // 原有的时间检查逻辑已移除，员工可以随时打卡
    // 系统会根据实际打卡时间自动判断状态

    setLoading(true)

    try {
      const response = await api.post('/attendance/clock-out', {
        employee_id: employee.id,
        user_id: user.id
      })

      if (response.data.success) {
        toast.success(response.data.message)
        fetchTodayRecord()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '打卡失败')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-CN', { hour12: false })
  }

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
      early_leave: { text: '早退', color: 'bg-orange-500 text-white' }
    }
    const badge = badges[status] || badges.normal
    return (
      <span className={`px-3 py-1 rounded text-xs font-bold ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  // 检查是否在打卡时间范围内（上班）
  const checkClockInTime = () => {
    // 休息日不允许打卡
    if (todaySchedule && todaySchedule.shift_id == restShiftId) {
      return { allowed: false, message: '今日为休息日，无需打卡' }
    }
    // 无排班/无开始时间
    if (!todaySchedule || !todaySchedule.start_time) {
      return { allowed: false, message: '今日暂无排班信息，请先选择班次排班后再打卡' }
    }

    // 检查是否已到上班打卡时间
    const now = new Date();
    const [hours, minutes] = todaySchedule.start_time.split(':');
    const startDateTime = new Date();
    startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // 获取考勤设置中的上班打卡提前分钟数
    const earlyClockInMinutes = attendanceRules?.clock_in_advance || 60;
    const earlyClockInTime = new Date(startDateTime.getTime() - earlyClockInMinutes * 60000);

    if (now < earlyClockInTime) {
      const timeDiff = Math.ceil((earlyClockInTime - now) / 60000);
      return {
        allowed: false,
        message: `还未到上班打卡时间，需在上班前${earlyClockInMinutes}分钟内(${startDateTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}前${earlyClockInMinutes}分钟)才能打卡`
      };
    }

    return { allowed: true, message: '' }
  }

  // 检查是否在打卡时间范围内（下班）
  const checkClockOutTime = () => {
    // 休息日不允许打卡
    if (todaySchedule && todaySchedule.shift_id == restShiftId) {
      return { allowed: false, message: '今日为休息日，无需打卡' }
    }
    // 无排班/无结束时间
    if (!todaySchedule || !todaySchedule.end_time) {
      return { allowed: false, message: '今日暂无排班信息，请先选择班次排班后再打卡' }
    }

    // 检查是否已到下班打卡时间
    const now = new Date();
    const [hours, minutes] = todaySchedule.end_time.split(':');
    const endDateTime = new Date();
    endDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // 获取考勤设置中的早退阈值（分钟）
    // 下班打卡应在 (下班时间 - 早退阈值) 之后才开启
    const earlyLeaveThreshold = attendanceRules?.early_threshold || 30;
    const allowedClockOutTime = new Date(endDateTime.getTime() - earlyLeaveThreshold * 60000);

    if (now < allowedClockOutTime) {
      return {
        allowed: false,
        message: `还未到下班打卡时间，需在下班前${earlyLeaveThreshold}分钟内(${allowedClockOutTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}之后)才能打卡`
      };
    }

    return { allowed: true, message: '' }
  }

  // 检查打卡状态
  const clockInCheck = checkClockInTime()
  const clockOutCheck = checkClockOutTime()
  const isRestDay = todaySchedule && todaySchedule.shift_id == restShiftId

  return (
    <div className="min-h-screen p-4 bg-slate-50/50">
      <div className="max-w-5xl mx-auto">
        {/* 头部 & 时间 - 精致紧凑布局 */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex justify-between items-center border border-slate-100">
          <div>
            <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
              考勤打卡
              {employee && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"># {employee.employee_no}</span>}
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
               {formatDate(currentTime)}
            </p>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black text-blue-600 font-mono tracking-tighter leading-none">{formatTime(currentTime)}</div>
             <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">当前服务器时间</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左侧：打卡主要操作区 (占2/3) */}
          <div className="lg:col-span-2 space-y-4">
            {/* 今日打卡状态 */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">今日考勤状态</h2>
                </div>
                {/* 排班信息或选择班次按钮 */}
                {todaySchedule && todaySchedule.shift_id ? (
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded shadow-sm">
                      {todaySchedule.shift_name || '常规班次'}
                    </span>
                    <span className="text-slate-500">
                      {todaySchedule.start_time} - {todaySchedule.end_time}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowShiftModal(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-black transition-all shadow-md active:scale-95 flex items-center gap-1"
                  >
                    <span>📅 选择班次</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* 上班打卡 */}
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                  <div className="text-[10px] text-slate-400 font-black uppercase mb-2">上班打卡</div>
                  <div className={`text-lg font-black ${todayRecord?.clock_in_time ? 'text-slate-800' : 'text-slate-300'}`}>
                    {formatDateTime(todayRecord?.clock_in_time)}
                  </div>
                   {todayRecord?.status && ['late', 'leave'].includes(todayRecord.status) && (
                      <div className="mt-2 scale-90">{getStatusBadge(todayRecord.status)}</div>
                   )}
                </div>

                {/* 下班打卡 */}
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                  <div className="text-[10px] text-slate-400 font-black uppercase mb-2">下班打卡</div>
                  <div className={`text-lg font-black ${todayRecord?.clock_out_time ? 'text-slate-800' : 'text-slate-300'}`}>
                    {formatDateTime(todayRecord?.clock_out_time)}
                  </div>
                  {todayRecord?.status && ['early_leave', 'leave'].includes(todayRecord.status) && (
                      <div className="mt-2 scale-90">{getStatusBadge(todayRecord.status)}</div>
                   )}
                </div>

                {/* 工作时长 */}
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                  <div className="text-[10px] text-slate-400 font-black uppercase mb-2">计薪工时</div>
                  <div className="text-lg font-black text-slate-800">
                    {todayRecord?.work_hours ? `${todayRecord.work_hours}h` : '--'}
                  </div>
                   {todayRecord?.status && todayRecord.status === 'normal' && (
                      <div className="mt-2 scale-90">{getStatusBadge(todayRecord.status)}</div>
                   )}
                </div>
              </div>

              {/* 没有排班提示 */}
              {!todaySchedule && (
                <div className="bg-amber-50 border border-amber-200 rounded p-4 flex items-center gap-3 text-amber-700 mb-5 shadow-sm">
                    <span className="text-lg">⚠️</span>
                    <span className="font-medium">暂无排班，请先排班</span>
                </div>
              )}

              {/* 休息日提示 */}
              {isRestDay && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center gap-3 text-emerald-700 mb-5 shadow-sm">
                  <span className="text-lg">🛌</span>
                  <span className="font-medium">休息日，无需打卡</span>
                </div>
              )}

              {/* 打卡按钮区域 - 更紧凑 */}
              {!isRestDay && (
              <div className="grid grid-cols-2 gap-4">
                {/* 上班打卡按钮 */}
                <div>
                  {todayRecord?.clock_in_time ? (
                    <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-black cursor-not-allowed border border-slate-200">
                      已完成上班打卡
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      disabled={loading || !clockInCheck.allowed}
                      className={`w-full py-3 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${
                        loading
                          ? 'bg-slate-200 text-slate-400'
                          : clockInCheck.allowed
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {loading ? '处理中...' : '上班签到'}
                    </button>
                  )}
                   {!todayRecord?.clock_in_time && (
                      <div className="mt-2 text-center text-[10px] min-h-[16px]">
                        {clockInCheck.message ? (
                          <span className={clockInCheck.allowed ? "text-blue-600 font-bold" : "text-slate-400 font-medium"}>{clockInCheck.message}</span>
                        ) : (todaySchedule && <span className="text-blue-600 font-bold">签到时段已开启 ({todaySchedule.start_time})</span>)}
                      </div>
                   )}
                </div>

                {/* 下班打卡按钮 */}
                <div>
                  {todayRecord?.clock_out_time ? (
                    <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-black cursor-not-allowed border border-slate-200">
                      已完成下班打卡
                    </button>
                  ) : !todayRecord?.clock_in_time ? (
                    <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-black cursor-not-allowed border border-slate-200">
                      等待上班签到
                    </button>
                  ) : (
                    <button
                      onClick={handleClockOut}
                      disabled={loading || !clockOutCheck.allowed}
                      className={`w-full py-3 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${
                        loading
                          ? 'bg-slate-200 text-slate-400'
                          : clockOutCheck.allowed
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {loading ? '处理中...' : '下班签退'}
                    </button>
                  )}
                   {(!todayRecord?.clock_out_time && todayRecord?.clock_in_time) && (
                      <div className="mt-2 text-center text-[10px] min-h-[16px]">
                        {clockOutCheck.message ? (
                          <span className={clockOutCheck.allowed ? "text-indigo-600 font-bold" : "text-slate-400 font-medium"}>{clockOutCheck.message}</span>
                        ) : (todaySchedule && <span className="text-indigo-600 font-bold">签退时段已开启 ({todaySchedule.end_time})</span>)}
                      </div>
                   )}
                </div>
              </div>
              )}
            </div>
          </div>

          {/* 右侧：快捷入口 (占1/3) */}
          <div className="space-y-4">
             {/* 快捷菜单 */}
             <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 h-full">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-50">
                  <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">快捷自助功能</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate('attendance-records')} className="p-4 border border-slate-50 rounded-xl hover:bg-blue-50 text-center transition-all group shadow-sm hover:shadow-md">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">📋</div>
                    <div className="text-xs text-slate-700 font-black">打卡月报</div>
                  </button>
                  <button onClick={() => navigate('attendance-leave-apply')} className="p-4 border border-slate-50 rounded-xl hover:bg-amber-50 text-center transition-all group shadow-sm hover:shadow-md">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">🏖️</div>
                    <div className="text-xs text-slate-700 font-black">在线请假</div>
                  </button>
                  <button onClick={() => navigate('attendance-overtime-apply')} className="p-4 border border-slate-50 rounded-xl hover:bg-purple-50 text-center transition-all group shadow-sm hover:shadow-md">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">⏰</div>
                    <div className="text-xs text-slate-700 font-black">加班申请</div>
                  </button>
                   <button onClick={() => navigate('attendance-stats')} className="p-4 border border-slate-50 rounded-xl hover:bg-emerald-50 text-center transition-all group shadow-sm hover:shadow-md">
                    <div className="text-xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                    <div className="text-xs text-slate-700 font-black">数据统计</div>
                  </button>
                </div>
             </div>

             {/* 提示信息 */}
             {todayRecord?.status && ['late', 'early_leave'].includes(todayRecord.status) && (
                <div className={`rounded-xl p-4 text-[11px] font-bold flex items-center gap-3 animate-pulse ${todayRecord.status === 'late' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'} shadow-sm`}>
                   <span className="text-base">⚠️</span>
                   <span>系统提醒：您今日考勤存在异常状态</span>
                </div>
             )}
          </div>
        </div>

        {/* 测试功能按钮 - 仅用于开发测试 (更小巧且不易误触) */}
        <div className="mt-6 pt-4 border-t border-slate-100 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3 justify-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Debug:</span>
              <button
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: '物理删除记录',
                  message: '此操作将从数据库彻底抹除今日打卡数据，是否继续？',
                  type: 'danger',
                  onConfirm: async () => {
                    try {
                      const today = formatBeijingDate()
                      await api.delete('/attendance/today', {
                        params: { employee_id: employee?.id, date: today }
                      })
                      toast.success('物理记录已清除')
                      fetchTodayRecord()
                    } catch (error) {
                      toast.error('擦除失败')
                    }
                  }
                })
              }}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded text-[9px] font-black border border-slate-200 transition-all uppercase"
            >
            Reset Attendance
            </button>

            <button
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: '强制移除排班',
                  message: '确定要重置今日的班次安排吗？',
                  type: 'danger',
                  onConfirm: async () => {
                    try {
                      const today = formatBeijingDate();
                      await api.delete('/schedules/today', {
                        params: { employee_id: employee?.id, schedule_date: today }
                      })
                      toast.success('排班已重置')
                      setTodaySchedule(null)
                      fetchTodaySchedule()
                    } catch (error) {
                      toast.error('重置失败')
                    }
                  }
                })
              }}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded text-[9px] font-black border border-slate-200 transition-all uppercase"
            >
            Reset Schedule
            </button>
          </div>
        </div>

        {/* 选择班次模态框 */}
        {showShiftModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[5000] backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-100 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-base font-black text-blue-600 uppercase tracking-widest">申报今日班次</h3>
                  <button
                    onClick={() => {
                      setShowShiftModal(false)
                      setSelectedShift(null)
                    }}
                    className="text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1.5 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-[11px] font-bold text-slate-400 mb-4 uppercase">
                    请选择您今日的排班计划，提交后即可生效签到。
                  </p>

                  {shifts.length === 0 ? (
                    <div className="text-center py-8 text-slate-300">
                      <div className="text-2xl mb-2">📋</div>
                      <p className="text-xs font-black">暂无可用班次列表</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {shifts.map((shift) => (
                        <label
                          key={shift.id}
                          className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                            selectedShift === shift.id
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="shift"
                            value={shift.id}
                            checked={selectedShift === shift.id}
                            onChange={() => setSelectedShift(shift.id)}
                            className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="text-xs font-black text-slate-800">{shift.name}</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                              {shift.start_time} - {shift.end_time}
                              {shift.department_name && (
                                <span className="ml-2 px-1.5 py-0 bg-slate-100 text-slate-500 rounded text-[9px]">
                                  {shift.department_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowShiftModal(false)
                      setSelectedShift(null)
                    }}
                    className="flex-1 h-10 bg-slate-50 text-slate-500 rounded-xl font-black text-[11px] uppercase"
                  >
                    放弃
                  </button>
                  <button
                    onClick={handleSelectShift}
                    disabled={!selectedShift || loading}
                    className={`flex-1 h-10 rounded-xl transition-all font-black text-[11px] uppercase shadow-lg ${
                      !selectedShift || loading
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
                    }`}
                  >
                    {loading ? '同步中...' : '确认生效'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <CustomConfirmDialog />

      </div>
    </div>
  )
}
