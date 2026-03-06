/**
 * 雷犀旗舰版 API 配置中心
 * 规约执行：生产环境强制使用相对路径，彻底解决 HTTPS 混合内容 (Mixed Content) 报错
 */

const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDev) {
    return 'http://localhost:3001/api';
  }

  // 物理闭环：生产环境一律使用相对路径 /api
  // 这样无论您是用域名还是 IP，HTTPS 还是 HTTP，浏览器都会自动补全
  return '/api';
};

const getUploadBaseUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isDev) {
    return 'http://localhost:3001';
  }
  return ''; // 生产环境使用相对路径
};

export const API_BASE_URL = getApiBaseUrl();
export const UPLOAD_BASE_URL = getUploadBaseUrl();

export default {
  API_BASE_URL,
  UPLOAD_BASE_URL,
  getApiBaseUrl,
  getUploadBaseUrl
};
