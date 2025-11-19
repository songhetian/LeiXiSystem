import { useState, useEffect } from 'react'
import { formatDate } from '../../utils/date'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'
import {
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'


export default function AttendanceRecordsOptimized() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('list') // list, calendar, timeline
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    status: 'all'
  })
  const [stats, setStats] = useState({
    total_days: 0,
    late_count: 0,
    early_count: 0,
    normal_count: 0,
    absent_count: 0,
    leave_count: 0,
    avg_work_hours: 0,
    attendance_rate: 0
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [employee] = useState({ id: 1, user_id: 1, name: '张三' })
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    fetchRecords()
  }, [pagination.page, filters, selectedMonth, viewMode])

  const fetchRecords = async () => {
    setLoading(true)
    try {
      // 如果是日历视图，自动设置日期范围为选中的月份
      let queryParams = {
        employee_id: employee.id,
        page: viewMode === 'calendar' ? 1 : pagination.page,
        limit: viewMode === 'calendar' ? 100 : pagination.limit,
        ...filters
      }

      // 日历视图：使用选中月份的日期范围
      if (viewMode === 'calendar') {
        const year = selectedMonth.getFullYear()
        const month = selectedMonth.getMonth()
        queryParams.start_date = new Date(year, month, 1).toISOString().split('T')[0]
        queryParams.end_date = new Date(year, month + 1, 0).toISOString().split('T')[0]
      }

      const response = await axios.get(getApiUrl('/api/attendance/records'), {
        params: queryParams
      })

      if (response.data.success) {
        setRecords(response.data.data)
        setPagination(prev => ({ ...prev, ...response.data.pagination }))
        calculateStats(response.data.data)
      }
    } catch (error) {
      toast.error('获取打卡记录失败')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    const stats = data.reduce((acc, record) => {
      acc.total_days++
      if (record.status === 'late') acc.late_count++
      if (record.status === 'early') acc.early_count++
      if (record.status === 'normal') acc.normal_count++
      if (record.status === 'absent') acc.absent_count++
      if (record.status === 'leave') acc.leave_count++
      if (record.work_hours) acc.total_work_hours += parseFloat(record.work_hours)
      return acc
    }, {
      total_days: 0,
      late_count: 0,
      early_count: 0,
      normal_count: 0,
      absent_count: 0,
      leave_count: 0,
      total_work_hours: 0
    })

    stats.avg_work_hours = stats.total_days > 0
      ? (stats.total_work_hours / stats.total_days).toFixed(1)
      : 0
    stats.attendance_rate = stats.total_days > 0
      ? ((stats.normal_count / stats.total_days) * 100).toFixed(1)
      : 0

    setStats(stats)
  }

  const handleQuickFilter = (type) => {
    const today = new Date()
    let start_date, end_date

    switch (type) {
      case 'today':
        start_date = end_date = today.toISOString().split('T')[0]
        break
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay() + 1)
        start_date = weekStart.toISOString().split('T')[0]
        end_date = today.toISOString().split('T')[0]
        break
      case 'month':
        start_date = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        end_date = today.toISOString().split('T')[0]
        break
      default:
        start_date = end_date = ''
    }

    setFilters({ ...filters, start_date, end_date })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const exportRecords = () => {
    // 导出为CSV
    const headers = ['日期', '上班打卡', '下班打卡', '工作时长', '状态', '备注']
    const csvData = records.map(record => [
      record.record_date,
      formatDateTime(record.clock_in_time),
      formatDateTime(record.clock_out_time),
      record.work_hours || '--',
      getStatusText(record.status),
      record.remark || '--'
    ])

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `考勤记录_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('导出成功')
  }

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '--:--'
    const date = new Date(dateTimeStr)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  

  const getStatusText = (status) => {
    const statusMap = {
      normal: '正常',
      late: '迟到',
      early: '早退',
      absent: '缺勤',
      leave: '请假'
    }
    return statusMap[status] || '未知'
  }

  const getStatusBadge = (status) => {
    const badges = {
      normal: { text: '正常', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      late: { text: '迟到', color: 'bg-red-100 text-red-800', icon: ExclamationCircleIcon },
      early: { text: '早退', color: 'bg-orange-100 text-orange-800', icon: ExclamationCircleIcon },
      absent: { text: '缺勤', color: 'bg-gray-100 text-gray-800', icon: XCircleIcon },
      leave: { text: '请假', color: 'bg-blue-100 text-blue-800', icon: ClockIcon }
    }
    const badge = badges[status] || badges.normal
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    )
  }

  // 渲染统计卡片
  const renderStatsCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">总天数</div>
            <div className="text-3xl font-bold mt-1">{stats.total_days}</div>
          </div>
          <CalendarIcon className="w-10 h-10 opacity-50" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">正常</div>
            <div className="text-3xl font-bold mt-1">{stats.normal_count}</div>
          </div>
          <CheckCircleIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="text-xs mt-2 opacity-90">出勤率 {stats.attendance_rate}%</div>
      </div>

      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">迟到</div>
            <div className="text-3xl font-bold mt-1">{stats.late_count}</div>
          </div>
          <ExclamationCircleIcon className="w-10 h-10 opacity-50" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">早退</div>
            <div className="text-3xl font-bold mt-1">{stats.early_count}</div>
          </div>
          <ExclamationCircleIcon className="w-10 h-10 opacity-50" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">缺勤</div>
            <div className="text-3xl font-bold mt-1">{stats.absent_count}</div>
          </div>
          <XCircleIcon className="w-10 h-10 opacity-50" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">平均工时</div>
            <div className="text-3xl font-bold mt-1">{stats.avg_work_hours}</div>
          </div>
          <ClockIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="text-xs mt-2 opacity-90">小时/天</div>
      </div>
    </div>
  )

  // 渲染日历视图
  const renderCalendarView = () => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days = []
    // 填充空白天数
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    // 填充实际天数
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    const getRecordForDay = (day) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return records.find(r => r.record_date === dateStr)
    }

    return (
      <div className="bg-white rounded-lg shadow p-6">
        {/* 月份选择器 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedMonth(new Date(year, month - 1))}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            ← 上月
          </button>
          <h3 className="text-xl font-bold">
            {year}年{month + 1}月
          </h3>
          <button
            onClick={() => setSelectedMonth(new Date(year, month + 1))}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            下月 →
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="text-center font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* 日历格子 */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const record = getRecordForDay(day)
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString()

            return (
              <div
                key={day}
                onClick={() => {
                  if (record) {
                    setSelectedRecord(record)
                    setShowDetailModal(true)
                  }
                }}
                className={`
                  aspect-square border rounded-lg p-2 hover:shadow-md transition-shadow cursor-pointer
                  ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
                  ${record ? 'bg-white hover:bg-blue-50' : 'bg-gray-50'}
                `}
              >
                <div className="text-sm font-semibold mb-1">{day}</div>
                {record && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">
                      ↑ {formatDateTime(record.clock_in_time)}
                    </div>
                    <div className="text-xs text-gray-600">
                      ↓ {formatDateTime(record.clock_out_time)}
                    </div>
                    <div className="flex justify-center mt-1">
                      {getStatusBadge(record.status)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 渲染时间轴视图
  const renderTimelineView = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="space-y-4">
        {records.map((record, index) => (
          <div key={record.id} className="relative">
            {/* 时间轴线 */}
            {index < records.length - 1 && (
              <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
            )}

            <div className="flex gap-4">
              {/* 日期圆点 */}
              <div className="flex-shrink-0">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-bold text-white
                  ${record.status === 'normal' ? 'bg-green-500' :
                    record.status === 'late' ? 'bg-red-500' :
                    record.status === 'early' ? 'bg-orange-500' :
                    record.status === 'leave' ? 'bg-blue-500' : 'bg-gray-500'}
                `}>
                  {new Date(record.record_date).getDate()}
                </div>
              </div>

              {/* 记录卡片 */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                      <div className="font-semibold text-lg text-gray-800">{formatDate(record.record_date)}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      工作时长: {record.work_hours ? `${record.work_hours}小时` : '未完成'}
                    </div>
                  </div>
                  {getStatusBadge(record.status)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* 上班打卡 */}
                  <div className="flex items-center gap-3 bg-white rounded p-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-xl">↑</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">上班打卡</div>
                      <div className="font-semibold text-gray-800">
                        {formatDateTime(record.clock_in_time)}
                      </div>
                      {record.clock_in_location && (
                        <div className="text-xs text-gray-500 mt-1">
                          📍 {record.clock_in_location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 下班打卡 */}
                  <div className="flex items-center gap-3 bg-white rounded p-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-xl">↓</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">下班打卡</div>
                      <div className="font-semibold text-gray-800">
                        {formatDateTime(record.clock_out_time)}
                      </div>
                      {record.clock_out_location && (
                        <div className="text-xs text-gray-500 mt-1">
                          📍 {record.clock_out_location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {record.remark && (
                  <div className="mt-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-gray-700">
                    💬 {record.remark}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // 渲染列表视图
  const renderListView = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {loading ? (
        <div className="p-8 text-center text-gray-500">加载中...</div>
      ) : records.length === 0 ? (
        <div className="p-8 text-center text-gray-500">暂无打卡记录</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    日期
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    上班打卡
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    下班打卡
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    工作时长
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    备注
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className={`
                      hover:bg-gray-50 transition-colors
                      ${record.status === 'late' || record.status === 'early' ? 'bg-red-50' : ''}
                      ${record.status === 'absent' ? 'bg-gray-100' : ''}
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(record.record_date)}
                          </div>
                          
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 text-sm">↑</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateTime(record.clock_in_time)}
                          </div>
                          {record.clock_in_location && (
                            <div className="text-xs text-gray-500">📍 {record.clock_in_location}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-sm">↓</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateTime(record.clock_out_time)}
                          </div>
                          {record.clock_out_location && (
                            <div className="text-xs text-gray-500">📍 {record.clock_out_location}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {record.work_hours ? `${record.work_hours}h` : '--'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {record.remark || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {pagination.total > 0 && (
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700">
                  共 <span className="font-semibold">{pagination.total}</span> 条记录
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">每页显示</label>
                  <select
                    value={pagination.limit}
                    onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                    className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="10">10条</option>
                    <option value="20">20条</option>
                    <option value="50">50条</option>
                    <option value="100">100条</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  第 {pagination.page} / {Math.ceil(pagination.total / pagination.limit)} 页
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                  className="px-4 py-2 border rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  // 渲染详情模态框
  const renderDetailModal = () => {
    if (!showDetailModal || !selectedRecord) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* 模态框头部 */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">打卡详情</h3>
              <p className="text-sm opacity-90 mt-1">{formatDate(selectedRecord.record_date)}</p>
            </div>
            <button
              onClick={() => setShowDetailModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 模态框内容 */}
          <div className="p-6 space-y-6">
            {/* 状态卡片 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">考勤状态</div>
                <div className="mt-2">{getStatusBadge(selectedRecord.status)}</div>
              </div>
              {selectedRecord.work_hours && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">工作时长</div>
                  <div className="text-2xl font-bold text-gray-800 mt-1">
                    {selectedRecord.work_hours} <span className="text-sm font-normal">小时</span>
                  </div>
                </div>
              )}
            </div>

            {/* 打卡信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 上班打卡 */}
              <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-2xl">↑</span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">上班打卡</div>
                    <div className="text-xl font-bold text-gray-800">
                      {formatDateTime(selectedRecord.clock_in_time)}
                    </div>
                  </div>
                </div>
                {selectedRecord.clock_in_location && (
                  <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{selectedRecord.clock_in_location}</span>
                  </div>
                )}
              </div>

              {/* 下班打卡 */}
              <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-2xl">↓</span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">下班打卡</div>
                    <div className="text-xl font-bold text-gray-800">
                      {formatDateTime(selectedRecord.clock_out_time)}
                    </div>
                  </div>
                </div>
                {selectedRecord.clock_out_location && (
                  <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{selectedRecord.clock_out_location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 备注信息 */}
            {selectedRecord.remark && (
              <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-800 mb-1">备注</div>
                    <div className="text-gray-700">{selectedRecord.remark}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 详细信息 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">详细信息</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">记录ID：</span>
                  <span className="text-gray-800 font-medium">{selectedRecord.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">日期：</span>
                  <span className="text-gray-800 font-medium">{selectedRecord.record_date}</span>
                </div>
                {selectedRecord.overtime_hours > 0 && (
                  <div>
                    <span className="text-gray-600">加班时长：</span>
                    <span className="text-gray-800 font-medium">{selectedRecord.overtime_hours}小时</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 模态框底部 */}
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
            <button
              onClick={() => setShowDetailModal(false)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">打卡记录</h1>
            <p className="text-gray-600 mt-1">查看您的考勤打卡历史记录</p>
          </div>
          <button
            onClick={exportRecords}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <DocumentArrowDownIcon className="w-5 h-5" />
            导出记录
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {renderStatsCards()}

      {/* 筛选器和视图切换 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end justify-between">
          {/* 左侧筛选 */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* 快捷筛选 */}
            <div className="flex gap-2">
              <button
                onClick={() => handleQuickFilter('today')}
                className={`px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors ${
                  filters.start_date === new Date().toISOString().split('T')[0] ? 'bg-blue-50 border-blue-500' : ''
                }`}
              >
                今天
              </button>
              <button
                onClick={() => handleQuickFilter('week')}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                本周
              </button>
              <button
                onClick={() => handleQuickFilter('month')}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                本月
              </button>
              <button
                onClick={() => handleQuickFilter('all')}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                全部
              </button>
            </div>

            {/* 日期范围 */}
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">至</span>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 状态筛选 */}
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="normal">正常</option>
              <option value="late">迟到</option>
              <option value="early">早退</option>
              <option value="absent">缺勤</option>
              <option value="leave">请假</option>
            </select>
          </div>

          {/* 右侧视图切换 */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              列表视图
            </button>
            <button
              onClick={() => {
                setViewMode('calendar')
                // 切换到日历视图时，如果没有选择月份，默认为当前月份
                if (!selectedMonth) {
                  setSelectedMonth(new Date())
                }
              }}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              日历视图
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'timeline' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              时间轴
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'calendar' && renderCalendarView()}
      {viewMode === 'timeline' && renderTimelineView()}

      {/* 详情模态框 */}
      {renderDetailModal()}
    </div>
  )
}
