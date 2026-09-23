import { toast } from 'sonner';
import { getApiUrl, getApiUrlAsync } from './apiConfig';
import logger from './logger';

/**
 * Token管理工具类
 */
class TokenManager {
  constructor() {
    this.tokenKey = 'token';
    this.refreshTokenKey = 'refresh_token';
    this.tokenExpiryKey = 'token_expiry';
  }

  /**
   * 获取token (带健壮性校验)
   */
  getToken() {
    const t = localStorage.getItem(this.tokenKey) || localStorage.getItem('access_token') || '';
    
    // 增加严格校验：防止 "null", "undefined" 等无效字符串被当作 Token 发送
    if (!t || t === 'null' || t === 'undefined' || t === '[object Object]' || t.length < 10) {
      return '';
    }
    return t;
  }

  /**
   * 设置token
   */
  setToken(token, expiresIn = 3600) {
    localStorage.setItem(this.tokenKey, token);
    // 设置过期时间 (当前时间 + expiresIn秒)
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(this.tokenExpiryKey, expiryTime.toString());
  }

  /**
   * 获取刷新token
   */
  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey) || '';
  }

  /**
   * 设置刷新token
   */
  setRefreshToken(refreshToken) {
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  /**
   * 清除所有token
   */
  clearTokens() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('access_token');
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.tokenExpiryKey);
  }

  /**
   * 检查token是否过期
   */
  isTokenExpired() {
    const expiryTime = localStorage.getItem(this.tokenExpiryKey);
    if (expiryTime) {
      return Date.now() > (parseInt(expiryTime) - 2 * 60 * 1000);
    }

    const token = this.getToken();
    if (!token) return true;
    const payload = this.parseToken(token);
    if (!payload || !payload.exp) return true;
    return Date.now() > (payload.exp * 1000 - 2 * 60 * 1000);
  }

  /**
   * 从JWT token中解析payload
   */
  parseToken(token) {
    try {
      if (!token) return null;
      const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload;
    } catch (error) {
      logger.error('Token解析失败:', error);
      return null;
    }
  }

  /**
   * 获取当前用户ID
   */
  getCurrentUserId() {
    const token = this.getToken();
    const payload = this.parseToken(token);
    return payload?.userId || payload?.user_id || payload?.sub || payload?.id || null;
  }

  /**
   * 刷新token
   */
  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'no_refresh_token' } }));
      throw new Error('No refresh token available');
    }

    try {
      const apiUrl = await getApiUrlAsync('/api/auth/refresh');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      if (data.token) {
        this.setToken(data.token, data.expiresIn || 2592000);
        if (data.refresh_token) {
          this.setRefreshToken(data.refresh_token);
        }
        return data.token;
      }

      throw new Error('Invalid refresh response');
    } catch (error) {
      logger.error('🔴 [TokenManager] 严重：Token 续期失败，强制退出...', error);
      this.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'token_refresh_failed' } }));
      throw error;
    }
  }
}

// 创建单例
export const tokenManager = new TokenManager();

// --- 性能与稳定性优化：解决高并发下的 Token 续期冲突 ---
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  refreshQueue = [];
};

/**
 * 统一的错误处理
 */
export const handleApiError = (error, customMessage = null) => {
  logger.error('API错误:', error);

  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    toast.error('无法连接到服务器,请检查网络连接');
    return;
  }

  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.response.data?.error;

    switch (status) {
      case 400: toast.error(message || '请求参数错误'); break;
      case 401:
        logger.warn(`🔴 [apiClient] 收到 401 Unauthorized, URL: ${error.config?.url || 'unknown'}, 消息: ${message}`);
        toast.error('登录已过期，请重新登录');
        tokenManager.clearTokens();
        localStorage.removeItem('user');
        setTimeout(() => {
          logger.info('📢 [apiClient] 正在触发 auth:logout 事件...');
          window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: '401_unauthorized', url: error.config?.url } }));
        }, 1500);
        break;
      case 403: toast.error('没有权限执行此操作'); break;
      case 404: toast.error(message || '请求的资源不存在'); break;
      case 500: toast.error(message || '服务器内部错误'); break;
      default: toast.error(customMessage || message || '操作失败');
    }
  } else {
    toast.error(customMessage || error.message || '操作失败');
  }
};

/**
 * 统一的API请求封装
 */
export const apiRequest = async (url, options = {}) => {
  const { skipRefresh = false, params, ...fetchOptions } = options;

  let targetUrl = url;
  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
    ).toString();
    if (queryString) {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  if (!skipRefresh && tokenManager.isTokenExpired()) {
    try {
      await tokenManager.refreshToken();
    } catch (error) {
      throw error;
    }
  }

  const token = tokenManager.getToken();
  const config = {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body && { 'Content-Type': 'application/json' }),
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...fetchOptions.headers,
    },
  };

  try {
    const response = await fetch(targetUrl, config);

    if (response.status === 401 && !skipRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(newToken => {
          return fetch(targetUrl, {
            ...config,
            headers: { ...config.headers, 'Authorization': `Bearer ${newToken}` }
          }).then(res => res.json());
        });
      }

      logger.info('🔄 [apiClient] 尝试刷新 Token...');
      isRefreshing = true;

      try {
        const newToken = await tokenManager.refreshToken();
        logger.info('✅ [apiClient] Token 刷新成功，重试请求...');
        isRefreshing = false;
        processQueue(null, newToken);

        const retryResponse = await fetch(targetUrl, {
          ...config,
          headers: { ...config.headers, 'Authorization': `Bearer ${newToken}` },
        });

        return await retryResponse.json();
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);
        logger.error('❌ [apiClient] Token 刷新失败');
        throw refreshError;
      }
    }

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.response = {
        status: response.status,
        data: await response.json().catch(() => ({})),
      };
      throw error;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const apiGet = async (path, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, { ...options, method: 'GET' });
};

export const apiPost = async (path, data, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const apiPut = async (path, data, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const apiDelete = async (path, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, { ...options, method: 'DELETE' });
};

export const apiUpload = async (path, formData, options = {}) => {
  const url = await getApiUrlAsync(path);
  const token = tokenManager.getToken();

  const config = {
    ...options,
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    body: formData,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.response = {
        status: response.status,
        data: await response.json().catch(() => ({})),
      };
      throw error;
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export default {
  tokenManager,
  handleApiError,
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUpload,
};
