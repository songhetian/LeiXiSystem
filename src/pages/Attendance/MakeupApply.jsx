import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


export default function MakeupApply() {
  const [formData, setFormData] = useState({
    record_date: '',
    clock_type: 'in',
    clock_time: '',
    reason: ''
  })
  const [loading, setLoading] = useState(false)
  const [employee, setEmployee] = useState(null)
  const [user, setUser] = useState(null)
  const [isRestDay, setIsRestDay] = useState(false)
  const [checkingSchedule, setCheckingSchedule] = useState(false)
  const [restShiftId, setRestShiftId] = useState(null)

  // 获取当前登录用户与员工信息
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      fetchEmployeeInfo(userData.id)
    }
    loadRestShift()
  }, [])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const res = await axios.get(getApiUrl(`/api/employees/by-user/${userId}`))
      if (res.data.success && res.data.data) {
        setEmployee(res.data.data)
      } else {
        toast.error('未找到员工信息，请联系管理员')
      }
    } catch (e) {
      toast.error('获取员工信息失败')
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

  // 选择日期后检查该日是否为休息日
  useEffect(() => {
    const check = async () => {
      if (!employee || !formData.record_date) return
      setCheckingSchedule(true)
      try {
        const res = await axios.get(getApiUrl('/api/schedules'), {
          params: {
            employee_id: employee.id,
            start_date: formData.record_date,
            end_date: formData.record_date
          }
        })
        if (res.data.success && res.data.data.length > 0) {
          const schedule = res.data.data[0]
          setIsRestDay(schedule.shift_id == restShiftId)
        } else {
          // 无排班，按非休息处理，允许提交（如需改为不允许可置为 true）
          setIsRestDay(false)
        }
      } catch (e) {
        setIsRestDay(false)
      } finally {
        setCheckingSchedule(false)
      }
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, formData.record_date])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isRestDay) {
      toast.error('所选日期为休息日，不可提交补打卡')
      return
    }

    setLoading(true)
    try {
      const clock_time = `${formData.record_date} ${formData.clock_time}:00`

      const response = await axios.post(getApiUrl('/api/makeup/apply'), {
        employee_id: employee.id,
        user_id: user?.id || employee.user_id,
        record_date: formData.record_date,
        clock_type: formData.clock_type,
        clock_time,
        reason: formData.reason
      })

      if (response.data.success) {
        toast.success('补卡申请提交成功')
        setFormData({
          record_date: '',
          clock_type: 'in',
          clock_time: '',
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
        <h1 className="text-2xl font-bold text-gray-800">补卡申请</h1>
        <p className="text-gray-600 mt-1">忘记打卡？提交补卡申请</p>
      </div>

      {/* 申请表单 */}
      <div className="bg-white rounded-lg shadow p-6">
        {!employee ? (
          <div className="text-center text-gray-500 py-8">正在加载员工信息...</div>
        ) : (
        <form onSubmit={handleSubmit}>
          {/* 补卡日期 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              补卡日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.record_date}
              onChange={(e) => setFormData(prev => ({ ...prev, record_date: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {formData.record_date && (
            <div className={`mb-4 text-sm ${isRestDay ? 'text-green-700' : 'text-gray-600'}`}>
              {checkingSchedule ? '正在检查该日排班...' : isRestDay ? '该日期为休息日，不可补打卡' : '该日期可提交补打卡申请'}
            </div>
          )}

          {/* 打卡类型 */}
          <div className={`mb-6 ${isRestDay ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              打卡类型 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => !isRestDay && setFormData(prev => ({ ...prev, clock_type: 'in' }))}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  formData.clock_type === 'in'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🌅</div>
                <div className="font-medium">上班打卡</div>
              </button>
              <button
                type="button"
                onClick={() => !isRestDay && setFormData(prev => ({ ...prev, clock_type: 'out' }))}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  formData.clock_type === 'out'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🌆</div>
                <div className="font-medium">下班打卡</div>
              </button>
            </div>
          </div>

          {/* 打卡时间 */}
          <div className={`mb-6 ${isRestDay ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              打卡时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.clock_time}
              onChange={(e) => !isRestDay && setFormData(prev => ({ ...prev, clock_time: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 补卡原因 */}
          <div className={`mb-6 ${isRestDay ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              补卡原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={formData.reason}
              onChange={(e) => !isRestDay && setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="请详细说明忘记打卡的原因..."
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || isRestDay}
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
        )}
      </div>

      {/* 注意事项 */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">📌 注意事项</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 补卡申请需在忘记打卡后3个工作日内提交</li>
          <li>• 请如实填写补卡时间和原因</li>
          <li>• 补卡需经主管审批通过</li>
          <li>• 频繁忘记打卡可能影响考勤评分</li>
        </ul>
      </div>
    </div>
  )
}
