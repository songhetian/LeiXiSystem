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
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentStats()
    }
  }, [selectedDepartment, selectedMonth, pagination.page, pagination.limit])

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

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
      const response = await axios.get(getApiUrl('/api/attendance/department-stats'), {
        params: {
          department_id: selectedDepartment,
          year: selectedMonth.year,
          month: selectedMonth.month,
          page: pagination.page,
          limit: pagination.limit
        }
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
      toast.error('获取部门统计失败')
    } finally {
      setLoading(false)
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
    const month = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`
    window.open(getApiUrl(`/api/export/department/${selectedDepartment}?month=${month}`), '_blank')
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
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📊 导出报表
        </button>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 部门选择 */}
          <div>
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

          {/* 月份选择 - 改进的样式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择月份
            </label>
            <div className="flex items-stretch gap-2">
              {/* 上一月按钮 */}
              <button
                onClick={handlePrevMonth}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center"
                title="上个月"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* 日期选择区域 */}
              <div className="flex-1 flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-2xl">📅</span>
                  <select
                    value={selectedMonth.year}
                    onChange={(e) => handleMonthChange(parseInt(e.target.value), selectedMonth.month)}
                    className="bg-transparent border-none text-xl font-bold text-gray-800 focus:outline-none focus:ring-0 cursor-pointer pr-1"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="text-xl font-bold text-gray-700">年</span>

                  <select
                    value={selectedMonth.month}
                    onChange={(e) => handleMonthChange(selectedMonth.year, parseInt(e.target.value))}
                    className="bg-transparent border-none text-xl font-bold text-gray-800 focus:outline-none focus:ring-0 cursor-pointer pr-1"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <span className="text-xl font-bold text-gray-700">月</span>
                </div>

                {/* 本月按钮 - 始终显示 */}
                <button
                  onClick={handleThisMonth}
                  disabled={isCurrentMonth()}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    isCurrentMonth()
                      ? 'bg-blue-500 text-white cursor-default shadow-md'
                      : 'bg-white text-blue-600 border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
                  }`}
                  title={isCurrentMonth() ? '当前月份' : '返回本月'}
                >
                  {isCurrentMonth() ? '✓ 本月' : '回到本月'}
                </button>
              </div>

              {/* 下一月按钮 */}
              <button
                onClick={handleNextMonth}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center"
                title="下个月"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
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
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-2">总人数</div>
              <div className="text-3xl font-bold text-blue-600">
                {stats.summary.total_employees}
              </div>
              <div className="text-xs text-gray-500 mt-1">人</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-2">出勤率</div>
              <div className="text-3xl font-bold text-green-600">
                {stats.summary.attendance_rate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                工作日 {stats.summary.work_days} 天
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-2">迟到次数</div>
              <div className="text-3xl font-bold text-red-600">
                {stats.summary.total_late_count}
              </div>
              <div className="text-xs text-gray-500 mt-1">次</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 mb-2">早退次数</div>
              <div className="text-3xl font-bold text-orange-600">
                {stats.summary.total_early_count}
              </div>
              <div className="text-xs text-gray-500 mt-1">次</div>
            </div>
          </div>

          {/* 员工考勤列表 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold">员工考勤明细</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      工号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      出勤天数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      出勤率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      迟到
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      早退
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      缺勤
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      请假
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      工作时长
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.employees && stats.employees.map((employee) => (
                    <tr key={employee.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.employee_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.real_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.attendance_days}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          employee.attendance_rate >= 95 ? 'text-green-600' :
                          employee.attendance_rate >= 85 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {employee.attendance_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {employee.late_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        {employee.early_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.absent_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {employee.leave_days}
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
              <div className="p-8 text-center text-gray-500">
                该部门暂无员工考勤数据
              </div>
            )}

            {/* 分页 */}
            {pagination.total > 0 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-700">
                    共 {pagination.total} 名员工
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">每页显示</label>
                    <select
                      value={pagination.limit}
                      onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                      className="border rounded px-2 py-1 text-sm"
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
                    className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                    className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
