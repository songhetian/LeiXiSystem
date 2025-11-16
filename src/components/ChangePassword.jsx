import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'

const ChangePassword = () => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.oldPassword || !formData.newPassword || !formData.confirmPassword) {
      toast.error('请填写所有字段')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }

    if (formData.newPassword.length < 6) {
      toast.error('新密码长度至少6位')
      return
    }

    if (formData.oldPassword === formData.newPassword) {
      toast.error('新密码不能与旧密码相同')
      return
    }

    try {
      setLoading(true)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')

      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('密码修改成功，请重新登录')
        setFormData({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        })

        // 3秒后自动退出登录
        setTimeout(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          window.location.reload()
        }, 3000)
      } else {
        toast.error(data.message || '密码修改失败')
      }
    } catch (error) {
      console.error('密码修改失败:', error)
      toast.error('密码修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary-100 rounded-lg">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">修改密码</h1>
            <p className="text-sm text-gray-600">修改您的登录密码</p>
          </div>
        </div>
      </div>

      {/* 修改密码表单 */}
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 旧密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                当前密码
              </label>
              <input
                type="password"
                value={formData.oldPassword}
                onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
                placeholder="请输入当前密码"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新密码
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="请输入新密码（至少6位）"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              {formData.newPassword && formData.newPassword.length < 6 && (
                <p className="mt-1 text-sm text-red-600">密码长度至少6位</p>
              )}
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                确认新密码
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="请再次输入新密码"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">两次输入的密码不一致</p>
              )}
            </div>

            {/* 提示信息 */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-yellow-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900 mb-1">重要提示</p>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• 密码长度至少6位</li>
                    <li>• 新密码不能与旧密码相同</li>
                    <li>• 修改成功后需要重新登录</li>
                    <li>• 建议使用字母、数字和符号组合</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 提交按钮 */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '修改中...' : '🔒 确认修改'}
              </button>
            </div>
          </form>
        </div>

        {/* 安全提示 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-xl">💡</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">密码安全建议</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 定期更换密码（建议每3个月）</li>
                <li>• 不要使用生日、电话等容易猜到的密码</li>
                <li>• 不要在多个系统使用相同密码</li>
                <li>• 不要将密码告诉他人</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangePassword
