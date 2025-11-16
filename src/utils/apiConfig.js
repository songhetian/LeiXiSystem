// API配置工具
export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://192.168.2.31/api'
}



/**
 * 获取完整的API URL
 * @param {string} path - API路径，如'/users'
 * @returns {string} - 完整的API URL，如'http://192.168.110.83:3001/api/users'
 */
export const getApiUrl = (path) => {
  const baseUrl = getApiBaseUrl()
  // 如果path已经包含/api，则移除baseUrl中的/api
  if (path.startsWith('/api/')) {
    return baseUrl.replace('/api', '') + path
  }
  // 如果path不以/开头，添加/
  if (!path.startsWith('/')) {
    path = '/' + path
  }
  return baseUrl + path
}

export default {
  getApiBaseUrl,
  getApiUrl
}
