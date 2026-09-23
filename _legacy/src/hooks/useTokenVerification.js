import { useEffect, useRef } from 'react'
import { toast } from 'sonner';
import api from '../api'
import logger from '../utils/logger'

/**
 * Token验证Hook - 实现单设备登录与在线状态校验
 */
export const useTokenVerification = (onLogout, userId) => {
  const intervalRef = useRef(null)

  const verifyToken = async () => {
    // 如果没有 Token 或未登录，不执行校验
    const token = localStorage.getItem('token');
    if (!token || !userId) return;

    try {
      // 使用统一的 api 实例，路径不再包含 /api 前缀
      const res = await api.get('/auth/permissions');
      
      if (res.data && res.data.success) {
        logger.debug('🛡️ [TokenVerify] 校验通过');
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      // 401 说明 Token 物理失效或被踢出
      if (error.response?.status === 401) {
        logger.error('🚨 [TokenVerify] Token 已失效或被其他设备踢出');
        if (onLogout) onLogout('kicked_out_verify');
      } else {
        logger.error('⚠️ [TokenVerify] 校验过程网络异常:', error.message);
      }
    }
  }

  useEffect(() => {
    if (userId) {
      // 立即执行一次
      verifyToken()

      // 设置定时器 (每 2 分钟校验一次)
      intervalRef.current = setInterval(verifyToken, 120000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [onLogout, userId])

  return { verifyToken }
}

export default useTokenVerification
