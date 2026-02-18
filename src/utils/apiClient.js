import { toast } from 'sonner';
import { getApiUrl, getApiUrlAsync } from './apiConfig';

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
   * 获取token
   */
  getToken() {
    return localStorage.getItem(this.tokenKey) || localStorage.getItem('access_token') || '';
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
   * 优先使用本地存储的过期时间，若不存在则解析 JWT payload 中的 exp 字段
   */
  isTokenExpired() {
    const expiryTime = localStorage.getItem(this.tokenExpiryKey);
    if (expiryTime) {
      // 提前2分钟判断为过期，留出刷新时间
      return Date.now() > (parseInt(expiryTime) - 2 * 60 * 1000);
    }

    // 兜底：解析 JWT payload 中的 exp 字段
    const token = this.getToken();
    if (!token) return true;
    const payload = this.parseToken(token);
    if (!payload || !payload.exp) return true;
    // JWT exp 是秒级时间戳，提前2分钟判断
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
      console.error('Token解析失败:', error);
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
      throw new Error('No refresh token available');
    }

    try {
      const apiUrl = await getApiUrlAsync('/api/auth/refresh');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      if (data.token) {
        this.setToken(data.token, data.expiresIn || 3600);
        if (data.refresh_token) {
          this.setRefreshToken(data.refresh_token);
        }
        return data.token;
      }

      throw new Error('Invalid refresh response');
    } catch (error) {
      console.error('Token刷新失败:', error);
      this.clearTokens();
      // 触发自定义事件，由 App.jsx 监听并执行退出，避免 SPA 中强制页面刷新
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'token_refresh_failed' } }));
      throw error;
    }
  }
}

// 创建单例
export const tokenManager = new TokenManager();

/**
 * 统一的错误处理
 */
export const handleApiError = (error, customMessage = null) => {
  console.error('API错误:', error);

  // 网络错误
  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    toast.error('无法连接到服务器,请检查网络连接');
    return;
  }

  // HTTP错误
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.response.data?.error;

    switch (status) {
      case 400:
        toast.error(message || '请求参数错误');
        break;
      case 401:
        toast.error('登录已过期，请重新登录');
        tokenManager.clearTokens();
        localStorage.removeItem('user');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: '401_unauthorized' } }));
        }, 1500);
        break;
      case 403:
        toast.error('没有权限执行此操作');
        break;
      case 404:
        toast.error(message || '请求的资源不存在');
        break;
      case 500:
        toast.error(message || '服务器内部错误');
        break;
      default:
        toast.error(customMessage || message || '操作失败');
    }
  } else {
    // 其他错误
    toast.error(customMessage || error.message || '操作失败');
  }
};

/**
 * 统一的API请求封装
 */
export const apiRequest = async (url, options = {}) => {
  const { skipRefresh = false, ...fetchOptions } = options;

  // 检查token是否过期
  if (!skipRefresh && tokenManager.isTokenExpired()) {
    try {
      await tokenManager.refreshToken();
    } catch (error) {
      // 刷新失败,已经在refreshToken中处理跳转
      throw error;
    }
  }

  // 获取token
  const token = tokenManager.getToken();

  // 合并默认配置
  const config = {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...fetchOptions.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // 处理401错误 - token可能在请求过程中过期
    if (response.status === 401 && !skipRefresh) {
      try {
        await tokenManager.refreshToken();
        // 重试请求
        const retryResponse = await fetch(url, {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${tokenManager.getToken()}`,
          },
        });

        if (!retryResponse.ok) {
          throw new Error(`HTTP error! status: ${retryResponse.status}`);
        }

        return await retryResponse.json();
      } catch (refreshError) {
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

/**
 * GET请求
 */
export const apiGet = async (path, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, { ...options, method: 'GET' });
};

/**
 * POST请求
 */
export const apiPost = async (path, data, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * PUT请求
 */
export const apiPut = async (path, data, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * DELETE请求
 */
export const apiDelete = async (path, options = {}) => {
  const url = await getApiUrlAsync(path);
  return apiRequest(url, { ...options, method: 'DELETE' });
};

/**
 * 文件上传请求
 */
export const apiUpload = async (path, formData, options = {}) => {
  const url = await getApiUrlAsync(path);
  const token = tokenManager.getToken();

  const config = {
    ...options,
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
      // 不设置Content-Type,让浏览器自动设置multipart/form-data边界
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
