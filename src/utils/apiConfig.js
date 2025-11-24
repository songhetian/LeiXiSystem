// API配置工具
export const getApiBaseUrl = () => {
  // 1. 浏览器环境 (HTTP/HTTPS): 动态获取当前主机名
  // 这样如果服务器IP变了，浏览器端会自动适应，不需要重新构建；
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001/api`;
  }

  // 2. Electron环境 (File协议) 或 其他环境: 使用环境变量配置
  // 打包后的Electron应用需要知道服务器的具体IP
  // 3. 默认兜底: 优先使用环境变量，否则使用 localhost
  try {
    const env = import.meta?.env;
    if (env?.VITE_API_BASE_URL) {
      return env.VITE_API_BASE_URL;
    }
  } catch (e) {
    // 忽略错误
  }

  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
}

/**
 * 获取完整的API URL
 * @param {string} path - API路径，如'/users'
 * @returns {string} - 完整的API URL，如'http://192.168.110.83:3001/api/users'
 */
export const getApiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  // 如果path已经包含/api，则移除baseUrl中的/api
  if (path.startsWith('/api/')) {
    return baseUrl.replace('/api', '') + path;
  }
  // 如果path不以/开头，添加/
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return baseUrl + path;
}

export default {
  getApiBaseUrl,
  getApiUrl
}
