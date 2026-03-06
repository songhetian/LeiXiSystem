/**
 * 雷犀旗舰版 API 配置中心
 * 规约执行：生产环境强制使用相对路径，彻底解决 HTTPS 混合内容 (Mixed Content) 报错
 */

export const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDev) {
    return 'http://localhost:3001/api';
  }

  // 物理闭环：生产环境一律使用相对路径 /api
  // 这样无论您是用域名还是 IP，HTTPS 还是 HTTP，浏览器都会自动补全
  return '/api';
};

export const getUploadBaseUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isDev) {
    return 'http://localhost:3001';
  }
  return ''; // 生产环境使用相对路径
};

export const API_BASE_URL = getApiBaseUrl();
export const UPLOAD_BASE_URL = getUploadBaseUrl();

/**
 * 获取完整的 API URL
 * @param {string} path 请求路径
 * @returns {string} 完整的 API URL
 */
export const getApiUrl = (path) => {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const base = API_BASE_URL;
  let cleanPath = path;
  
  // 避免 /api/api 重复前缀
  if (path.startsWith('/api') && base.endsWith('/api')) {
    cleanPath = path.substring(4);
  }
  
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  
  return `${normalizedBase}${normalizedPath}`;
};

/**
 * 异步获取完整的 API URL (兼容旧版调用)
 */
export const getApiUrlAsync = async (path) => {
  return getApiUrl(path);
};

/**
 * 加载运行时配置 (保持兼容性，目前逻辑已简化)
 */
export const loadRuntimeConfig = async () => {
  return null;
};

/**
 * 获取文件完整访问路径
 */
export const getFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const baseUrl = getUploadBaseUrl();
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * 获取 WebSocket 基础路径
 */
export const getWsBaseUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isDev) {
    return 'ws://localhost:3001';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export default {
  API_BASE_URL,
  UPLOAD_BASE_URL,
  getApiBaseUrl,
  getUploadBaseUrl,
  getApiUrl,
  getApiUrlAsync,
  getFileUrl,
  getWsBaseUrl,
  loadRuntimeConfig
};
