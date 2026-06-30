import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { toast } from '@/utils/toast'
import { useUserStore } from '@/store/user'

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data && data.success === false) {
      toast.error(data.message || '请求失败')
      return Promise.reject(data)
    }
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0) {
      toast.error(data.message || '请求失败')
      return Promise.reject(data)
    }
    return data
  },
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message

    switch (status) {
      case 401:
        toast.error('登录已过期，请重新登录')
        useUserStore.getState().logout()
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

export function get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request.get(url, config)
}

export function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return request.post(url, data, config)
}

export function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return request.put(url, data, config)
}

export function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request.delete(url, config)
}

export default request
