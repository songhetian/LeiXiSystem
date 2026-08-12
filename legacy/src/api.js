import logger from '@/utils/logger';
import axios from 'axios';
import { getApiUrl } from './utils/apiConfig';

/**
 * 雷犀旗舰版 API 客户端 (带路径自愈与拦截功能)
 */
const api = axios.create({
  baseURL: getApiUrl(''), // 基础路径，通常包含 /api
  timeout: 10000,
});

// --- 请求拦截器：实现路径全自动修复 (自愈引擎) ---
api.interceptors.request.use(
  (config) => {
    // 1. 获取 Token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. 核心修正：自动识别并物理移除重复的 /api 前缀
    // 逻辑：如果 baseURL 已有 /api，而 url 也以 /api 开头，则发生冲突
    const baseUrlHasApi = config.baseURL?.endsWith('/api') || config.baseURL?.endsWith('/api/');
    
    if (baseUrlHasApi && config.url?.startsWith('/api')) {
      logger.warn(`[API Repair] 检测到重复前缀，已自动修正: ${config.url}`);
      // 移除请求路径开头的 /api
      config.url = config.url.replace(/^\/api/, '');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 处理 Token 过期
      localStorage.removeItem('token');
      // 可以根据需要跳转登录，或触发全局消息
    }
    return Promise.reject(error);
  }
);

export default api;
