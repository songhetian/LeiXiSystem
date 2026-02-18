// src/api.js
import axios from 'axios';
import { getApiBaseUrl } from './utils/apiConfig';

// 创建 axios 实例，baseURL 已经包含 /api 前缀
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 确保自定义 headers 不被覆盖
    console.log('[API Request] URL:', config.url);
    console.log('[API Request] Headers:', config.headers);
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMsg = error.response?.data?.message || error.message || '未知错误';

    if (error.response) {
      switch (error.response.status) {
        case 401:
          // 只有在 JWT token 过期时才跳转到登录页面
          // 如果是二级密码验证失败，不跳转
          const message = error.response.data?.message || '';
          const isPasswordError = message.includes('二级密码') || message.includes('需要验证');

          if (!isPasswordError) {
            const logoutReason = `[src/api.js] 401 Unauthorized, URL: ${error.config?.url || 'unknown'}`;
            console.error('🔴', logoutReason);
            // 将原因存入 localStorage 以便刷新后查看
            localStorage.setItem('last_logout_reason', logoutReason);
            localStorage.setItem('last_logout_stack', new Error().stack);

            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // 触发退出事件
            window.dispatchEvent(new CustomEvent('auth:logout', {
              detail: { reason: 'api_401', url: error.config?.url }
            }));
          } else {
            import('sonner').then(({ toast }) => toast.error(errorMsg));
          }
          break;
        case 403:
          import('sonner').then(({ toast }) => toast.error('权限不足：' + errorMsg));
          break;
        case 404:
          import('sonner').then(({ toast }) => toast.error('资源不存在'));
          break;
        case 500:
          import('sonner').then(({ toast }) => toast.error('服务器错误：' + errorMsg));
          break;
        default:
          import('sonner').then(({ toast }) => toast.error('操作失败：' + errorMsg));
      }
    } else if (error.request) {
      import('sonner').then(({ toast }) => toast.error('网络错误，请检查网络连接'));
    } else {
      import('sonner').then(({ toast }) => toast.error('请求配置错误'));
    }
    return Promise.reject(error);
  }
);

export default api;

// 导出各个模块的API
export { default as qualityAPI } from './api/qualityAPI.js';
export { default as sessionAPI } from './api/sessionAPI.js';
export { default as customerAPI } from './api/customerAPI.js';
