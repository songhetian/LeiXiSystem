import { useState, useEffect } from 'react'
import { formatDate } from '../../utils/date'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


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
      const response = await axios.get(getApiUrl(`/api/employees/by-user/${userId}`))
      if (response.data.success && response.data.data) {
        setEmployee(response.data.data)
      } else {
        toast.error('未找到员工信息，请联系管理员')
      }
    } catch (error) {
      console.error('获取员工信息失败:', error)
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
      const response = await axios.get(getApiUrl('/api/attendance/settings'))
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
      console.error('获取考勤设置失败:', error)
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
      const response = await axios.get(getApiUrl('/api/shifts/rest'))
      if (response.data.success) {
        setRestShiftId(response.data.data.id)
      }
    } catch (error) {
      console.error('获取休息班次失败:', error)
    }
  }

  const fetchTodayRecord = async () => {
    if (!employee) return

    try {
      const response = await axios.get(getApiUrl('/api/attendance/today'), {
        params: { employee_id: employee.id }
      })
      if (response.data.success) {
        setTodayRecord(response.data.data)
      }
    } catch (error) {
      console.error('获取今日打卡状态失败:', error)
    }
  }

  // 获取今日排班信息
  const fetchTodaySchedule = async () => {
    if (!employee) {
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]

      const response = await axios.get(getApiUrl('/api/schedules'), {
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
      console.error('获取今日排班信息失败:', error)
    }
  }

  // 获取班次列表
  const fetchShifts = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/shifts'), {
        params: { limit: 100, is_active: 1 }
      })
      if (response.data.success) {
        setShifts(response.data.data)
      }
    } catch (error) {
      console.error('获取班次列表失败:', error)
    }
  }

  // 为自己选择班次排班
  const handleSelectShift = async () => {
    if (!selectedShift) {
      toast.error('请选择班次')
      return
    }

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const response = await axios.post(getApiUrl('/api/schedules'), {
        employee_id: employee.id,
        shift_id: selectedShift,
        schedule_date: today,
        is_rest_day: 0
      })

      if (response.data.success) {
        toast.success('排班设置成功')
        setShowShiftModal(false)
        setSelectedShift(null)

        // 等待一小段时间确保后端数据已保存
        await new Promise(resolve => setTimeout(resolve, 500))

        // 强制刷新页面数据
        setRefreshKey(prev => prev + 1)
        await fetchTodaySchedule()
      }
    } catch (error) {
      console.error('排班设置失败:', error)
      toast.error(error.response?.data?.message || '排班设置失败')
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

    // 如果不是补打卡，检查打卡时间
    if (!isMakeup) {
      const timeCheck = checkClockInTime()
      if (!timeCheck.allowed) {
        setTimeoutMessage(timeCheck.message)
        setShowTimeoutModal(true)
        return
      }
    }

    setLoading(true)

    try {
      const response = await axios.post(getApiUrl('/api/attendance/clock-in'), {
        employee_id: employee.id,
        user_id: user.id,
        is_makeup: isMakeup // 标记是否为补打卡
      })

      if (response.data.success) {
        toast.success(isMakeup ? '补打卡成功' : response.data.message)
        fetchTodayRecord()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '打卡失败')
    } finally {
      setLoading(false)
    }
  }

  // 下班打卡
  const handleClockOut = async (isMakeup = false) => {
    if (!employee) {
      toast.error('员工信息未加载，请刷新页面')
      return
    }

    // 如果不是补打卡，检查打卡时间
    if (!isMakeup) {
      const timeCheck = checkClockOutTime()
      if (!timeCheck.allowed) {
        setTimeoutMessage(timeCheck.message)
        setShowTimeoutModal(true)
        return
      }
    }

    setLoading(true)

    try {
      const response = await axios.post(getApiUrl('/api/attendance/clock-out'), {
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
      normal: { text: '正常', color: 'bg-green-100 text-green-800' },
      late: { text: '迟到', color: 'bg-red-100 text-red-800' },
      early: { text: '早退', color: 'bg-orange-100 text-orange-800' },
      absent: { text: '缺勤', color: 'bg-gray-100 text-gray-800' },
      leave: { text: '请假', color: 'bg-blue-100 text-blue-800' }
    }
    const badge = badges[status] || badges.normal
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
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

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMinute] = todaySchedule.start_time.split(':').map(Number)
    const shiftStartTime = startHour * 60 + startMinute

    const clockInAdvance = attendanceRules?.clock_in_advance || 30
    const lateThreshold = attendanceRules?.late_threshold || 30
    const allowedStartTime = shiftStartTime - clockInAdvance
    const allowedEndTime = shiftStartTime + lateThreshold

    if (currentTime < allowedStartTime) {
      const allowedTime = `${String(Math.floor(allowedStartTime / 60)).padStart(2, '0')}:${String(allowedStartTime % 60).padStart(2, '0')}`
      const shiftTime = `${String(Math.floor(shiftStartTime / 60)).padStart(2, '0')}:${String(shiftStartTime % 60).padStart(2, '0')}`
      return { allowed: false, message: `打卡时间太早！班次上班时间为 ${shiftTime}，最早可在 ${allowedTime} 打卡（提前${clockInAdvance}分钟）` }
    }

    if (currentTime > allowedEndTime) {
      const endTime = `${String(Math.floor(allowedEndTime / 60)).padStart(2, '0')}:${String(allowedEndTime % 60).padStart(2, '0')}`
      const shiftTime = `${String(Math.floor(shiftStartTime / 60)).padStart(2, '0')}:${String(shiftStartTime % 60).padStart(2, '0')}`
      return { allowed: false, message: `已超过打卡时间！班次上班时间为 ${shiftTime}，最晚可在 ${endTime} 打卡（迟到阈值${lateThreshold}分钟）。请使用"补打卡"功能。` }
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

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [endHour, endMinute] = todaySchedule.end_time.split(':').map(Number)
    const shiftEndTime = endHour * 60 + endMinute

    const earlyThreshold = attendanceRules?.early_threshold || 30
    const clockOutDelay = attendanceRules?.clock_out_delay || 120
    const allowedStartTime = shiftEndTime - earlyThreshold
    const allowedEndTime = shiftEndTime + clockOutDelay

    if (currentTime < allowedStartTime) {
      const allowedTime = `${String(Math.floor(allowedStartTime / 60)).padStart(2, '0')}:${String(allowedStartTime % 60).padStart(2, '0')}`
      const shiftTime = `${String(Math.floor(shiftEndTime / 60)).padStart(2, '0')}:${String(shiftEndTime % 60).padStart(2, '0')}`
      return { allowed: false, message: `打卡时间太早！班次下班时间为 ${shiftTime}，最早可在 ${allowedTime} 打卡（早退阈值${earlyThreshold}分钟）` }
    }

    if (currentTime > allowedEndTime) {
      const maxTime = `${String(Math.floor(allowedEndTime / 60) % 24).padStart(2, '0')}:${String(allowedEndTime % 60).padStart(2, '0')}`
      const shiftTime = `${String(Math.floor(shiftEndTime / 60)).padStart(2, '0')}:${String(shiftEndTime % 60).padStart(2, '0')}`
      return { allowed: false, message: `已超过打卡时间！班次下班时间为 ${shiftTime}，最晚可在 ${maxTime} 打卡（延后${clockOutDelay}分钟）。请使用"补打卡"功能。` }
    }

    return { allowed: true, message: '' }
  }

  // 检查打卡状态
  const clockInCheck = checkClockInTime()
  const clockOutCheck = checkClockOutTime()
  const isRestDay = todaySchedule && todaySchedule.shift_id == restShiftId

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">考勤打卡</h1>
        <p className="text-gray-600 mt-1">
          欢迎，{user?.real_name || user?.username || '加载中...'}
          {employee && <span className="text-sm text-gray-500 ml-2">({employee.employee_no})</span>}
        </p>
      </div>

      {/* 当前时间卡片 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-8 mb-6 text-white">
        <div className="text-center">
          <div className="text-5xl font-bold mb-2">{formatTime(currentTime)}</div>
          <div className="text-lg opacity-90">{formatDate(currentTime)}</div>
        </div>
      </div>

      {/* 今日打卡状态 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">今日打卡状态</h2>
          {/* 排班信息或选择班次按钮 */}
          {todaySchedule ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">今日班次：</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                {todaySchedule.shift_name || '休息日'}
              </span>
              {todaySchedule.start_time && todaySchedule.end_time && (
                <span className="text-gray-500">
                  {todaySchedule.start_time} - {todaySchedule.end_time}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowShiftModal(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <span>📅</span>
              <span>选择班次排班</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 上班打卡 */}
          <div className="border rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">上班打卡</div>
            <div className="text-2xl font-bold text-gray-800">
              {formatDateTime(todayRecord?.clock_in_time)}
            </div>
          </div>

          {/* 下班打卡 */}
          <div className="border rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">下班打卡</div>
            <div className="text-2xl font-bold text-gray-800">
              {formatDateTime(todayRecord?.clock_out_time)}
            </div>
          </div>

          {/* 工作时长 */}
          <div className="border rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">工作时长</div>
            <div className="text-2xl font-bold text-gray-800">
              {todayRecord?.work_hours ? `${todayRecord.work_hours}h` : '--'}
            </div>
            {todayRecord?.status && (
              <div className="mt-2">
                {getStatusBadge(todayRecord.status)}
              </div>
            )}
          </div>
        </div>

        {/* 没有排班提示 */}
        {!todaySchedule && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 mb-1">今日暂无排班信息</p>
                <p className="text-sm text-yellow-800">
                  请点击右上角"选择班次排班"按钮为自己安排今日班次，或联系管理员进行排班。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 休息日提示 */}
      {isRestDay && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg">🛌</span>
            <div className="flex-1 text-sm text-green-800">今日为休息日，无需打卡</div>
          </div>
        </div>
      )}

      {/* 打卡按钮 */}
      {!isRestDay && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 上班打卡按钮 */}
        <div>
          {todayRecord?.clock_in_time ? (
            <button
              disabled
              className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-gray-300 text-gray-500 cursor-not-allowed"
            >
              已打上班卡
            </button>
          ) : clockInCheck.allowed ? (
            <>
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-green-500 hover:bg-green-600 text-white transition-colors shadow-lg"
              >
                {loading ? '打卡中...' : '✓ 上班打卡'}
              </button>
              {todaySchedule && (
                <div className="mt-2 text-center text-sm text-green-600 font-medium">
                  ✓ 可以打卡（{todaySchedule.start_time} 班次）
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setTimeoutMessage(clockInCheck.message)
                  setShowTimeoutModal(true)
                }}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              >
                补打上班卡
              </button>
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
                  <div className="text-sm text-red-700">
                    <div className="font-semibold mb-1">无法正常打卡</div>
                    <div>{clockInCheck.message}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 下班打卡按钮 */}
        <div>
          {todayRecord?.clock_out_time ? (
            <button
              disabled
              className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-gray-300 text-gray-500 cursor-not-allowed"
            >
              已打下班卡
            </button>
          ) : !todayRecord?.clock_in_time ? (
            <>
              <button
                disabled
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-gray-300 text-gray-500 cursor-not-allowed"
              >
                请先打上班卡
              </button>
              <div className="mt-2 text-center text-sm text-gray-500">
                需要先完成上班打卡
              </div>
            </>
          ) : clockOutCheck.allowed ? (
            <>
              <button
                onClick={handleClockOut}
                disabled={loading}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-lg"
              >
                {loading ? '打卡中...' : '✓ 下班打卡'}
              </button>
              {todaySchedule && (
                <div className="mt-2 text-center text-sm text-blue-600 font-medium">
                  ✓ 可以打卡（{todaySchedule.end_time} 下班）
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setTimeoutMessage(clockOutCheck.message)
                  setShowTimeoutModal(true)
                }}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              >
                补打下班卡
              </button>
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
                  <div className="text-sm text-red-700">
                    <div className="font-semibold mb-1">无法正常打卡</div>
                    <div>{clockOutCheck.message}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      )}
      {/* 提示信息 */}
      {todayRecord?.status === 'late' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <span className="text-red-800">您今天迟到了，请注意准时上班</span>
          </div>
        </div>
      )}

      {todayRecord?.status === 'early' && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-orange-600 mr-2">⚠️</span>
            <span className="text-orange-800">您今天早退了，请注意工作时间</span>
          </div>
        </div>
      )}

      {/* 快捷入口 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('attendance-records')}
          className="border rounded-lg p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="text-sm font-medium">打卡记录</div>
        </button>
        <button
          onClick={() => navigate('attendance-leave-apply')}
          className="border rounded-lg p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="text-2xl mb-2">🏖️</div>
          <div className="text-sm font-medium">请假申请</div>
        </button>
        <button
          onClick={() => navigate('attendance-overtime-apply')}
          className="border rounded-lg p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="text-2xl mb-2">⏰</div>
          <div className="text-sm font-medium">加班申请</div>
        </button>
        <button
          onClick={() => navigate('attendance-stats')}
          className="border rounded-lg p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="text-2xl mb-2">📊</div>
          <div className="text-sm font-medium">考勤统计</div>
        </button>
      </div>

      {/* 测试功能按钮 - 仅用于开发测试 */}
      <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-600 text-lg">🔧</span>
          <h3 className="text-sm font-semibold text-red-800">测试功能（仅删除当天记录）</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={async () => {
              if (!window.confirm('确定要删除今天的打卡记录吗？此操作不可恢复！')) return
              try {
                const today = new Date().toISOString().split('T')[0]
                await axios.delete(getApiUrl('/api/attendance/today'), {
                  params: { employee_id: employee?.id, date: today }
                })
                toast.success('今日打卡记录已删除')
                fetchTodayRecord()
              } catch (error) {
                toast.error('删除失败: ' + (error.response?.data?.message || error.message))
              }
            }}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🗑️ 删除打卡记录
          </button>

          <button
            onClick={async () => {
              if (!window.confirm('确定要删除今天的班次安排吗？此操作不可恢复！')) return
              try {
                const today = new Date().toISOString().split('T')[0]
                await axios.delete(getApiUrl('/api/schedules/today'), {
                  params: { employee_id: employee?.id, date: today }
                })
                toast.success('今日班次已删除')
                setTodaySchedule(null)
                fetchTodaySchedule()
              } catch (error) {
                toast.error('删除失败: ' + (error.response?.data?.message || error.message))
              }
            }}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🗑️ 删除班次
          </button>
        </div>
        <p className="text-xs text-red-600 mt-2">⚠️ 警告：这些按钮仅用于测试，只会删除当天的记录</p>
      </div>

      {/* 选择班次模态框 */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">选择今日班次</h3>
                <button
                  onClick={() => {
                    setShowShiftModal(false)
                    setSelectedShift(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  请为今天选择一个班次，设置后即可正常打卡。
                </p>

                {shifts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>暂无可用班次</p>
                    <p className="text-sm mt-2">请联系管理员添加班次</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {shifts.map((shift) => (
                      <label
                        key={shift.id}
                        className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedShift === shift.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shift"
                          value={shift.id}
                          checked={selectedShift === shift.id}
                          onChange={() => setSelectedShift(shift.id)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{shift.name}</div>
                          <div className="text-sm text-gray-600">
                            {shift.start_time} - {shift.end_time}
                            {shift.department_name && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({shift.department_name})
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSelectShift}
                  disabled={!selectedShift || loading}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    !selectedShift || loading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {loading ? '设置中...' : '确认'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 超时提示模态框（休息日不显示） */}
      {showTimeoutModal && !isRestDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-4xl">⚠️</span>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-center mb-2">补打卡确认</h3>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-800 text-center">
                  {timeoutMessage}
                </p>
              </div>

              {todaySchedule && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-sm text-gray-600 text-center">
                    <p className="mb-1">今日班次：<span className="font-medium text-gray-900">{todaySchedule.shift_name}</span></p>
                    <p>工作时间：<span className="font-medium text-gray-900">{todaySchedule.start_time} - {todaySchedule.end_time}</span></p>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-800 text-center">
                  💡 提示：补打卡记录将标记为"异常"状态，需要后续向管理员说明原因。
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTimeoutModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowTimeoutModal(false)
                    // 根据当前状态判断是上班还是下班补打卡，传递 isMakeup=true
                    if (!todayRecord?.clock_in_time) {
                      handleClockIn(true)  // 补打上班卡
                    } else {
                      handleClockOut(true)  // 补打下班卡
                    }
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  {loading ? '打卡中...' : '确认补打卡'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
