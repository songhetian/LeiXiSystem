
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getCurrentUser, isSystemAdmin } from '../../utils/auth'
import { getApiUrl } from '../../utils/apiConfig'


export default function DepartmentStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')

  // Date Selection Mode: 'month' or 'custom'
  const [dateMode, setDateMode] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // Search
  const [keyword, setKeyword] = useState('')

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })

  // Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null)
  const [employeeDetails, setEmployeeDetails] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentStats()
    }
  }, [selectedDepartment, selectedMonth, customDateRange, dateMode, pagination.page, pagination.limit])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedDepartment) {
        setPagination(prev => ({ ...prev, page: 1 }))
        fetchDepartmentStats()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [keyword])

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}

      const response = await axios.get(getApiUrl('/api/departments/list'), { headers })
      if (response.data.success) {
        const activeDepts = response.data.data.filter(d => d.status === 'active')

        setDepartments(activeDepts)
        if (activeDepts.length > 0) {
          setSelectedDepartment(activeDepts[0].id)
        } else {
          toast.warning('没有可用的部门，请联系管理员配置部门权限')
        }
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      toast.error('获取部门列表失败')
    }
  }

  const fetchDepartmentStats = async () => {
    setLoading(true)
    try {
      const params = {
        department_id: selectedDepartment,
        page: pagination.page,
        limit: pagination.limit,
        keyword: keyword
      }

      if (dateMode === 'month') {
        params.year = selectedMonth.year
        params.month = selectedMonth.month
      } else {
        params.start_date = customDateRange.start
        params.end_date = customDateRange.end
      }

      const response = await axios.get(getApiUrl('/api/attendance/department-stats'), {
        params
      })

      if (response.data.success) {
        setStats(response.data.data)
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.data.pagination.total
          }))
        }
      }
    } catch (error) {
      console.error('获取部门统计失败:', error)
      // toast.error('获取部门统计失败') // Prevent spamming toasts on search
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployeeDetails = async (employee) => {
    setSelectedEmployeeForDetails(employee)
    setShowDetailsModal(true)
    setDetailsLoading(true)
    setEmployeeDetails([])

    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      let startDate, endDate
      if (dateMode === 'month') {
        startDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`
        endDate = new Date(selectedMonth.year, selectedMonth.month, 0).toISOString().split('T')[0]
      } else {
        startDate = customDateRange.start
        endDate = customDateRange.end
      }

      const response = await axios.get(getApiUrl('/api/attendance/records'), {
        params: {
          employee_id: employee.user_id, // Using user_id from stats as employee_id for records API
          start_date: startDate,
          end_date: endDate
        },
        headers
      })

      if (response.data.success) {
        setEmployeeDetails(response.data.data)
      }
    } catch (error) {
      console.error('获取详情失败:', error)
      toast.error('获取详情失败')
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleMonthChange = (year, month) => {
    setSelectedMonth({ year, month })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePrevMonth = () => {
    const newMonth = selectedMonth.month - 1
    if (newMonth < 1) {
      handleMonthChange(selectedMonth.year - 1, 12)
    } else {
      handleMonthChange(selectedMonth.year, newMonth)
    }
  }

  const handleNextMonth = () => {
    const newMonth = selectedMonth.month + 1
    if (newMonth > 12) {
      handleMonthChange(selectedMonth.year + 1, 1)
    } else {
      handleMonthChange(selectedMonth.year, newMonth)
    }
  }

  const handleThisMonth = () => {
    const now = new Date()
    handleMonthChange(now.getFullYear(), now.getMonth() + 1)
  }

  const handleExport = () => {
    let url = getApiUrl(`/api/export/department/${selectedDepartment}`)
    if (dateMode === 'month') {
      const month = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`
      url += `?month=${month}`
    } else {
      url += `?start_date=${customDateRange.start}&end_date=${customDateRange.end}`
    }

    if (keyword) {
        url += `&keyword=${encodeURIComponent(keyword)}`
    }

    window.open(url, '_blank')
    toast.success('正在导出...')
  }

  const isCurrentMonth = () => {
    const now = new Date()
    return selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth() + 1
  }

  return (
    <div className="p-6">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">部门考勤统计</h1>
          <p className="text-gray-600 mt-1">查看部门员工的考勤数据</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!stats}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出报表
        </button>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 部门选择 */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择部门
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* 统计模式选择 */}
          <div className="md:col-span-1">
             <label className="block text-sm font-medium text-gray-700 mb-2">
              统计模式
            </label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDateMode('month')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dateMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                按月统计
              </button>
              <button
                onClick={() => setDateMode('custom')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dateMode === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                自定义日期
              </button>
            </div>
          </div>

          {/* 日期选择 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {dateMode === 'month' ? '选择月份' : '选择日期范围'}
            </label>

            {dateMode === 'month' ? (
              <div className="flex items-stretch gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="上个月"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2 flex-1 justify-center">
                    <select
                      value={selectedMonth.year}
                      onChange={(e) => handleMonthChange(parseInt(e.target.value), selectedMonth.month)}
                      className="bg-transparent border-none font-bold text-gray-800 focus:ring-0 cursor-pointer"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                        <option key={year} value={year}>{year}年</option>
                      ))}
                    </select>

                    <select
                      value={selectedMonth.month}
                      onChange={(e) => handleMonthChange(selectedMonth.year, parseInt(e.target.value))}
                      className="bg-transparent border-none font-bold text-gray-800 focus:ring-0 cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month}>{month}月</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleNextMonth}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="下个月"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={handleThisMonth}
                  disabled={isCurrentMonth()}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  本月
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-500">至</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* 搜索框 */}
          <div className="md:col-span-4">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索姓名或工号..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
             </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : !stats ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          请选择部门查看统计数据
        </div>
      ) : (
        <>
          {/* 部门概览 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-600 mb-2">总人数</div>
              <div className="text-3xl font-bold text-gray-800">
                {stats.summary.total_employees}
              </div>
              <div className="text-xs text-gray-500 mt-1">人</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-600 mb-2">出勤率</div>
              <div className="text-3xl font-bold text-gray-800">
                {stats.summary.attendance_rate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                工作日 {stats.summary.work_days} 天
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-600 mb-2">迟到次数</div>
              <div className="text-3xl font-bold text-gray-800">
                {stats.summary.total_late_count}
              </div>
              <div className="text-xs text-gray-500 mt-1">次</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <div className="text-sm text-gray-600 mb-2">早退次数</div>
              <div className="text-3xl font-bold text-gray-800">
                {stats.summary.total_early_count}
              </div>
              <div className="text-xs text-gray-500 mt-1">次</div>
            </div>
          </div>

          {/* 员工考勤列表 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">员工考勤明细</h2>
              <span className="text-sm text-gray-500">
                {dateMode === 'month'
                  ? `${selectedMonth.year}年${selectedMonth.month}月`
                  : `${customDateRange.start} 至 ${customDateRange.end}`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      工号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      出勤天数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      出勤率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      迟到
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      早退
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      缺勤
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      请假
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      工作时长
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {stats.employees && stats.employees.map((employee) => (
                    <tr key={employee.user_id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fetchEmployeeDetails(employee)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {employee.employee_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.real_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.attendance_days}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          employee.attendance_rate >= 95 ? 'bg-green-100 text-green-800' :
                          employee.attendance_rate >= 85 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {employee.attendance_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {employee.late_count > 0 ? employee.late_count : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                        {employee.early_count > 0 ? employee.early_count : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.absent_count > 0 ? employee.absent_count : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {employee.leave_days > 0 ? employee.leave_days : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.total_work_hours}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!stats.employees || stats.employees.length === 0) && (
              <div className="p-12 text-center">
                 <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                 </svg>
                 <h3 className="mt-2 text-sm font-medium text-gray-900">暂无数据</h3>
                 <p className="mt-1 text-sm text-gray-500">该部门在此时间段内没有考勤记录。</p>
              </div>
            )}

            {/* 分页 */}
            {pagination.total > 0 && (
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-700">
                    共 <span className="font-medium">{pagination.total}</span> 名员工
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">每页</label>
                    <select
                      value={pagination.limit}
                      onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                      className="border rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <span className="text-sm text-gray-600">条</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 mr-2">
                    第 {pagination.page} / {Math.ceil(pagination.total / pagination.limit)} 页
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                    className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedEmployeeForDetails?.real_name} - 考勤明细
              </h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">日期</th>
                      <th className="px-4 py-2 text-left">班次</th>
                      <th className="px-4 py-2 text-left">签到</th>
                      <th className="px-4 py-2 text-left">签退</th>
                      <th className="px-4 py-2 text-left">状态</th>
                      <th className="px-4 py-2 text-left">工时</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {employeeDetails.map((record, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{record.record_date}</td>
                        <td className="px-4 py-2">{record.shift_name}</td>
                        <td className="px-4 py-2">{record.clock_in_time || '-'}</td>
                        <td className="px-4 py-2">{record.clock_out_time || '-'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            record.status === 'normal' ? 'bg-green-100 text-green-800' :
                            record.status === 'late' ? 'bg-red-100 text-red-800' :
                            record.status === 'early' ? 'bg-orange-100 text-orange-800' :
                            record.status === 'absent' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {
                              record.status === 'normal' ? '正常' :
                              record.status === 'late' ? '迟到' :
                              record.status === 'early' ? '早退' :
                              record.status === 'absent' ? '缺勤' :
                              record.status
                            }
                          </span>
                        </td>
                        <td className="px-4 py-2">{record.work_hours}h</td>
                      </tr>
                    ))}
                    {employeeDetails.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-gray-500">暂无记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
