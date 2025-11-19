import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { Calendar, Clock, TrendingUp, Award } from 'lucide-react'

const VacationDetails = () => {
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('year') // 'year' | 'month'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [vacationBalance, setVacationBalance] = useState(null)
  const [leaveRecords, setLeaveRecords] = useState([])
  const [overtimeStats, setOvertimeStats] = useState(null)
  const [employee, setEmployee] = useState(null)

  // 日历数据
  const [calendarData, setCalendarData] = useState({})

  useEffect(() => {
    loadData()
  }, [selectedYear, selectedMonth])

  const loadData = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      // 获取员工信息
      const empResponse = await fetch(`${API_BASE_URL}/employees/by-user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const empData = await empResponse.json()
      if (!empData.success) {
        toast.error(empData.message)
        return
      }
      setEmployee(empData.data)

      // 获取假期余额
      const balanceResponse = await fetch(
        `${API_BASE_URL}/vacation/balance?employee_id=${empData.data.id}&year=${selectedYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      const balanceData = await balanceResponse.json()
      if (balanceData.success) {
        setVacationBalance(balanceData.data)
      }

      // 获取请假记录
      const leaveResponse = await fetch(
        `${API_BASE_URL}/leave/records?employee_id=${empData.data.id}&status=all&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      const leaveData = await leaveResponse.json()
      if (leaveData.success) {
        setLeaveRecords(leaveData.data)
        // 构建日历数据
        buildCalendarData(leaveData.data)
      }

      // 获取加班统计
      const overtimeResponse = await fetch(
        `${API_BASE_URL}/overtime/stats?employee_id=${empData.data.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      const overtimeData = await overtimeResponse.json()
      if (overtimeData.success) {
        setOvertimeStats(overtimeData.data)
      }

    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const buildCalendarData = (records) => {
    const data = {}
    records.filter(r => r.status === 'approved').forEach(record => {
      const startDate = new Date(record.start_date)
      const endDate = new Date(record.end_date)

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        data[key] = {
          type: 'leave',
          leaveType: record.leave_type,
          reason: record.reason
        }
      }
    })
    setCalendarData(data)
  }

  const getMonthDays = () => {
    const year = selectedYear
    const month = selectedMonth
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const days = []

    // 填充上月的天数（为了对齐）
    const firstDayOfWeek = firstDay.getDay()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, -i)
      days.push({ date, isCurrentMonth: false })
    }

    // 填充本月天数
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month - 1, d), isCurrentMonth: true })
    }

    // 填充下月的天数（补齐）
    const remainingDays = 42 - days.length // 6 rows * 7 days
    for (let d = 1; d <= remainingDays; d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: false })
    }

    return days
  }

  const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
            {Icon && <Icon size={16} />}
            <span>{title}</span>
          </div>
          <div className={`text-3xl font-bold mb-1 ${color}`}>
            {value}
          </div>
          <div className="text-sm text-gray-500">{subtitle}</div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
            <TrendingUp size={14} />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  )

  const getDayStyle = (day) => {
    if (!day.isCurrentMonth) return 'text-gray-300'

    const dateKey = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`
    const dayData = calendarData[dateKey]

    if (dayData && dayData.type === 'leave') {
      const colorMap = {
        'annual': 'bg-blue-100 text-blue-700 border-blue-300',
        'sick': 'bg-orange-100 text-orange-700 border-orange-300',
        'compensatory': 'bg-green-100 text-green-700 border-green-300'
      }
      return colorMap[dayData.leaveType] || 'bg-gray-100'
    }

    return 'hover:bg-gray-50'
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <Calendar className="text-primary-600" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">假期明细</h1>
              <p className="text-sm text-gray-600 mt-1">查看您的假期余额和使用情况</p>
            </div>
          </div>

          {/* 视图切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'year'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              年度视图
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              月度视图
            </button>
          </div>
        </div>
      </div>

      {/* 时间选择器 */}
      <div className="mb-6 flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
            <option key={year} value={year}>{year}年</option>
          ))}
        </select>

        {viewMode === 'month' && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="年假额度"
          value={Number(vacationBalance?.annual_leave_remaining ?? 0).toFixed(1)}
          subtitle={`总额度 ${Number(vacationBalance?.annual_leave_total ?? 0).toFixed(1)} 天`}
          icon={Award}
          color="text-blue-600"
        />
        <StatCard
          title="病假余额"
          value={Number(vacationBalance?.sick_leave_remaining ?? 0).toFixed(1)}
          subtitle={`总额度 ${Number(vacationBalance?.sick_leave_total ?? 0).toFixed(1)} 天`}
          icon={Award}
          color="text-orange-600"
        />
        <StatCard
          title="调休余额"
          value={Number(vacationBalance?.compensatory_leave_remaining ?? 0).toFixed(1)}
          subtitle={`总额度 ${Number(vacationBalance?.compensatory_leave_total ?? 0).toFixed(1)} 天`}
          icon={Award}
          color="text-green-600"
        />
        <StatCard
          title="加班时长"
          value={Number(overtimeStats?.remaining_hours ?? 0).toFixed(1)}
          subtitle={`可转调休约 ${(Number(overtimeStats?.remaining_hours ?? 0) / 8).toFixed(1)} 天`}
          icon={Clock}
          color="text-purple-600"
        />
      </div>

      {/* 日历视图 */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {selectedYear}年{selectedMonth}月 假期日历
          </h2>

          {/* 图例 */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span>年假</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
              <span>病假</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span>调休</span>
            </div>
          </div>

          {/* 日历表格 */}
          <div className="grid grid-cols-7 gap-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}

            {getMonthDays().map((day, index) => (
              <div
                key={index}
                className={`
                  text-center py-3 rounded-lg border transition-colors cursor-pointer
                  ${getDayStyle(day)}
                `}
                title={
                  day.isCurrentMonth && calendarData[`${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`]
                    ? calendarData[`${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`].reason
                    : ''
                }
              >
                {day.date.getDate()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 假期余额变化趋势 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">使用明细</h2>
        <div className="space-y-3">
          {leaveRecords.filter(r => r.status === 'approved' && new Date(r.start_date).getFullYear() === selectedYear).map(record => (
            <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`
                  w-2 h-12 rounded-full
                  ${record.leave_type === 'annual' ? 'bg-blue-500' : ''}
                  ${record.leave_type === 'sick' ? 'bg-orange-500' : ''}
                  ${record.leave_type === 'compensatory' ? 'bg-green-500' : ''}
                `}></div>
                <div>
                  <div className="font-semibold text-gray-800">
                    {record.leave_type === 'annual' ? '年假' : record.leave_type === 'sick' ? '病假' : '调休'}
                    - {record.days} 天
                  </div>
                  <div className="text-sm text-gray-600">
                    {record.start_date} 至 {record.end_date}
                  </div>
                  {record.reason && (
                    <div className="text-sm text-gray-500 mt-1">理由: {record.reason}</div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(record.created_at)}
              </div>
            </div>
          ))}

          {leaveRecords.filter(r => r.status === 'approved' && new Date(r.start_date).getFullYear() === selectedYear).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              本年度暂无请假记录
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VacationDetails
