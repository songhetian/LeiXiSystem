/**
 * 路径自愈与路径脱壳工具 (旗舰版专用)
 */
const { oss } = require('../config');
const OSS = require('ali-oss');

// 初始化一个内部 OSS 客户端用于生成签名或验证
let ossClient = null;
if (oss && oss.accessKeyId && oss.accessKeySecret && oss.bucket) {
  try {
    ossClient = new OSS({
      region: oss.region,
      accessKeyId: oss.accessKeyId,
      accessKeySecret: oss.accessKeySecret,
      bucket: oss.bucket,
      secure: true
    });
  } catch (err) {
    console.error('[PathHelper] OSS 客户端初始化失败');
  }
}

/**
 * 格式化文件公开访问路径
 * 逻辑：自动判断 OSS 自定义域名、OSS 默认域名 或 本地存储路径
 */
const formatFileUrl = (rawPath, request = null) => {
  if (!rawPath) return '';
  
  // 1. 如果已经是完整路径，直接返回 (支持外部 URL、Base64 和 Blob)
  if (rawPath.startsWith('http') || rawPath.startsWith('data:') || rawPath.startsWith('blob:')) {
    // 特殊处理：如果是本地 localhost 的路径，且当前请求是通过 IP 访问的，进行自愈
    if (rawPath.includes('localhost:3001') && request?.headers?.host && !request.headers.host.includes('localhost')) {
      return rawPath.replace('localhost:3001', request.headers.host);
    }
    return rawPath;
  }

  // 2. 优先尝试从环境变量或配置中获取域名
  const customDomain = process.env.OSS_CUSTOM_DOMAIN?.trim().replace(/\/$/, '');
  const ossDomain = (oss && oss.bucket && oss.region) ? `https://${oss.bucket}.${oss.region}.aliyuncs.com` : '';
  
  // 清理路径中的 uploads/ 前缀，统一存库逻辑
  let cleanPath = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
  if (cleanPath.startsWith('uploads/')) {
    cleanPath = cleanPath.replace('uploads/', '');
  }

  // 3. 构建最终域名
  let baseDomain = customDomain || ossDomain;

  if (baseDomain) {
    // OSS 模式
    // 如果是私有桶，理论上需要签名，但为了性能和缓存，建议用户将 bucket 设为公共读
    // 这里返回公共访问地址
    return `${baseDomain}/${cleanPath}`;
  } else {
    // 本地模式
    const host = request?.headers?.host || 'localhost:3001';
    const protocol = request?.protocol || 'http';
    return `${protocol}://${host}/uploads/${cleanPath}`;
  }
};

/**
 * 批量脱壳并自愈用户对象中的路径字段
 */
const sanitizeUser = (user, request = null) => {
  if (!user) return null;
  const u = { ...user };
  const fields = ['avatar', 'id_card_front_url', 'id_card_back_url'];
  
  fields.forEach(f => {
    if (u[f]) {
      u[f] = formatFileUrl(u[f], request);
    }
  });
  
  // 敏感字段清理
  delete u.password_hash;
  return u;
};

/**
 * 从完整 URL 中提取相对路径 (用于存库)
 * 逻辑：去除 OSS 域名或本地域名部分
 */
const extractRelativePath = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  try {
    const customDomain = process.env.OSS_CUSTOM_DOMAIN?.trim().replace(/\/$/, '');
    const ossDomain = (oss && oss.bucket && oss.region) ? `https://${oss.bucket}.${oss.region}.aliyuncs.com` : '';
    
    let path = url;
    if (customDomain && url.includes(customDomain)) {
      path = url.split(customDomain).pop();
    } else if (ossDomain && url.includes(ossDomain)) {
      path = url.split(ossDomain).pop();
    } else if (url.includes('/uploads/')) {
      path = url.split('/uploads/').pop();
    } else if (url.startsWith('http')) {
      // 如果是其他外部域名，保留原样
      return url;
    }
    
    // 移除开头的斜杠
    return path.startsWith('/') ? path.substring(1) : path;
  } catch (e) {
    return url;
  }
};

/**
 * 处理 Base64 图片上传 (兼容老旧前端版本)
 */
const saveBase64Image = async (base64, bizType = 'avatar') => {
  if (!base64 || !base64.startsWith('data:image')) return base64;
  
  try {
    const fs = require('fs');
    const path = require('path');
    const { oss: ossConfig } = require('../config');
    const OSS = require('ali-oss');
    
    // 解析 Base64
    const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) throw new Error('Invalid base64 string');
    
    const type = matches[1];
    const extension = type.split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extension}`;
    const relativePath = `${bizType}/${filename}`;
    
    if (ossConfig && ossConfig.accessKeyId && ossConfig.bucket) {
      const client = new OSS({
        region: ossConfig.region,
        accessKeyId: ossConfig.accessKeyId,
        accessKeySecret: ossConfig.accessKeySecret,
        bucket: ossConfig.bucket,
        secure: true
      });
      await client.put(relativePath, buffer, {
        headers: { 'x-oss-object-acl': 'public-read' }
      });
      return relativePath;
    } else {
      // 本地存储
      const uploadDir = path.join(__dirname, '../../uploads', bizType);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      return relativePath;
    }
  } catch (err) {
    console.error('[PathHelper] Base64 upload failed:', err);
    return base64; // 失败则返回原串，虽然存库可能失败
  }
};

module.exports = {
  formatFileUrl,
  sanitizeUser,
  extractRelativePath,
  saveBase64Image
};
