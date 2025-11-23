import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { apiGet } from '../utils/apiClient'

/**
 * Token验证Hook - 实现单设备登录
 * 定期检查token有效性，如果在其他设备登录则自动退出
 */
export const useTokenVerification = (onLogout) => {
  const intervalRef = useRef(null)
  const isCheckingRef = useRef(false)

  const verifyToken = async () => {
    // 防止重复检查
    if (isCheckingRef.current) return

    const token = localStorage.getItem('token')
    if (!token) return

    try {
      isCheckingRef.current = true

      // 使用apiGet，并跳过自动刷新，避免死循环
      const data = await apiGet('/api/auth/verify-token', {
        skipRefresh: true
      })

      if (!data.valid) {
        // Token无效，清除本地存储
        localStorage.removeItem('token')
        localStorage.removeItem('user')

        // 如果是被踢出（其他设备登录）
        if (data.kicked) {
          toast.error('您的账号已在其他设备登录，当前设备已退出', {
            position: 'top-center',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          })
        }

        // 停止检查
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }

        // 触发退出回调
        if (onLogout) {
          onLogout()
        }
      }
    } catch (error) {
      // 401错误会被apiClient抛出，我们需要捕获它
      if (error.response && error.response.status === 401) {
         // Token无效，清除本地存储
         localStorage.removeItem('token')
         localStorage.removeItem('user')

         // 如果是被踢出
         if (error.response.data && error.response.data.kicked) {
            toast.error('您的账号已在其他设备登录，当前设备已退出', {
              position: 'top-center',
              autoClose: 5000
            })
         }

         if (onLogout) onLogout()
      }
      // 静默处理其他错误
    } finally {
      isCheckingRef.current = false
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // 立即执行一次验证
    verifyToken()

    // 每30秒检查一次token有效性
    intervalRef.current = setInterval(verifyToken, 30000)

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [onLogout])

  return { verifyToken }
}

export default useTokenVerification
