import { getFileUrl } from './apiConfig';

/**
 * 旗舰版文件路径解析工具
 * 核心逻辑：直接透传给 apiConfig 中的 getFileUrl，确保 OSS 与本地路径逻辑统一。
 */
export const getImageUrl = (url, options = {}) => {
  return getFileUrl(url);
};

export const getAttachmentUrl = (url) => {
  return getFileUrl(url);
};

export default {
  getImageUrl,
  getAttachmentUrl
};

