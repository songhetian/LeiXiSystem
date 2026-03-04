import { useState, useEffect } from 'react'
import api from '../../api'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'
import { motion } from 'framer-motion'
import { DatePicker, TimePicker, Input } from 'antd';
import dayjs from 'dayjs';
import locale from 'antd/es/date-picker/locale/zh_CN';

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
  const [approver, setApprover] = useState(null)

  // Helper to handle date change
  const handleDateChange = (date, dateString, field) => {
    setFormData(prev => ({ ...prev, [field]: dateString }));
  };

  // Helper to handle time change
  const handleTimeChange = (time, timeString, field) => {
    setFormData(prev => ({ ...prev, [field]: timeString }));
  };

  // 快捷选择今天
  const selectToday = () => {
    const today = dayjs();
    const dateString = today.format('YYYY-MM-DD');
    setFormData(prev => ({
      ...prev,
      overtime_date: dateString
    }));
  };

  // 快捷选择明天
  const selectTomorrow = () => {
    const tomorrow = dayjs().add(1, 'day');
    const dateString = tomorrow.format('YYYY-MM-DD');
    setFormData(prev => ({
      ...prev,
      overtime_date: dateString
    }));
  };

  // 快捷时间选择
  const setTimeRange = (start, end) => {
    setFormData(prev => ({
      ...prev,
      start_time: start,
      end_time: end
    }));
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      fetchEmployeeInfo(userData.id)
      fetchApprover(userData.id)
    }
  }, [])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const response = await api.get(`/api/employees/by-user/${userId}`)
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

  const fetchApprover = async (userId) => {
    try {
      const response = await api.get(`/api/users/${userId}/approver`)
      if (response.data.success) {
        setApprover(response.data.data)
      }
    } catch (error) {
      console.error('获取审批人失败:', error)
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

    if (!formData.overtime_date) {
      toast.error('请选择加班日期')
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

      const response = await api.post('/api/overtime/apply', {
        employee_id: employee.id,
        user_id: employee.user_id,
        overtime_date: formData.overtime_date,
        start_time,
        end_time,
        hours,
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
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">加班申请</h1>
        <p className="text-gray-500 mt-2">提交您的加班申请，系统将自动通知审批人</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* 左侧：申请表单 */}
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              {/* 加班日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">加班日期</label>
                {/* 快捷选择按钮 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={selectToday}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    今天
                  </button>
                  <button
                    type="button"
                    onClick={selectTomorrow}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    明天
                  </button>
                </div>
                <DatePicker
                  className="w-full h-[42px] rounded-xl border-gray-200 shadow-sm hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
                  onChange={(date, dateString) => handleDateChange(date, dateString, 'overtime_date')}
                  locale={locale}
                  placeholder="选择日期"
                  value={formData.overtime_date ? dayjs(formData.overtime_date) : null}
                  disabledDate={(current) => {
                    // 不能选择今天之前的日期
                    return current && current < dayjs().startOf('day');
                  }}
                  format="YYYY-MM-DD"
                  allowClear
                />
              </div>

              {/* 时间范围 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">开始时间</label>
                  <TimePicker
                    className="w-full h-[42px] rounded-xl border-gray-200 shadow-sm hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
                    onChange={(time, timeString) => handleTimeChange(time, timeString, 'start_time')}
                    format="HH:mm"
                    placeholder="选择时间"
                    value={formData.start_time ? dayjs(formData.start_time, 'HH:mm') : null}
                    minuteStep={30}
                    allowClear
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">结束时间</label>
                  <TimePicker
                    className="w-full h-[42px] rounded-xl border-gray-200 shadow-sm hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
                    onChange={(time, timeString) => handleTimeChange(time, timeString, 'end_time')}
                    format="HH:mm"
                    placeholder="选择时间"
                    value={formData.end_time ? dayjs(formData.end_time, 'HH:mm') : null}
                    minuteStep={30}
                    allowClear
                  />
                </div>
              </div>

              {/* 快捷时间选择 */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTimeRange('18:00', '20:00')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  18:00-20:00 (2小时)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeRange('18:00', '21:00')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  18:00-21:00 (3小时)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeRange('18:00', '22:00')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  18:00-22:00 (4小时)
                </button>
              </div>

              {/* 加班时长 */}
              {formData.start_time && formData.end_time && (
                <div className="p-4 bg-orange-50 rounded-xl flex items-center justify-between">
                  <span className="text-orange-700 font-medium">预计加班时长</span>
                  <span className="text-2xl font-bold text-orange-600">{calculateHours()} <span className="text-sm font-normal text-orange-500">小时</span></span>
                </div>
              )}

              {/* 加班原因 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">加班原因</label>
                <Input.TextArea
                  rows={4}
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="请详细说明加班原因和工作内容..."
                  className="rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                  showCount
                  maxLength={200}
                />
              </div>
            </div>

            {/* 提交按钮 */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {loading ? '提交中...' : '提交申请'}
              </button>
            </div>
          </form>
        </div>

        {/* 右侧：信息面板 */}
        <div className="space-y-6">
          {/* 审批人信息 */}
          {approver && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">审批人信息</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium">{approver.real_name?.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{approver.real_name}</p>
                  <p className="text-sm text-gray-500">{approver.position || '部门主管'}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 申请说明 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">申请说明</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>加班时间需晚于正常下班时间</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>加班时长将计入调休或加班费结算</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>审批通过后方可生效</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
