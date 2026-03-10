const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const util = require('util');
const pump = util.promisify(pipeline);
const jwt = require('jsonwebtoken');
const { JWT_SECRET, oss } = require('../config');
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
        // 针对 PDF 强制注入 inline 元数据，否则 OSS 默认域名会强制下载
        if (data.filename.toLowerCase().endsWith('.pdf')) {
          options.headers['content-disposition'] = 'inline';
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
            // 🔴 关键修复：多文件上传也要强制注入 PDF inline 元数据
            if (part.filename.toLowerCase().endsWith('.pdf')) {
              options.headers['content-disposition'] = 'inline';
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
      return reply.code(500).send({ success: false, message: '批量处理失败' });
    }
  })
}

module.exports = uploadRoutes;
