import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


export default function OvertimeApply() {
  const [formData, setFormData] = useState({
    overtime_date: '',
    start_time: '',
    end_time: '',
    reason: ''
  })
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
      } else {
        toast.error('未找到员工信息')
      }
    } catch (error) {
      console.error('获取员工信息失败:', error)
      toast.error('获取员工信息失败')
    }
  }

  const calculateHours = () => {
    if (!formData.start_time || !formData.end_time) return 0
    const start = new Date(`2000-01-01 ${formData.start_time}`)
    const end = new Date(`2000-01-01 ${formData.end_time}`)
    const diffMs = end - start
    const hours = (diffMs / (1000 * 60 * 60)).toFixed(1)
    return hours > 0 ? hours : 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!employee) {
      toast.error('员工信息未加载')
      return
    }

    const hours = calculateHours()
    if (hours <= 0) {
      toast.error('结束时间必须晚于开始时间')
      return
    }

    setLoading(true)
    try {
      const start_time = `${formData.overtime_date} ${formData.start_time}:00`
      const end_time = `${formData.overtime_date} ${formData.end_time}:00`

      const response = await axios.post(getApiUrl('/api/overtime/apply'), {
        employee_id: employee.id,
        user_id: employee.user_id,
        overtime_date: formData.overtime_date,
        start_time,
        end_time,
        reason: formData.reason
      })

      if (response.data.success) {
        toast.success('加班申请提交成功')
        setFormData({
          overtime_date: '',
          start_time: '',
          end_time: '',
          reason: ''
        })
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">加班申请</h1>
        <p className="text-gray-600 mt-1">提交您的加班申请</p>
      </div>

      {/* 申请表单 */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          {/* 加班日期 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              加班日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.overtime_date}
              onChange={(e) => setFormData(prev => ({ ...prev, overtime_date: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 时间范围 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                开始时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                结束时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 加班时长 */}
          {formData.start_time && formData.end_time && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">加班时长：</span>
                <span className="text-2xl font-bold text-blue-600">{calculateHours()} 小时</span>
              </div>
            </div>
          )}

          {/* 加班原因 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              加班原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="请详细说明加班原因和工作内容..."
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

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
          <li>• 加班需提前申请或事后24小时内补申请</li>
          <li>• 请如实填写加班时间和原因</li>
          <li>• 加班时长将计入调休余额</li>
          <li>• 加班需经主管审批通过</li>
        </ul>
      </div>
    </div>
  )
}
