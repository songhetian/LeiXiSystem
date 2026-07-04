import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { toast } from '@/utils/toast'
import { useAuthStore } from '@/store/auth'
import { addPendingRequest, removePendingRequest } from './requestCancel'
import { getCache, setCache } from './requestCache'
import { requestWithRetry } from './requestRetry'
import { logger } from '@/utils/logger'

declare module 'axios' {
  interface AxiosRequestConfig {
    cancelDuplicate?: boolean
    useCache?: boolean
    cacheTime?: number
    silent?: boolean
    retryConfig?: {
      retries?: number
      retryDelay?: number
    }
  }
}

type ExtendedRequestConfig = AxiosRequestConfig

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (config) => {
    const { cancelDuplicate = true, useCache = false, method } = config

    // Inject Authorization token
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }

    if (cancelDuplicate) {
      addPendingRequest(config)
    }

    if (useCache && method?.toLowerCase() === 'get') {
      const cachedData = getCache(config)
      if (cachedData) {
        logger.debug('命中缓存', config.url)
        return Promise.resolve({
          data: cachedData,
          config,
          headers: {},
          status: 200,
          statusText: 'OK',
          __fromCache: true,
        } as any)
      }
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

request.interceptors.response.use(
  (response) => {
    const config = response.config as ExtendedRequestConfig

    removePendingRequest(config)

    const data = response.data

    if ((response as any).__fromCache) {
      return response.data
    }

    if (config.useCache && config.method?.toLowerCase() === 'get') {
      setCache(config, data, config.cacheTime)
    }

    if (data && data.success === false) {
      if (!config.silent) {
        toast.error(data.message || '请求失败')
      }
      return Promise.reject(data)
    }
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0) {
      if (!config.silent) {
        toast.error(data.message || '请求失败')
      }
      return Promise.reject(data)
    }
    return data
  },
  (error) => {
    const config = error.config as ExtendedRequestConfig

    if (config) {
      removePendingRequest(config)
    }

    if (error.code === 'ERR_CANCELED') {
      logger.debug('请求已取消', config?.url)
      return Promise.reject(error)
    }

    // Silent mode: suppress toast & redirect, let caller handle errors
    if (config?.silent) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const message = error.response?.data?.message || error.message

    switch (status) {
      case 401:
        toast.error('登录已过期，请重新登录')
        useAuthStore.getState().logout()
        window.location.href = '/login'
        break
      case 403:
        toast.error('没有权限执行此操作')
        break
      case 423:
        toast.error(message || '账号已临时锁定，请稍后再试')
        break
      case 429:
        toast.error(message || '请求过于频繁，请稍后再试')
        break
      case 413:
        toast.error(message || '上传内容超过大小限制')
        break
      case 404:
        toast.error(message || '请求的资源不存在')
        break
      case 500:
        toast.error(message || '服务器内部错误')
        break
      default:
        toast.error(message || '网络错误')
    }

    return Promise.reject(error)
  },
)

export function get<T = any>(url: string, config?: ExtendedRequestConfig): Promise<T> {
  if (config?.retryConfig) {
    return requestWithRetry((cfg) => request.get(url, cfg), {
      ...config,
      method: 'GET',
      url,
    } as any) as Promise<T>
  }
  return request.get(url, config)
}

export function post<T = any>(url: string, data?: any, config?: ExtendedRequestConfig): Promise<T> {
  if (config?.retryConfig) {
    return requestWithRetry((cfg) => request.post(url, data, cfg), {
      ...config,
      method: 'POST',
      url,
      data,
    } as any) as Promise<T>
  }
  return request.post(url, data, config)
}

export function put<T = any>(url: string, data?: any, config?: ExtendedRequestConfig): Promise<T> {
  return request.put(url, data, config)
}

export function del<T = any>(url: string, config?: ExtendedRequestConfig): Promise<T> {
  return request.delete(url, config)
}

export default request
export type { ExtendedRequestConfig }
