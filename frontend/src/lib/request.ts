import axios from 'axios';
import { Message } from '@arco-design/web-react';
import { useAuthStore } from '@/store/auth';
import { redirectToLogin } from '@/lib/redirect';

export class ApiError extends Error {
  code: number;
  data?: any;
  /** 是否已由请求层弹出过错误提示；置 true 供调用方判断以避免重复 Toast */
  surfaced = false;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

/** 相同文案在窗口期内只弹一次，避免拦截器与调用方重复 Toast */
const RECENT_TOASTS = new Map<string, number>();
const TOAST_DEDUP_MS = 2000;

export function showErrorToast(message: string) {
  const now = Date.now();
  const last = RECENT_TOASTS.get(message);
  if (last !== undefined && now - last < TOAST_DEDUP_MS) {
    return;
  }
  RECENT_TOASTS.set(message, now);
  Message.error(message);
}

/**
 * 在调用方 catch 块中替代裸 `Message.error`：
 * 若错误已由请求拦截器提示过（error.surfaced），则不再重复弹窗。
 */
export function notifyError(error: any, fallback = '操作失败') {
  if (error?.surfaced) return;
  showErrorToast(error?.message || fallback);
}

const request = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
  withCredentials: true,
  timeout: 15000,
});

request.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code === 0) {
        return data;
      }
      const err = new ApiError(data.code, data.message || '请求失败', data.data);
      const isMockUser = useAuthStore.getState().isMockUser;
      if (!isMockUser && data.code !== 5003) {
        showErrorToast(data.message || '请求失败');
      }
      err.surfaced = true;
      return Promise.reject(err);
    }
    return data;
  },
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || '网络错误';
    const isMockUser = useAuthStore.getState().isMockUser;
    // 登录接口自身返回的 401/403 属预期失败（密码错误、被封禁），
    // 不应被当作“会话过期”触发整页跳转；真实原因交由调用方展示。
    const isAuthEndpoint =
      typeof err.config?.url === 'string' &&
      (err.config.url === '/auth/login' || err.config.url.endsWith('/auth/login'));

    if (status === 401 && !isAuthEndpoint) {
      if (!isMockUser) {
        showErrorToast('登录已过期，请重新登录');
        setTimeout(() => {
          redirectToLogin('/login');
        }, 1000);
      }
    } else if (status === 403) {
      if (!isMockUser) {
        showErrorToast('没有权限执行此操作');
      }
    } else {
      if (!isMockUser && !isAuthEndpoint) {
        showErrorToast(message);
      }
    }
    
    const apiError = new ApiError(status || -1, message, err.response?.data);
    apiError.surfaced = true;
    return Promise.reject(apiError);
  },
);

export default request;
