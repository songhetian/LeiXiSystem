import { useEffect, useRef } from 'react'
import { toast } from 'sonner';
import { getApiBaseUrl } from '../utils/apiConfig'
import { apiGet } from '../utils/apiClient'

/**
 * Token验证Hook - 实现单设备登录
 * 定期检查token有效性，如果在其他设备登录则自动退出
 */
export const useTokenVerification = (onLogout, userId) => {
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

      // 只有明确返回 valid === false 时才踢出
      if (data && data.valid === false) {
        console.error('Token 校验失败:', data.message);
        // Token无效，清除本地存储
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('sessionToken')

        // 触发退出回调
        if (onLogout) {
          onLogout()
        }
      }
    } catch (error) {
      // 忽略校验过程中的网络错误，避免误踢
      console.error('Token 校验过程异常:', error);
    } finally {
      isCheckingRef.current = false
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !userId) return

    // 立即执行一次验证
    verifyToken()

    // 每30秒检查一次token有效性
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(verifyToken, 30000)

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [onLogout, userId]) // 🚨 监听 userId 变化

  return { verifyToken }
}

export default useTokenVerification
