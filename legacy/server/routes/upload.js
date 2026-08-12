const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const util = require('util');
const pump = util.promisify(pipeline);
const jwt = require('jsonwebtoken');
const { JWT_SECRET, oss } = require('../config');
const { formatFileUrl, extractRelativePath } = require('../utils/pathHelper');
const OSS = require('ali-oss');
const dayjs = require('dayjs');

async function uploadRoutes(fastify, options) {
  const uploadDir = fastify.uploadDir;
  
  let ossClient = null;
  if (oss && oss.accessKeyId && oss.accessKeySecret && oss.bucket) {
    try {
      const endpoint = oss.internal 
        ? `${oss.region}-internal.aliyuncs.com` 
        : `${oss.region}.aliyuncs.com`;

      ossClient = new OSS({
        region: oss.region,
        accessKeyId: oss.accessKeyId,
        accessKeySecret: oss.accessKeySecret,
        bucket: oss.bucket,
        secure: oss.secure,
        endpoint: oss.internal ? endpoint : undefined
      });
    } catch (err) {
      console.error('[Upload] OSS 引擎初始化失败');
    }
  }

  const generateRandomName = (originalName) => {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = dayjs().format('YYYYMMDDHHmmss');
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${randomStr}${ext}`;
  };

  const formatPublicUrl = (cloudPath) => {
    if (process.env.OSS_CUSTOM_DOMAIN && process.env.OSS_CUSTOM_DOMAIN.trim() !== '') {
      const domain = process.env.OSS_CUSTOM_DOMAIN.replace(/\/$/, '');
      const finalDomain = domain.startsWith('http') ? domain : `https://${domain}`;
      return `${finalDomain}/${cloudPath}`;
    }
    if (oss && oss.bucket && oss.region) {
      const protocol = oss.secure ? 'https' : 'http';
      return `${protocol}://${oss.bucket}.${oss.region}.aliyuncs.com/${cloudPath}`;
    }
    return `/uploads/${cloudPath}`;
  };

  async function authenticateRequest(request, reply) {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) return null;
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  fastify.post('/api/upload', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return reply.code(401).send({ success: false, message: '未登录' });

    try {
      const data = await request.file()
      if (!data) return reply.code(400).send({ success: false, message: '无文件' });

      const bizType = request.query.bizType || 'common';
      const randomFilename = generateRandomName(data.filename);
      const cloudPath = `${bizType}/${randomFilename}`; // 相对路径
      const buffer = await data.toBuffer();

      if (ossClient) {
        const options = {
          headers: { 'x-oss-object-acl': 'public-read' }
        };
        // 针对 PDF 强制注入 inline 元数据和正确的 MIME 类型
        // 按阿里云 OSS 官方示例使用标准头名，确保浏览器直接预览而不是下载
        if (data.filename.toLowerCase().endsWith('.pdf')) {
          options.headers['Content-Type'] = 'application/pdf';
          options.headers['Content-Disposition'] = 'inline';
        }
        await ossClient.put(cloudPath, buffer, options);
        return {
          success: true,
          url: formatPublicUrl(cloudPath), // 用于预览
          bizPath: cloudPath,              // 用于存库 (核心！)
          filename: data.filename
        }
      } else {
        const targetDir = path.join(uploadDir, bizType);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, randomFilename), buffer);
        const localPath = `${bizType}/${randomFilename}`;
        return {
          success: true,
          url: `/uploads/${localPath}`,
          bizPath: localPath, // 本地也返回相对路径
          filename: data.filename
        }
      }
    } catch (error) {
      console.error('[Upload] 单文件上传失败:', error);
      return reply.code(500).send({ success: false, message: error.message });
    }
  })

  fastify.post('/api/upload/multiple', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return reply.code(401).send({ success: false, message: '未登录' });

    try {
      const parts = request.parts()
      const uploadedFiles = []
      const bizType = request.query.bizType || 'common';

      for await (const part of parts) {
        if (part.file) {
          const randomFilename = generateRandomName(part.filename);
          const cloudPath = `${bizType}/${randomFilename}`;
          const buffer = await part.toBuffer();

          if (ossClient) {
            const options = {
              headers: { 'x-oss-object-acl': 'public-read' }
            };
            // 多文件上传同样按阿里云 OSS 官方示例设置 PDF 预览头
            if (part.filename.toLowerCase().endsWith('.pdf')) {
              options.headers['Content-Type'] = 'application/pdf';
              options.headers['Content-Disposition'] = 'inline';
            }
            await ossClient.put(cloudPath, buffer, options);
            uploadedFiles.push({ url: formatPublicUrl(cloudPath), bizPath: cloudPath, filename: part.filename });
          } else {
            const targetDir = path.join(uploadDir, bizType);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            fs.writeFileSync(path.join(targetDir, randomFilename), buffer);
            const localPath = `${bizType}/${randomFilename}`;
            uploadedFiles.push({ url: `/uploads/${localPath}`, bizPath: localPath, filename: part.filename });
          }
        }
      }
      return { success: true, files: uploadedFiles }
    } catch (error) {
      console.error('[Upload] 多文件上传失败:', error);
      return reply.code(500).send({ success: false, message: '批量处理失败' });
    }
  })

  fastify.get('/api/files/resolve', async (request, reply) => {
    const rawPath = request.query.path || request.query.url;
    if (!rawPath) {
      return reply.code(400).send({ success: false, message: '缺少文件路径' });
    }

    try {
      const resolvedUrl = formatFileUrl(String(rawPath), request);
      return { success: true, url: resolvedUrl };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  });

  fastify.get('/api/files/inline', async (request, reply) => {
    const rawPath = request.query.path || request.query.url;
    if (!rawPath) {
      return reply.code(400).send({ success: false, message: '缺少文件路径' });
    }

    try {
      const input = String(rawPath);
      const relativePath = extractRelativePath(input);
      const ext = path.extname(relativePath || input).toLowerCase();

      const contentTypeMap = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav'
      };

      const contentType = contentTypeMap[ext] || 'application/octet-stream';
      const filename = path.basename(relativePath || input) || 'file';

      reply.header('Cache-Control', 'no-store');
      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);

      if (ossClient && relativePath) {
        const result = await ossClient.getStream(relativePath);
        if (result?.res?.headers?.['content-length']) {
          reply.header('Content-Length', result.res.headers['content-length']);
        }
        return reply.send(result.stream);
      }

      if (relativePath && !input.startsWith('http://') && !input.startsWith('https://')) {
        const normalized = relativePath.replace(/^uploads\//, '');
        const localFilePath = path.join(uploadDir, normalized);
        if (fs.existsSync(localFilePath)) {
          return reply.send(fs.createReadStream(localFilePath));
        }
      }

      const resolvedUrl = formatFileUrl(input, request);
      return reply.redirect(resolvedUrl);
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = uploadRoutes;
