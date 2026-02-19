// API配置工具
let cachedConfig = null;
let configPromise = null;

/**
 * 从 public/config.json 加载运行时配置
 * 这个文件在打包后可以被用户修改，无需重新构建应用
 */
export async function loadRuntimeConfig() {
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
        // 将加载到的配置存入 localStorage 供同步函数 getApiBaseUrl 使用
        if (cachedConfig && cachedConfig.apiBaseUrl) {
          localStorage.setItem('runtime_api_base_url', cachedConfig.apiBaseUrl);
        }
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
  // 0. 开发环境 (npm run dev): 强制使用 Vite 代理
  // 忽略 config.json 配置，确保连接本地后端
  if (import.meta.env.DEV) {
    return '/api';
  }

  // 1. 优先尝试从 localStorage 获取运行时配置（供同步调用）
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('runtime_api_base_url') : null;
  if (savedUrl) {
    return savedUrl;
  }

  // 2. 浏览器环境 (HTTP/HTTPS): 统一使用相对路径 /api
  // 依靠 Vite 代理(开发环境) 或 Nginx 代理(生产环境) 转发请求到后端
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return '/api';
  }

  // 3. Electron环境 (File协议等): 使用构建时的环境变量
  try {
    const env = import.meta?.env;
    if (env?.VITE_API_BASE_URL) {
      const url = env.VITE_API_BASE_URL;
      return url.endsWith('/api') ? url : url + '/api';
    }
  } catch (e) {
    // 忽略错误
  }

  // 4. 默认兜底 (通常是开发环境的本地地址)
  return 'http://localhost:3001/api';
}

/**
 * 异步获取 API Base URL，优先从运行时配置加载
 * 用于 Electron 打包后的应用
 */
export async function getApiBaseUrlAsync() {
  // 0. 开发环境 (npm run dev): 强制使用 Vite 代理
  if (import.meta.env.DEV) {
    return '/api';
  }

  // 1. 尝试加载运行时配置
  const runtimeConfig = await loadRuntimeConfig();
  if (runtimeConfig?.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }

  // 2. 浏览器环境 (HTTP/HTTPS): 统一使用相对路径 /api
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return '/api';
  }

  // 3. 使用构建时环境变量
  try {
    const env = import.meta?.env;
    if (env?.VITE_API_BASE_URL) {
      const url = env.VITE_API_BASE_URL;
      return url.endsWith('/api') ? url : url + '/api';
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
 */
export const getApiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  let cleanPath = path;
  
  // 如果path已经包含/api，则移除baseUrl中的/api
  if (path.startsWith('/api/')) {
    return baseUrl.replace(/\/api$/, '') + path;
  }
  
  // 确保 path 以 / 开头
  if (!path.startsWith('/')) {
    cleanPath = '/' + path;
  }
  
  return baseUrl + cleanPath;
}

/**
 * 异步获取完整的API URL
 */
export async function getApiUrlAsync(path) {
  const baseUrl = await getApiBaseUrlAsync();
  let cleanPath = path;
  
  if (path.startsWith('/api/')) {
    return baseUrl.replace(/\/api$/, '') + path;
  }
  
  if (!path.startsWith('/')) {
    cleanPath = '/' + path;
  }
  
  return baseUrl + cleanPath;
}

/**
 * 获取 WebSocket 连接的绝对基础 URL
 * Socket.IO 不支持相对路径，必须使用绝对 URL
 */
export const getWsBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const hostname = window.location.hostname;
    const port = window.location.port;

    // 开发环境 (Vite 默认端口 5173)
    // 如果是通过 localhost 访问且在 5173 端口，说明是开发环境，通常后端在 3001
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173') {
      return `http://${hostname}:3001`;
    }

    // 如果是通过 IP 访问（如局域网调试），或者是非 5173 端口
    // 优先尝试使用当前 origin，依靠 Vite 代理或 Nginx 代理转发 /socket.io
    return window.location.origin;
  }

  // Electron 等非 HTTP 环境，尝试从配置获取
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('runtime_api_base_url') : null;
  if (savedUrl) {
    return savedUrl.replace(/\/api$/, '');
  }

  return 'http://localhost:3001';
};

export default {
  getApiBaseUrl,
  getApiBaseUrlAsync,
  getApiUrl,
  getApiUrlAsync,
  getWsBaseUrl,
  loadRuntimeConfig
}
