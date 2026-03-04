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
        // 将整个配置对象存入 localStorage，以便同步函数使用
        if (cachedConfig) {
          localStorage.setItem('runtime_config', JSON.stringify(cachedConfig));
          if (cachedConfig.apiBaseUrl) {
            localStorage.setItem('runtime_api_base_url', cachedConfig.apiBaseUrl);
          }
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

    // 开发环境：如果访问的是 Vite 端口 (5173)
    if (port === '5173') {
      return `http://${hostname}:3001`;
    }

    // 生产环境或通过代理访问
    return window.location.origin;
  }

  // Electron 等非 HTTP 环境，尝试从配置获取
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('runtime_api_base_url') : null;
  if (savedUrl) {
    return savedUrl.replace(/\/api$/, '');
  }

  return 'http://localhost:3001';
};

/**
 * 将相对路径转换为完整的文件访问 URL
 * @param {string} path - 相对路径，如 '/uploads/xxx.png'
 */
export const getFileUrl = (path) => {
  if (!path) return '';

  let finalPath = path;

  // 1. 如果是完整 URL，检查是否指向旧的本地服务器
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // 如果包含 localhost 或 127.0.0.1，说明是老数据，剥离它并尝试转换为 OSS
    if (path.includes('localhost:') || path.includes('127.0.0.1:')) {
      try {
        const url = new URL(path);
        finalPath = url.pathname; // 获取路径部分，如 /uploads/avatar/xxx.png
      } catch (e) {
        // 解析失败则尝试粗暴截断
        finalPath = path.substring(path.indexOf('/', 8));
      }
    } else {
      // 指向外部（如已经是 OSS 或其他地址），直接返回
      return path;
    }
  } else if (path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  // 确保路径以 / 开头
  let cleanPath = finalPath.startsWith('/') ? finalPath : '/' + finalPath;

  // 2. 获取 OSS 配置
  let ossBucket = null;
  let ossRegion = null;
  let ossDomain = null;

  try {
    const savedConfig = typeof localStorage !== 'undefined' ? localStorage.getItem('runtime_config') : null;
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      ossBucket = config.ossBucket;
      ossRegion = config.ossRegion;
      ossDomain = config.ossDomain;
    }
  } catch (e) {}

  // 兜底使用环境变量
  ossBucket = ossBucket || import.meta.env.VITE_OSS_BUCKET;
  ossRegion = ossRegion || import.meta.env.VITE_OSS_REGION;
  ossDomain = ossDomain || import.meta.env.VITE_OSS_CUSTOM_DOMAIN;

  // 验证有效性（防止 "undefined" 字符串干扰）
  const isValid = (val) => val && val !== 'undefined' && val !== 'null';

  if (isValid(ossBucket) && isValid(ossRegion)) {
    // 强制清理 /uploads/ 前缀（针对 OSS）
    if (cleanPath.startsWith('/uploads/')) {
        cleanPath = cleanPath.substring(8);
    }

    if (isValid(ossDomain)) {
      const domain = ossDomain.replace(/\/$/, '');
      const finalDomain = domain.startsWith('http') ? domain : `https://${domain}`;
      return `${finalDomain}${cleanPath}`;
    }
    return `https://${ossBucket}.${ossRegion}.aliyuncs.com${cleanPath}`;
  }

  // 3. Fallback: 本地服务器逻辑
  const wsBase = getWsBaseUrl();

  if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('/api/')) {
    cleanPath = '/uploads' + cleanPath;
  }

  return `${wsBase}${cleanPath}`;
}

export default {
  getApiBaseUrl,
  getApiBaseUrlAsync,
  getApiUrl,
  getApiUrlAsync,
  getWsBaseUrl,
  getFileUrl,
  loadRuntimeConfig
}
