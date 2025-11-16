import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


export default function DepartmentAttendanceStats() {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [employees, setEmployees] = useState([])
  const [attendanceData, setAttendanceData] = useState([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    }
  })

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      // 获取token
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // 使用 /api/departments/list 获取用户有权限的部门
      const response = await axios.get(getApiUrl('/api/departments/list'), { headers })

      if (response.data.success) {
        setDepartments(response.data.data || [])
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      toast.error('获取部门列表失败')
    }
  }

  useEffect(() => {
    if (selectedDepartment) {
      fetchEmployeesAndData()
    } else {
      setEmployees([])
      setAttendanceData([])
    }
  }, [selectedDepartment])

  // 当搜索关键词或日期范围变化时，重新查询考勤数据
  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendanceDataForEmployees(employees)
    }
  }, [searchKeyword, dateRange.startDate, dateRange.endDate])

  const fetchEmployeesAndData = async () => {
    // 先获取员工列表
    await fetchEmployees()
  }

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await axios.get(getApiUrl(`/api/departments/employees/${selectedDepartment}`), {
        headers
      })
      if (response.data.success) {
        const employeeList = response.data.data || []
        setEmployees(employeeList)

        if (employeeList.length === 0) {
          toast.info('该部门暂无员工')
          setAttendanceData([])
        } else {
          // 自动查询考勤数据
          await fetchAttendanceDataForEmployees(employeeList)
        }
      } else {
        toast.warning('未找到员工数据')
        setEmployees([])
        setAttendanceData([])
      }
    } catch (error) {
      console.error('获取员工列表失败:', error)
      toast.error('获取员工列表失败: ' + (error.response?.data?.message || error.message))
      setEmployees([])
      setAttendanceData([])
    }
  }

  const fetchAttendanceDataForEmployees = async (employeeList) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // 应用搜索过滤
      const targetEmployees = searchKeyword
        ? employeeList.filter(emp => {
            const keyword = searchKeyword.toLowerCase()
            return (
              emp.employee_no?.toLowerCase().includes(keyword) ||
              emp.real_name?.toLowerCase().includes(keyword) ||
              emp.username?.toLowerCase().includes(keyword)
            )
          })
        : employeeList

      if (targetEmployees.length === 0) {
        toast.warning('没有符合条件的员工')
        setAttendanceData([])
        setLoading(false)
        return
      }

      const promises = targetEmployees.map(emp =>
        axios.get(getApiUrl('/api/attendance/records'), {
          params: {
            employee_id: emp.id,
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
            limit: 1000
          },
          headers
        })
      )

      const results = await Promise.all(promises)

      const data = targetEmployees.map((emp, index) => {
        const records = results[index].data.success ? results[index].data.data : []

        const normalDays = records.filter(r => r.status === 'normal').length
        const lateDays = records.filter(r => r.status === 'late').length
        const earlyDays = records.filter(r => r.status === 'early').length
        const absentDays = records.filter(r => r.status === 'absent').length
        const totalWorkHours = records.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0)

        return {
          ...emp,
          clockInDays: records.filter(r => r.clock_in_time).length,
          normalDays,
          lateDays,
          earlyDays,
          absentDays,
          totalWorkHours: totalWorkHours.toFixed(1),
          avgWorkHours: records.length > 0 ? (totalWorkHours / records.length).toFixed(1) : 0
        }
      })

      setAttendanceData(data)
    } catch (error) {
      toast.error('获取考勤数据失败')
      setAttendanceData([])
    } finally {
      setLoading(false)
    }
  }

  // 过滤员工列表
  const filteredEmployees = employees.filter(emp => {
    if (!searchKeyword) return true
    const keyword = searchKeyword.toLowerCase()
    return (
      emp.employee_no?.toLowerCase().includes(keyword) ||
      emp.real_name?.toLowerCase().includes(keyword) ||
      emp.username?.toLowerCase().includes(keyword)
    )
  })

  const fetchAttendanceData = async () => {
    if (!selectedDepartment) {
      toast.warning('请先选择部门')
      return
    }

    if (employees.length === 0) {
      toast.warning('该部门没有员工')
      return
    }

    // 使用当前的员工列表重新查询
    await fetchAttendanceDataForEmployees(employees)
  }

  const handleExport = () => {
    if (!selectedDepartment) {
      toast.warning('请先选择部门')
      return
    }

    if (attendanceData.length === 0) {
      toast.warning('没有数据可导出，请先查询')
      return
    }

    try {
      // 生成CSV内容
      const headers = ['工号', '姓名', '打卡天数', '正常', '迟到', '早退', '缺勤', '总工时', '日均工时']
      const csvContent = [
        headers.join(','),
        ...attendanceData.map(emp => [
          emp.employee_no,
          emp.real_name || emp.username,
          emp.clockInDays,
          emp.normalDays,
          emp.lateDays,
          emp.earlyDays,
          emp.absentDays,
          emp.totalWorkHours,
          emp.avgWorkHours
        ].join(','))
      ].join('\n')

      // 添加BOM以支持中文
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

      // 创建下载链接
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)

      // 获取部门名称
      const deptName = departments.find(d => d.id == selectedDepartment)?.name || '部门'
      const fileName = `${deptName}_考勤统计_${dateRange.startDate}_${dateRange.endDate}.csv`
      link.setAttribute('download', fileName)

      // 触发下载
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('导出成功')
    } catch (error) {
      console.error('导出失败:', error)
      toast.error('导出失败')
    }
  }

  const handleQuickDate = (type) => {
    const now = new Date()
    let startDate, endDate

    switch (type) {
      case 'thisMonth':
        // 本月1号到今天
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'lastMonth':
        // 上月1号到上月最后一天
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'thisYear':
        // 今年1月1号到今天
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      default:
        return
    }

    // 确保日期格式正确，不会早一天
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    setDateRange({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    })
  }

  return (
    <div className="p-4 max-w-full mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">部门考勤统计</h1>
          <p className="text-sm text-gray-600 mt-1">查看部门员工考勤数据</p>
        </div>
        {attendanceData.length > 0 && (
          <div className="text-sm text-gray-600">
            共 <span className="font-bold text-blue-600">{attendanceData.length}</span> 名员工
          </div>
        )}
      </div>

      {/* 筛选栏 - 优化版 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 部门选择 - 加强样式 */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="inline-flex items-center">
                <span className="text-blue-600 mr-1">📊</span>
                选择部门
              </span>
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              disabled={departments.length === 0}
            >
              <option value="">
                {departments.length === 0 ? '-- 暂无可用部门 --' : '-- 请选择部门 --'}
              </option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            {departments.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ 您没有查看任何部门的权限，请联系管理员
              </p>
            )}
          </div>

          {/* 员工搜索 */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="inline-flex items-center">
                <span className="text-purple-600 mr-1">🔍</span>
                员工搜索
              </span>
            </label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="工号/姓名"
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
              disabled={!selectedDepartment || employees.length === 0}
            />
            {searchKeyword && (
              <p className="text-xs text-gray-600 mt-1">
                找到 {filteredEmployees.length} 名员工
              </p>
            )}
          </div>

          {/* 日期范围 */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          {/* 快捷日期 */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">快捷选择</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleQuickDate('thisMonth')}
                className="flex-1 px-3 py-2 border-2 border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium transition-all"
              >
                本月
              </button>
              <button
                onClick={() => handleQuickDate('lastMonth')}
                className="flex-1 px-3 py-2 border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 text-sm font-medium transition-all"
              >
                上月
              </button>
              <button
                onClick={() => handleQuickDate('thisYear')}
                className="flex-1 px-3 py-2 border-2 border-green-300 text-green-600 rounded-lg hover:bg-green-50 text-sm font-medium transition-all"
              >
                本年
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
            <div className="flex gap-2">
              <button
                onClick={fetchAttendanceData}
                disabled={loading || !selectedDepartment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    查询中
                  </span>
                ) : '🔍 查询'}
              </button>
              <button
                onClick={handleExport}
                disabled={!selectedDepartment || attendanceData.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                📥 导出
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 统计表格 - 优化版 */}
      {attendanceData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">工号</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">姓名</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">打卡天数</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">✅ 正常</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-700 uppercase tracking-wider">⏰ 迟到</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-orange-700 uppercase tracking-wider">🏃 早退</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">❌ 缺勤</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider">总工时</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-purple-700 uppercase tracking-wider">日均工时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendanceData.map((emp, index) => (
                  <tr key={emp.id} className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900">{emp.employee_no}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900">{emp.real_name || emp.username}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {emp.clockInDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {emp.normalDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {emp.lateDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {emp.earlyDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {emp.absentDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-blue-600">{emp.totalWorkHours}h</td>
                    <td className="px-4 py-3 text-center text-xs font-semibold text-purple-600">{emp.avgWorkHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && attendanceData.length === 0 && selectedDepartment && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">暂无数据</h3>
          <p className="text-sm text-gray-500 mb-4">请点击"查询"按钮获取考勤数据</p>
          <button
            onClick={fetchAttendanceData}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-md transition-all"
          >
            🔍 立即查询
          </button>
        </div>
      )}

      {!selectedDepartment && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-12 text-center border-2 border-dashed border-blue-300">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">请选择部门</h3>
          <p className="text-sm text-gray-600">在上方选择一个部门以查看考勤统计数据</p>
        </div>
      )}
    </div>
  )
}
