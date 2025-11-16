import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'

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
      const API_BASE_URL = getApiBaseUrl()

      const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

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
        } else {
          toast.warning('登录已过期，请重新登录', {
            position: 'top-center',
            autoClose: 3000,
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
      console.error('Token验证失败:', error)
      // 网络错误不退出登录，避免误判
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
