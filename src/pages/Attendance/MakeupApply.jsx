import React, { useState, useEffect } from 'react'
import api from '../../api'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'
import { motion } from 'framer-motion'
import { DatePicker, TimePicker, Input } from 'antd';
import dayjs from 'dayjs';
import locale from 'antd/es/date-picker/locale/zh_CN';

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
  const [approver, setApprover] = useState(null)

  // Helper to handle date change
  const handleDateChange = (date, dateString, field) => {
    setFormData(prev => ({ ...prev, [field]: dateString }));
  };

  // Helper to handle time change
  const handleTimeChange = (time, timeString, field) => {
    setFormData(prev => ({ ...prev, [field]: timeString }));
  };

  // 获取当前登录用户与员工信息
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      fetchEmployeeInfo(userData.id)
      fetchApprover(userData.id)
    }
    loadRestShift()
  }, [])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const res = await api.get(`/api/employees/by-user/${userId}`)
      if (res.data.success && res.data.data) {
        setEmployee(res.data.data)
      } else {
        toast.error('未找到员工信息，请联系管理员')
      }
    } catch (e) {
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

  const loadRestShift = async () => {
    try {
      const response = await api.get('/api/shifts/rest')
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
        const res = await api.get('/api/schedules', {
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

      const response = await api.post('/api/makeup/apply', {
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
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">补卡申请</h1>
        <p className="text-gray-500 mt-2">忘记打卡？提交补卡申请，系统将自动通知审批人</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* 左侧：申请表单 */}
        <div className="flex-1">

          {!employee ? (
            <div className="text-center text-gray-500 py-8">正在加载员工信息...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                {/* 补卡日期 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">补卡日期</label>
                  <DatePicker
                    className="w-full h-[42px] rounded-xl border-gray-200 shadow-sm"
                    onChange={(date, dateString) => handleDateChange(date, dateString, 'record_date')}
                    locale={locale}
                    placeholder="选择日期"
                    value={formData.record_date ? dayjs(formData.record_date) : null}
                  />
                  {formData.record_date && (
                    <div className={`mt-2 text-sm ${isRestDay ? 'text-red-600' : 'text-green-600'}`}>
                      {checkingSchedule ? '正在检查排班...' : isRestDay ? '⚠️ 该日期为休息日，不可补打卡' : '✅ 该日期可提交补打卡申请'}
                    </div>
                  )}
                </div>

                {/* 打卡类型 */}
                <div className={isRestDay ? 'opacity-50 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">打卡类型</label>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => !isRestDay && setFormData(prev => ({ ...prev, clock_type: 'in' }))}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                        formData.clock_type === 'in'
                          ? 'bg-blue-50 text-blue-600 border-blue-200 ring-2 ring-offset-2 ring-blue-100'
                          : 'border-gray-100 hover:border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      <span className="text-3xl">🌅</span>
                      <span className="font-medium">上班打卡</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => !isRestDay && setFormData(prev => ({ ...prev, clock_type: 'out' }))}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                        formData.clock_type === 'out'
                          ? 'bg-orange-50 text-orange-600 border-orange-200 ring-2 ring-offset-2 ring-orange-100'
                          : 'border-gray-100 hover:border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      <span className="text-3xl">🌆</span>
                      <span className="font-medium">下班打卡</span>
                    </motion.button>
                  </div>
                </div>

                {/* 补卡时间 */}
                <div className={isRestDay ? 'opacity-50 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">补卡时间</label>
                  <TimePicker
                    className="w-full h-[42px] rounded-xl border-gray-200 shadow-sm"
                    onChange={(time, timeString) => handleTimeChange(time, timeString, 'clock_time')}
                    format="HH:mm"
                    placeholder="选择时间"
                    value={formData.clock_time ? dayjs(formData.clock_time, 'HH:mm') : null}
                  />
                </div>

                {/* 补卡原因 */}
                <div className={isRestDay ? 'opacity-50 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">补卡原因</label>
                  <Input.TextArea
                    rows={4}
                    value={formData.reason}
                    onChange={(e) => !isRestDay && setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="请详细说明忘记打卡的原因..."
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
                  disabled={loading || isRestDay}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-blue-300 transform hover:-translate-y-0.5"
                >
                  {loading ? '提交中...' : '提交申请'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 右侧：审批流程预览 */}
        <div className="w-full md:w-80">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">审批流程</h3>

            <div className="relative pl-4 border-l-2 border-gray-100 space-y-8">
              {/* 提交申请 */}
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm"></div>
                <h4 className="font-medium text-gray-900">提交申请</h4>
                <p className="text-sm text-gray-500 mt-1">{user?.real_name} (您)</p>
                <p className="text-xs text-gray-400 mt-0.5">即将提交</p>
              </div>

              {/* 部门审批 */}
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-gray-200 border-4 border-white"></div>
                <h4 className="font-medium text-gray-900">部门审批</h4>
                {approver ? (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                        {approver.real_name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-600">{approver.real_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{approver.position || '部门主管'}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">部门主管</p>
                )}
              </div>

              {/* 完成 */}
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-gray-200 border-4 border-white"></div>
                <h4 className="font-medium text-gray-900">完成</h4>
                <p className="text-sm text-gray-500 mt-1">更新考勤记录</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-900 mb-3">注意事项</h4>
              <ul className="text-xs text-gray-500 space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  补卡申请需在忘记打卡后3个工作日内提交
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  请如实填写补卡时间和原因
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  频繁忘记打卡可能影响考勤评分
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
