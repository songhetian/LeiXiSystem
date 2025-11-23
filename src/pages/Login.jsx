import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { getApiUrl } from '../utils/apiConfig'
import { tokenManager } from '../utils/apiClient'

const Login = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    email: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [rememberPassword, setRememberPassword] = useState(false)

  // 组件加载时，从localStorage读取记住的密码
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername')
    const savedPassword = localStorage.getItem('rememberedPassword')
    const isRemembered = localStorage.getItem('rememberPassword') === 'true'

    if (isRemembered && savedUsername && savedPassword) {
      // 简单的Base64解码（注意：这不是安全的加密，只是混淆）
      try {
        const decodedPassword = atob(savedPassword)
        setFormData(prev => ({
          ...prev,
          username: savedUsername,
          password: decodedPassword
        }))
        setRememberPassword(true)
      } catch (error) {
        console.error('解码密码失败:', error)
      }
    }
  }, [])

  // 执行登录
  const performLogin = async (forceLogin = false) => {
    try {
      const response = await axios.post(getApiUrl('/api/auth/login'), {
        username: formData.username,
        password: formData.password,
        forceLogin
      })

      if (response.data.success) {
        tokenManager.setToken(response.data.token, response.data.expiresIn || 3600)
        if (response.data.refresh_token) {
          tokenManager.setRefreshToken(response.data.refresh_token)
        }
        localStorage.setItem('user', JSON.stringify(response.data.user))

        // 处理记住密码
        if (rememberPassword) {
          // 简单的Base64编码（注意：这不是安全的加密，只是混淆）
          const encodedPassword = btoa(formData.password)
          localStorage.setItem('rememberedUsername', formData.username)
          localStorage.setItem('rememberedPassword', encodedPassword)
          localStorage.setItem('rememberPassword', 'true')
        } else {
          // 如果不记住密码，清除之前保存的
          localStorage.removeItem('rememberedUsername')
          localStorage.removeItem('rememberedPassword')
          localStorage.removeItem('rememberPassword')
        }

        toast.success('登录成功！')
        setShowConfirmModal(false)
        onLoginSuccess(response.data.user)
      }
    } catch (error) {
      throw error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('') // 清除之前的错误

    try {
      if (isLogin) {
        // 先检查是否有活跃会话
        const checkResponse = await axios.post(getApiUrl('/api/auth/check-session'), {
          username: formData.username
        })

        if (checkResponse.data.hasActiveSession) {
          // 有活跃会话，显示确认对话框
          setSessionInfo(checkResponse.data)
          setShowConfirmModal(true)
          setLoading(false)
          return
        }

        // 没有活跃会话，直接登录
        await performLogin(false)
      } else {
        // 注册
        const response = await axios.post(getApiUrl('/api/auth/register'), formData)

        if (response.data.success) {
          toast.success('注册成功！请登录')
          setIsLogin(true)
          setFormData({ username: '', password: '', real_name: '', email: '', phone: '' })
        }
      }
    } catch (error) {
      console.error('登录/注册错误:', error)

      // 详细的错误提示
      if (error.response) {
        const status = error.response.status
        const message = error.response.data?.message

        let errorMsg = ''

        if (isLogin) {
          // 登录错误
          if (status === 401) {
            errorMsg = '用户名或密码错误，请检查后重试'
            toast.error('❌ ' + errorMsg, {
              autoClose: 5000,
              position: 'top-center'
            })
          } else if (status === 403) {
            errorMsg = '账号已被禁用，请联系管理员'
            toast.error('❌ ' + errorMsg, {
              autoClose: 5000
            })
          } else if (message) {
            errorMsg = message
            toast.error(`❌ ${message}`)
          } else {
            errorMsg = '登录失败，请稍后重试'
            toast.error('❌ ' + errorMsg)
          }
        } else {
          // 注册错误
          if (status === 400) {
            errorMsg = message || '注册信息有误，请检查'
            toast.error(`❌ ${errorMsg}`, {
              autoClose: 5000
            })
          } else if (message) {
            errorMsg = message
            toast.error(`❌ ${message}`)
          } else {
            errorMsg = '注册失败，请稍后重试'
            toast.error('❌ ' + errorMsg)
          }
        }

        setErrorMessage(errorMsg)
      } else if (error.request) {
        // 网络错误
        const errorMsg = '无法连接到服务器，请检查网络连接或确认后端服务器正在运行'
        setErrorMessage(errorMsg)
        toast.error('❌ ' + errorMsg, {
          autoClose: 5000,
          position: 'top-center'
        })
      } else {
        // 其他错误
        const errorMsg = error.message || (isLogin ? '登录失败' : '注册失败')
        setErrorMessage(errorMsg)
        toast.error(`❌ ${errorMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-primary-100 rounded-full mb-4">
            <span className="text-4xl">💬</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">雷犀客服系统</h1>
          <p className="text-gray-500 mt-2">企业级客服管理平台</p>
        </div>

        {/* 切换登录/注册 */}
        <div className="flex mb-6 bg-primary-50 rounded-lg p-1">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg transition-all ${
              isLogin ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg transition-all ${
              !isLogin ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600'
            }`}
          >
            注册
          </button>
        </div>

        {/* 错误提示框 */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg animate-shake">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-2xl flex-shrink-0">❌</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-1">登录失败</p>
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage('')}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">真实姓名</label>
              <input
                type="text"
                value={formData.real_name}
                onChange={(e) => setFormData({...formData, real_name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请输入真实姓名"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入用户名"
              required
            />
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入邮箱"
                  required={!isLogin}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入手机号"
                  required={!isLogin}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入密码"
              required
            />
          </div>

          {/* 记住密码选项 */}
          {isLogin && (
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-700 group-hover:text-primary-600 transition-colors">
                  记住密码
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>
      </div>

      {/* 确认登录对话框 */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 m-4 animate-fadeIn">
            {/* 图标 */}
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
                <span className="text-5xl">⚠️</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">检测到活跃会话</h2>
              <p className="text-gray-600">该账号已在其他设备登录</p>
            </div>

            {/* 会话信息 */}
            {sessionInfo && sessionInfo.sessionCreatedAt && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 text-xl">ℹ️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">会话信息</p>
                    <p className="text-sm text-blue-800">
                      登录时间：{new Date(sessionInfo.sessionCreatedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 提示信息 */}
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-xl">🚨</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 mb-2">重要提示</p>
                  <p className="text-sm text-red-800 leading-relaxed">
                    如果继续登录，之前登录的设备将被强制退出。
                    <br />
                    请确认这是您本人的操作。
                  </p>
                </div>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setLoading(false)
                }}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setLoading(true)
                  try {
                    await performLogin(true)
                  } catch (error) {
                    console.error('强制登录失败:', error)
                    setShowConfirmModal(false)

                    // 显示错误信息
                    if (error.response) {
                      const message = error.response.data?.message
                      if (error.response.status === 401) {
                        setErrorMessage('用户名或密码错误')
                        toast.error('❌ 用户名或密码错误')
                      } else if (message) {
                        setErrorMessage(message)
                        toast.error(`❌ ${message}`)
                      }
                    } else {
                      setErrorMessage('登录失败，请稍后重试')
                      toast.error('❌ 登录失败')
                    }
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '确认登录'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
