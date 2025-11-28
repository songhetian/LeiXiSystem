import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


export default function LeaveApply() {
  const [formData, setFormData] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
    attachments: []
  })
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [employee, setEmployee] = useState(null)
  const [user, setUser] = useState(null)

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
      const response = await axios.get(getApiUrl(`/api/employees/by-user/${userId}`))
      if (response.data.success && response.data.data) {
        setEmployee(response.data.data)
        fetchBalance(response.data.data.id)
      } else {
        toast.error('未找到员工信息')
      }
    } catch (error) {
      console.error('获取员工信息失败:', error)
      toast.error('获取员工信息失败')
    }
  }

  const fetchBalance = async (employeeId) => {
    try {
      // Use the new vacation balance API which includes overtime/converted leave
      const response = await axios.get(getApiUrl('/api/vacation/balance'), {
        params: { employee_id: employeeId }
      })
      if (response.data.success) {
        setBalance(response.data.data)
      }
    } catch (error) {
      console.error('获取请假余额失败:', error)
    }
  }

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0
    const start = new Date(formData.start_date)
    const end = new Date(formData.end_date)
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!employee) {
      toast.error('员工信息未加载')
      return
    }

    const days = calculateDays()
    if (days <= 0) {
      toast.error('请选择有效的日期范围')
      return
    }

    // 检查余额
    if (formData.leave_type === 'annual' && balance) {
      // If using converted leave, check combined balance or logic
      // For now, basic check. The backend will handle complex deduction logic.
      if (!formData.use_converted_leave && days > balance.annual_leave_remaining) {
        toast.error(`年假余额不足，剩余 ${balance.annual_leave_remaining} 天`)
        return
      }
    }

    if (formData.leave_type === 'sick' && balance && days > balance.sick_leave_remaining) {
      toast.error(`病假余额不足，剩余 ${balance.sick_leave_remaining} 天`)
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(getApiUrl('/api/leave/apply'), {
        employee_id: employee.id,
        user_id: employee.user_id,
        ...formData,
        days
      })

      if (response.data.success) {
        toast.success('请假申请提交成功')
        // 重置表单
        setFormData({
          leave_type: 'annual',
          start_date: '',
          end_date: '',
          reason: '',
          attachments: [],
          use_converted_leave: false
        })
        fetchBalance(employee.id)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const leaveTypes = [
    { value: 'annual', label: '年假', icon: '🏖️' },
    { value: 'sick', label: '病假', icon: '🤒' },
    { value: 'personal', label: '事假', icon: '📋' },
    { value: 'compensatory', label: '调休', icon: '🔄' },
    { value: 'other', label: '其他', icon: '📝' }
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">请假申请</h1>
        <p className="text-gray-600 mt-1">提交您的请假申请</p>
      </div>

      {/* 请假余额 */}
      {balance && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">请假余额</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="border rounded-lg p-6 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-medium">加班转换假期</span>
                <span className="text-3xl">🔄</span>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {balance.overtime_leave_remaining || 0} 天
              </div>
              <div className="text-sm text-gray-600">
                可用于抵扣年假或调休
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 申请表单 */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          {/* 请假类型 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              请假类型 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {leaveTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, leave_type: type.value }))}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${formData.leave_type === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>

            {/* 自动转换假期选项 */}
            {balance && balance.overtime_leave_remaining > 0 && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-lg flex items-center">
                <input
                  type="checkbox"
                  id="use_converted_leave"
                  checked={formData.use_converted_leave || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, use_converted_leave: e.target.checked }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="use_converted_leave" className="ml-2 block text-sm text-gray-900">
                  优先使用加班转换假期 (剩余 {balance.overtime_leave_remaining} 天)
                </label>
              </div>
            )}
          </div>

          {/* 日期范围 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                开始日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                结束日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 请假天数 */}
          {formData.start_date && formData.end_date && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">请假天数：</span>
                <span className="text-2xl font-bold text-blue-600">{calculateDays()} 天</span>
              </div>
            </div>
          )}

          {/* 请假原因 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              请假原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="请详细说明请假原因..."
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 附件上传（病假证明等） */}
          {formData.leave_type === 'sick' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                病假证明
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <div className="text-gray-500 mb-2">点击或拖拽文件到此处上传</div>
                <div className="text-sm text-gray-400">支持 PDF、JPG、PNG 格式</div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    // 处理文件上传
                  }}
                />
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '提交中...' : '提交申请'}
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>

      {/* 注意事项 */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">📌 注意事项</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 请假需提前申请，紧急情况请及时联系主管</li>
          <li>• 病假需提供医院证明</li>
          <li>• 年假需在年度内使用完毕</li>
          <li>• 请假期间请保持通讯畅通</li>
        </ul>
      </div>
    </div>
  )
}
