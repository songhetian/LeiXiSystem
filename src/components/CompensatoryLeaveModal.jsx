import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { X, Calendar, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react'

const CompensatoryLeaveModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [employee, setEmployee] = useState(null)
  const [formData, setFormData] = useState({
    request_type: 'compensatory_leave',
    original_work_date: '', // 原工作日（要休息的日期）
    new_schedule_date: '',  // 新工作日（调到哪天上班）
    new_shift_id: '',
    reason: ''
  })
  const [shifts, setShifts] = useState([])
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
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
      if (empData.success) {
        setEmployee(empData.data)
      }

      // 获取班次列表
      const shiftsResponse = await fetch(`${API_BASE_URL}/shifts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const shiftsData = await shiftsResponse.json()
      setShifts(Array.isArray(shiftsData) ? shiftsData : (shiftsData.data || []))
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.original_work_date) {
      toast.error('请选择要休息的工作日')
      return
    }

    if (!formData.new_schedule_date) {
      toast.error('请选择调到哪天上班')
      return
    }

    if (!formData.new_shift_id) {
      toast.error('请选择班次')
      return
    }

    if (!formData.reason.trim()) {
      toast.error('请填写申请理由')
      return
    }

    // 显示确认模态框
    setShowConfirmModal(true)
  }

  const handleConfirmSubmit = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      const response = await fetch(`${API_BASE_URL}/compensatory/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: employee.id,
          user_id: user.id,
          ...formData,
          // 确保发送 original_schedule_date 字段给后端
          original_schedule_date: formData.original_work_date
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('调休申请提交成功，等待审批')
        setShowConfirmModal(false)
        onSuccess?.()
        handleClose()
      } else {
        toast.error(result.message || '提交失败')
      }
    } catch (error) {
      console.error('提交调休申请失败:', error)
      toast.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      request_type: 'compensatory_leave',
      original_work_date: '',
      new_schedule_date: '',
      new_shift_id: '',
      reason: ''
    })
    setShowConfirmModal(false)
    onClose()
  }

  const selectedShift = shifts.find(s => s.id === parseInt(formData.new_shift_id))

  if (!isOpen) return null

  return (
    <>
      {/* 主申请模态框 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* 标题 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">申请调休</h2>
                <p className="text-sm text-gray-600">将工作日调换为休息日</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {/* 说明卡片 */}
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-2">调休说明</p>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>第一步</strong>：选择要休息的工作日（原本要上班的日期）</p>
                  <p>• <strong>第二步</strong>：选择调到哪天上班（原本休息的日期）</p>
                  <p>• 审批通过后，系统将自动调整排班</p>
                </div>
              </div>
            </div>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 日期选择 - 可视化流程 */}
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* 原工作日 */}
                <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs mb-2">步骤1</span>
                    <br />
                    要休息的工作日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.original_work_date}
                    onChange={(e) => setFormData({ ...formData, original_work_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">原本要上班 → 改为休息</p>
                </div>

                {/* 箭头 */}
                <div className="hidden md:flex justify-center">
                  <ArrowRight className="text-primary-600" size={32} />
                </div>

                {/* 新工作日 */}
                <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs mb-2">步骤2</span>
                    <br />
                    调到哪天上班 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.new_schedule_date}
                    onChange={(e) => setFormData({ ...formData, new_schedule_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">原本休息 → 改为上班</p>
                </div>
              </div>
            </div>

            {/* 选择班次 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                上班班次 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.new_shift_id}
                onChange={(e) => setFormData({ ...formData, new_shift_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">请选择班次</option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </option>
                ))}
              </select>
            </div>

            {/* 申请理由 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                申请理由 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
                placeholder="请说明调休原因..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                required
              />
              <div className="text-sm text-gray-500 mt-1">
                {formData.reason.length} / 200字
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Calendar size={20} />
                提交申请
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 确认提交模态框 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            {/* 标题 */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <CheckCircle className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">确认提交</h3>
              </div>
            </div>

            {/* 内容 */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">请确认您的调休申请信息：</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">要休息的工作日：</span>
                  <span className="font-semibold text-red-600">{formData.original_work_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">调到哪天上班：</span>
                  <span className="font-semibold text-green-600">{formData.new_schedule_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">上班班次：</span>
                  <span className="font-semibold">
                    {selectedShift ? `${selectedShift.name} (${selectedShift.start_time}-${selectedShift.end_time})` : '-'}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-gray-600 mb-1">申请理由：</div>
                  <div className="text-gray-800">{formData.reason}</div>
                </div>
              </div>
              <p className="text-sm text-yellow-600 mt-4 flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>提交后将进入审批流程，请确认信息无误</span>
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
              >
                返回修改
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle size={20} />
                {loading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CompensatoryLeaveModal
