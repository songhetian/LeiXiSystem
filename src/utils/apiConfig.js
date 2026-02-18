// API配置工具
let cachedConfig = null;
let configPromise = null;

/**
 * 从 public/config.json 加载运行时配置
 * 这个文件在打包后可以被用户修改，无需重新构建应用
 */
async function loadRuntimeConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    try {
      // 在打包后的应用中，config.json 会在 dist-react 目录下
      const response = await fetch('/config.json');
      if (response.ok) {
        cachedConfig = await response.json();
        return cachedConfig;
      }
    } catch (e) {
      console.warn('Failed to load runtime config:', e);
    }
    return null;
  })();

  return configPromise;
}

export const getApiBaseUrl = () => {
  // 1. 浏览器环境 (HTTP/HTTPS): 动态获取当前主机名
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const hostname = window.location.hostname;
    
    // 如果是生产环境 IP 或 域名，返回相对路径 /api
    // 只有在 localhost 开发且不是通过 Nginx 访问时才返回带端口的地址
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = import.meta.env?.VITE_API_PORT || '3001';
      return `http://${hostname}:${port}/api`;
    }
    
    // 生产环境：使用相对路径，让 Nginx 处理转发，解决 CORS 问题
    return '/api';
  }

  // 2. Electron环境 (File协议): 使用构建时的环境变量
  // 注意：import.meta.env 只在构建时可用
  try {
    const env = import.meta?.env;
    if (env?.VITE_API_BASE_URL) {
      return env.VITE_API_BASE_URL;
    }
  } catch (e) {
    // 忽略错误
  }

  // 3. 从环境变量获取
  const apiUrl = import.meta.env?.VITE_API_BASE_URL;
  if (apiUrl) {
    return apiUrl.endsWith('/api') ? apiUrl : apiUrl + '/api';
  }
  
  // 4. 默认兜底
  return 'http://localhost:3001/api';
}

/**
 * 异步获取 API Base URL，优先从运行时配置加载
 * 用于 Electron 打包后的应用
 */
export async function getApiBaseUrlAsync() {
  // 1. 浏览器环境 (HTTP/HTTPS): 动态获取当前主机名
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const hostname = window.location.hostname;
    
    // 如果是生产环境 IP 或 域名，返回相对路径 /api
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return '/api';
    }
    
    return `http://${hostname}:3001/api`;
  }

  // 2. 尝试加载运行时配置（用于打包后的 Electron 应用）
  const runtimeConfig = await loadRuntimeConfig();
  if (runtimeConfig?.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }

  // 3. 使用构建时环境变量
  try {
    const env = import.meta?.env;
    if (env?.VITE_API_BASE_URL) {
      return env.VITE_API_BASE_URL;
    }
  } catch (e) {
    // 忽略错误
  }

  // 4. 默认兜底
  const port = import.meta.env?.VITE_API_PORT || '3001';
  return 'http://localhost:' + port + '/api';
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
    return baseUrl.replace(/\/api$/, '') + path;
  }
  // 如果path不以/开头，添加/
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return baseUrl + path;
}

/**
 * 异步获取完整的API URL
 * @param {string} path - API路径，如'/users'
 * @returns {Promise<string>} - 完整的API URL
 */
export async function getApiUrlAsync(path) {
  const baseUrl = await getApiBaseUrlAsync();
  // 如果path已经包含/api，则移除baseUrl中的/api
  if (path.startsWith('/api/')) {
    return baseUrl.replace(/\/api$/, '') + path;
  }
  // 如果path不以/开头，添加/
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return baseUrl + path;
}

export default {
  getApiBaseUrl,
  getApiBaseUrlAsync,
  getApiUrl,
  getApiUrlAsync
}
