/**
 * 将相对路径转换为完整的文件访问 URL
 * 兼容 OSS 和本地开发服务器
 */
export const getFileUrl = (path: string | undefined | null): string => {
  if (!path) return '';

  let finalPath = path;

  // 1. 如果是完整 URL，检查是否指向旧的本地服务器
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (path.includes('localhost:') || path.includes('127.0.0.1:')) {
      try {
        const url = new URL(path);
        finalPath = url.pathname;
      } catch (e) {
        finalPath = path.substring(path.indexOf('/', 8));
      }
    } else {
      return path;
    }
  } else if (path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  // 确保路径以 / 开头
  let cleanPath = finalPath.startsWith('/') ? finalPath : '/' + finalPath;

  // 2. 获取 OSS 配置 (从环境变量或 localStorage)
  let ossBucket = import.meta.env.VITE_OSS_BUCKET;
  let ossRegion = import.meta.env.VITE_OSS_REGION;
  let ossDomain = import.meta.env.VITE_OSS_CUSTOM_DOMAIN;

  try {
    const savedConfig = localStorage.getItem('runtime_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      ossBucket = config.ossBucket || ossBucket;
      ossRegion = config.ossRegion || ossRegion;
      ossDomain = config.ossDomain || ossDomain;
    }
  } catch (e) {}

  const isValid = (val: any) => val && val !== 'undefined' && val !== 'null';

  if (isValid(ossBucket) && isValid(ossRegion)) {
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
  const hostname = window.location.hostname;
  const port = window.location.port;
  const wsBase = port === '5174' ? `http://${hostname}:3001` : window.location.origin;

  if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('/api/')) {
    cleanPath = '/uploads' + cleanPath;
  }

  return `${wsBase}${cleanPath}`;
};

export const getImageUrl = (url: string | undefined | null) => getFileUrl(url);
export const getAttachmentUrl = (url: string | undefined | null) => getFileUrl(url);
