import logger from '@/utils/logger';
import axios from 'axios'
import { tokenManager } from './apiClient'

// 创建 axios 实例
const axiosInstance = axios.create()

// 请求拦截器：自动添加 Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器：处理 401 错误
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 如果是 401 错误且还没有重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // 尝试刷新 token
        const newToken = await tokenManager.refreshToken()

        // 更新请求头
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        // 重试原始请求
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        // 刷新失败，清除 token
        tokenManager.clearTokens()
        logger.error('Token 刷新失败，已清除缓存，禁用自动跳转以供调试');
        // window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
