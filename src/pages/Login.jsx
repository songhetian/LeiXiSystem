import React, { useState, useEffect } from 'react'
import { toast } from 'sonner';
import axios from 'axios'
import { getApiUrl } from '../utils/apiConfig'
import { tokenManager } from '../utils/apiClient'
import { pinyin } from 'pinyin-pro'

const Login = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    email: '',
    phone: '',
    department_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [rememberPassword, setRememberPassword] = useState(false)
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [departments, setDepartments] = useState([])

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

  // 获取部门列表
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await axios.get(getApiUrl('/api/departments?forManagement=true'))
        setDepartments(response.data || [])
      } catch (error) {
        console.error('获取部门列表失败:', error)
      }
    }
    fetchDepartments()
  }, [])

  // 自动生成用户名（拼音）
  useEffect(() => {
    if (!isLogin && formData.real_name && formData.real_name.trim()) {
      const pinyinUsername = pinyin(formData.real_name, { toneType: 'none', type: 'array' }).join('').toLowerCase()
      setFormData(prev => ({ ...prev, username: pinyinUsername }))
      // 自动检查用户名
      checkUsername(pinyinUsername, formData.real_name)
    }
  }, [formData.real_name, isLogin])

  // 检查用户名是否可用
  const checkUsername = async (username, realName) => {
    if (!username || username.trim().length === 0) {
      setUsernameAvailable(null)
      setUsernameSuggestions([])
      return
    }

    setIsCheckingUsername(true)
    try {
      const response = await axios.post(getApiUrl('/api/auth/check-username'), {
        username: username.trim(),
        realName: realName || formData.real_name
      })

      if (response.data.available) {
        setUsernameAvailable(true)
        setUsernameSuggestions([])
      } else {
        setUsernameAvailable(false)
        setUsernameSuggestions(response.data.suggestions || [])
      }
    } catch (error) {
      console.error('检查用户名失败:', error)
      setUsernameAvailable(null)
      setUsernameSuggestions([])
    } finally {
      setIsCheckingUsername(false)
    }
  }

  // 验证表单
  const validateForm = () => {
    const errors = {}

    if (!isLogin) {
      // 注册验证
      if (!formData.real_name || formData.real_name.trim().length === 0) {
        errors.real_name = '请输入真实姓名'
      }
      if (!formData.username || formData.username.trim().length === 0) {
        errors.username = '请输入用户名'
      } else if (usernameAvailable === false) {
        errors.username = '用户名已存在，请选择建议或修改'
      }
      if (!formData.password || formData.password.length < 6) {
        errors.password = '密码长度至少6位'
      }
      if (!formData.department_id) {
        errors.department_id = '请选择部门'
      }
    } else {
      // 登录验证
      if (!formData.username) {
        errors.username = '请输入用户名'
      }
      if (!formData.password) {
        errors.password = '请输入密码'
      }
    }

    setFieldErrors(errors)

    // 如果有错误，显示第一个错误的toast
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0]
      toast.error(firstError)
      return false
    }

    return true
  }


  // 执行登录
  const performLogin = async (forceLogin = false) => {
    try {
      const response = await axios.post(getApiUrl('/api/auth/login'), {
        username: formData.username,
        password: formData.password,
        forceLogin
      }, {
        timeout: 10000 // 10秒超时
      })

      if (response.data.success) {
        // 使用后端返回的 expiresIn，若无则固定 86400s（24小时），与后端 JWT 保持一致
        tokenManager.setToken(response.data.token, response.data.expiresIn || 86400)
        if (response.data.refresh_token) {
          tokenManager.setRefreshToken(response.data.refresh_token)
        }
        // 存储token
        localStorage.setItem('token', response.data.token)
        if (response.data.sessionToken) {
          localStorage.setItem('sessionToken', response.data.sessionToken)
        }

        // 存储用户信息,但不包含图片URL(避免缓存问题)
        const userDataForStorage = { ...response.data.user }
        delete userDataForStorage.id_card_front_url
        delete userDataForStorage.id_card_back_url
        localStorage.setItem('user', JSON.stringify(userDataForStorage))

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
      console.error('登录API错误:', error);
      throw error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('') // 清除之前的错误

    // 表单验证
    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      if (isLogin) {
        // 先检查是否有活跃会话
        const checkResponse = await axios.post(getApiUrl('/api/auth/check-session'), {
          username: formData.username
        }, {
          timeout: 10000 // 10秒超时
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
        const response = await axios.post(getApiUrl('/api/auth/register'), formData, {
          timeout: 10000 // 10秒超时
        })

        if (response.data.success) {
          setShowSuccessModal(true)
          setFormData({ username: '', password: '', real_name: '', email: '', phone: '', department_id: '' })
          setFieldErrors({})
        }
      }
    } catch (error) {
      console.error('登录/注册错误:', error)
      // 添加更详细的错误信息
      if (error.code === 'ECONNABORTED') {
        console.error('请求超时');
        toast.error('请求超时，请检查网络连接');
      } else if (error.message === 'Network Error') {
        console.error('网络错误');
        toast.error('网络错误，请检查服务器是否运行');
      } else if (error.response) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-300 rounded-xl shadow-lg w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src="/icons/logo.ico" alt="雷犀客服管理系统" className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">雷犀客服管理系统</h1>
          <p className="text-gray-600 mt-2">企业级客服管理平台</p>
        </div>

        {/* 切换登录/注册 */}
        <div className="flex mb-6 border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-l-lg transition-colors ${
              isLogin ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => {
              setIsLogin(false)
              setFormData({ username: '', password: '', real_name: '', email: '', phone: '' })
              setFieldErrors({})
              setUsernameAvailable(null)
              setUsernameSuggestions([])
            }}
            className={`flex-1 py-2 rounded-r-lg transition-colors ${
              !isLogin ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            注册
          </button>
        </div>

        {/* 错误提示框 */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-xl">❌</span>
              <p className="text-sm text-red-800">{errorMessage}</p>
              <button
                onClick={() => setErrorMessage('')}
                className="ml-auto text-red-400 hover:text-red-600"
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
                onChange={(e) => {
                  setFormData({...formData, real_name: e.target.value})
                  setFieldErrors({...fieldErrors, real_name: ''})
                }}
                className={`w-full px-4 py-2 border rounded-lg ${
                  fieldErrors.real_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入真实姓名"
              />
              {fieldErrors.real_name && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.real_name}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <div className="relative">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => {
                  setFormData({...formData, username: e.target.value})
                  setFieldErrors({...fieldErrors, username: ''})
                  if (!isLogin) {
                    checkUsername(e.target.value, formData.real_name)
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg ${
                  fieldErrors.username ? 'border-red-500' :
                  !isLogin && usernameAvailable === false ? 'border-red-500' :
                  !isLogin && usernameAvailable === true ? 'border-green-500' :
                  'border-gray-300'
                }`}
                placeholder="请输入用户名"
              />
              {!isLogin && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {isCheckingUsername && (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  )}
                  {!isCheckingUsername && usernameAvailable === true && (
                    <span className="text-green-500 text-xl">✓</span>
                  )}
                  {!isCheckingUsername && usernameAvailable === false && (
                    <span className="text-red-500 text-xl">✗</span>
                  )}
                </div>
              )}
            </div>
            {fieldErrors.username && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
            )}
            {/* 用户名建议 */}
            {!isLogin && usernameSuggestions.length > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-800 mb-2">该用户名已被使用，以下是建议：</p>
                <div className="flex flex-wrap gap-2">
                  {usernameSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({...formData, username: suggestion})
                        checkUsername(suggestion, formData.real_name)
                      }}
                      className="px-3 py-1 bg-white border border-yellow-300 rounded-lg text-sm text-gray-700 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>


          {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">部门</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => {
                    setFormData({...formData, department_id: e.target.value})
                    setFieldErrors({...fieldErrors, department_id: ''})
                  }}
                  className={`w-full px-4 py-2 border rounded-lg ${
                    fieldErrors.department_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择部门</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                {fieldErrors.department_id && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.department_id}</p>
                )}
              </div>

          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({...formData, password: e.target.value})
                setFieldErrors({...fieldErrors, password: ''})
              }}
              className={`w-full px-4 py-2 border rounded-lg ${
                fieldErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入密码"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {/* 记住密码选项 */}
          {isLogin && (
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  记住密码
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>
      </div>

      {/* 确认登录对话框 */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white border border-gray-300 w-full max-w-md p-8 m-4">
            {/* 图标 */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <span className="text-4xl">⚠️</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">检测到活跃会话</h2>
              <p className="text-gray-600">该账号已在其他设备登录</p>
            </div>

            {/* 会话信息 */}
            {sessionInfo && sessionInfo.sessionCreatedAt && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 text-lg">ℹ️</span>
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
            <div className="mb-6 p-4 bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-lg">🚨</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 mb-2">重要提示</p>
                  <p className="text-sm text-red-800">
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
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setLoading(true)
                  try {
                    await performLogin(true)
                    // 强制登录成功后关闭模态框
                    setShowConfirmModal(false)
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
                className="flex-1 py-3 px-4 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '确认登录'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注册成功模态框 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-300 max-w-md w-full p-8">
            <div className="text-center">
              {/* 成功图标 */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 bg-green-100 mb-4">
                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>

              {/* 标题 */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">注册成功！</h3>

              {/* 说明文字 */}
              <div className="mb-6 space-y-2">
                <p className="text-gray-600">您的账号已成功提交注册申请</p>
                <div className="bg-blue-50 border border-blue-200 p-4 text-left">
                  <p className="text-sm text-blue-800 mb-2">
                    <span className="font-semibold">📋 下一步：</span>
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1 ml-4">
                    <li>• 您的账号正在等待管理员审核</li>
                    <li>• 审核通过后，您将可以登录系统</li>
                    <li>• 请耐心等待，通常会在1个工作日内完成审核</li>
                  </ul>
                </div>
              </div>

              {/* 按钮 */}
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  setIsLogin(true)
                }}
                className="w-full py-3 px-4 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                好的，我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
