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
  const [employee] = useState({ id: 1, user_id: 1, name: '张三' })

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/leave/balance'), {
        params: { employee_id: employee.id }
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

    const days = calculateDays()
    if (days <= 0) {
      toast.error('请选择有效的日期范围')
      return
    }

    // 检查余额
    if (formData.leave_type === 'annual' && balance && days > balance.annual.remaining) {
      toast.error(`年假余额不足，剩余 ${balance.annual.remaining} 天`)
      return
    }

    if (formData.leave_type === 'sick' && balance && days > balance.sick.remaining) {
      toast.error(`病假余额不足，剩余 ${balance.sick.remaining} 天`)
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
          attachments: []
        })
        fetchBalance()
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">年假</span>
                <span className="text-2xl">🏖️</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {balance.annual.remaining} 天
              </div>
              <div className="text-sm text-gray-500 mt-1">
                总额 {balance.annual.total} 天，已用 {balance.annual.used} 天
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">病假</span>
                <span className="text-2xl">🤒</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {balance.sick.remaining} 天
              </div>
              <div className="text-sm text-gray-500 mt-1">
                总额 {balance.sick.total} 天，已用 {balance.sick.used} 天
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
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    formData.leave_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>
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
