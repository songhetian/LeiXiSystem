import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { Calendar, Clock, TrendingUp, Award } from 'lucide-react'
import OvertimeConversionModal from './OvertimeConversionModal'

const VacationDetailsNew = () => {
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('year') // 'year' | 'month'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [vacationBalances, setVacationBalances] = useState([])
  const [vacationTypes, setVacationTypes] = useState([])
  const [leaveRecords, setLeaveRecords] = useState([])
  const [overtimeStats, setOvertimeStats] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [conversionModalVisible, setConversionModalVisible] = useState(false)
  const [conversionRules, setConversionRules] = useState([])

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)

  // 计算总假期天数
  const [totalVacationDays, setTotalVacationDays] = useState(0)
  const [monthlyVacationDays, setMonthlyVacationDays] = useState(0) // 月视图的假期余额

  useEffect(() => {
    loadData()
    loadConversionRules()
  }, [selectedYear, selectedMonth, viewMode, currentPage, pageSize])

  const loadConversionRules = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')

      const response = await fetch(`${API_BASE_URL}/conversion-rules?source_type=overtime&enabled=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      if (result.success) {
        setConversionRules(result.data)
      }
    } catch (error) {
      console.error('加载转换规则失败:', error)
    }
  }

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

      // 获取所有假期类型
      const typesResponse = await fetch(`${API_BASE_URL}/vacation-types`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const typesData = await typesResponse.json()
      if (typesData.success) {
        // 过滤掉调休类型
        const filteredTypes = typesData.data.filter(type => type.code !== 'compensatory')
        setVacationTypes(filteredTypes)
      }

      // 获取员工所有假期类型余额
      const balanceResponse = await fetch(
        `${API_BASE_URL}/vacation/type-balances/${empData.data.id}?year=${selectedYear}`,
        {
          headers: {
          'Authorization': `Bearer ${token}`
          }
        }
      )
      const balanceData = await balanceResponse.json()
      if (balanceData.success) {
        // 过滤掉调休类型
        const filteredBalances = balanceData.data.balances.filter(balance =>
          balance.type_code !== 'compensatory'
        )
        setVacationBalances(filteredBalances)

        // 计算总假期天数
        const totalBalance = filteredBalances.reduce((sum, balance) => sum + parseFloat(balance.remaining || 0), 0)
        setTotalVacationDays(totalBalance)
      }

      // 获取月度假期余额（从节假日配置表中获取）
      if (viewMode === 'month') {
        // 获取指定年月的节假日配置
        const holidaysResponse = await fetch(
          `${API_BASE_URL}/holidays?year=${selectedYear}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        const holidaysData = await holidaysResponse.json()
        if (holidaysData.success) {
          // 过滤出指定月份的数据并计算总天数
          const monthlyHolidays = holidaysData.data.filter(holiday =>
            parseInt(holiday.month) === selectedMonth
          )
          const monthlyTotal = monthlyHolidays.reduce((sum, holiday) => sum + parseFloat(holiday.days || 0), 0)
          setMonthlyVacationDays(monthlyTotal)
        }
      }

      // 获取请假记录（带分页），只获取已批准的记录
      // 根据视图模式决定是否过滤月份
      let leaveApiUrl = `${API_BASE_URL}/leave/records?employee_id=${empData.data.id}&status=approved&page=${currentPage}&limit=${pageSize}`

      const leaveResponse = await fetch(leaveApiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const leaveData = await leaveResponse.json()
      if (leaveData.success) {
        let filteredRecords = leaveData.data

        // 如果是月视图，只显示当前选中月份的记录
        if (viewMode === 'month') {
          filteredRecords = leaveData.data.filter(record => {
            const recordDate = new Date(record.start_date)
            return recordDate.getFullYear() === selectedYear &&
                   recordDate.getMonth() + 1 === selectedMonth
          })
        }

        setLeaveRecords(filteredRecords)
        setTotalRecords(leaveData.pagination?.total || 0)
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
        // 更新总假期天数，加上加班转换的天数
        if (overtimeData.data && overtimeData.data.converted_days) {
          setTotalVacationDays(prev => prev + parseFloat(overtimeData.data.converted_days || 0))
        }
      }

    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
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
      </div>
    </div>
  )

  const handleConvertOvertime = () => {
    setConversionModalVisible(true)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  // 获取默认选中的加班假类型
  const getDefaultOvertimeLeaveType = () => {
    return vacationTypes.find(type => type.code === 'overtime_leave') || null
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

      {/* 总假期天数统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title={viewMode === 'month' ? `${selectedYear}年${selectedMonth}月假期余额` : "总假期余额"}
          value={(viewMode === 'month' ? monthlyVacationDays : totalVacationDays).toFixed(1)}
          subtitle={viewMode === 'month' ? `${selectedYear}年${selectedMonth}月可用假期` : "所有假期类型余额总和"}
          icon={Award}
          color="text-blue-600"
        />

        <StatCard
          title="加班时长"
          value={Number(overtimeStats?.remaining_hours ?? 0).toFixed(1)}
          subtitle={
            <div className="flex items-center gap-2">
              <span>可转换假期</span>
              <button
                onClick={handleConvertOvertime}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
              >
                转换
              </button>
            </div>
          }
          icon={Clock}
          color="text-purple-600"
        />

        <StatCard
          title="已使用假期"
          value={leaveRecords.length}
          subtitle={`${viewMode === 'month' ? `${selectedYear}年${selectedMonth}月` : selectedYear + '年'}请假记录数`}
          icon={TrendingUp}
          color="text-green-600"
        />
      </div>

      {/* 使用明细列表（年视图和月视图共用） */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {viewMode === 'month' ? `${selectedYear}年${selectedMonth}月使用明细` : `${selectedYear}年使用明细`}
        </h2>
        <div className="space-y-3">
          {leaveRecords.map(record => {
            // 查找对应的假期类型名称
            const type = vacationTypes.find(t => t.code === `${record.leave_type}_leave`) ||
                        vacationTypes.find(t => t.code === record.leave_type) ||
                        { name: record.leave_type === 'annual' ? '年假' : record.leave_type === 'sick' ? '病假' : record.leave_type }

            return (
              <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-2 h-12 rounded-full
                    ${record.leave_type === 'annual' ? 'bg-blue-500' : ''}
                    ${record.leave_type === 'sick' ? 'bg-orange-500' : ''}
                    ${record.leave_type === 'overtime_leave' ? 'bg-purple-500' : ''}
                  `}></div>
                  <div>
                    <div className="font-semibold text-gray-800">
                      {type.name} - {record.days} 天
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
            )
          })}

          {leaveRecords.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {viewMode === 'month' ? `${selectedYear}年${selectedMonth}月` : selectedYear + '年'}暂无请假记录
            </div>
          )}
        </div>

        {/* 分页控件 */}
        {totalRecords > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-600">
              显示第 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, totalRecords)} 条记录，共 {totalRecords} 条记录
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              >
                上一页
              </button>

              {/* 页码按钮 */}
              {Array.from({ length: Math.min(5, Math.ceil(totalRecords / pageSize)) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 rounded ${currentPage === pageNum ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage * pageSize >= totalRecords}
                className={`px-3 py-1 rounded ${currentPage * pageSize >= totalRecords ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 加班转换模态框 */}
      {employee && (
        <OvertimeConversionModal
          visible={conversionModalVisible}
          onClose={() => setConversionModalVisible(false)}
          onSuccess={loadData}
          employeeId={employee.id}
          overtimeHours={overtimeStats?.remaining_hours}
          defaultLeaveType={getDefaultOvertimeLeaveType()} // 默认选中加班假类型
        />
      )}
    </div>
  )
}

export default VacationDetailsNew
