const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const util = require('util');
const pump = util.promisify(pipeline);

async function uploadRoutes(fastify, options) {
  const uploadDir = fastify.uploadDir;

  // 单个文件上传
  fastify.post('/api/upload', async (request, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.code(400).send({ error: '没有上传文件' })
      }

      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const ext = path.extname(data.filename)
      const filename = `${timestamp}-${randomStr}${ext}`
      const filepath = path.join(uploadDir, filename)

      await pump(data.file, fs.createWriteStream(filepath))

      const fileUrl = `/uploads/${filename}`;

      return {
        success: true,
        url: fileUrl,
        filename: data.filename,
        size: fs.statSync(filepath).size
      }
    } catch (error) {
      console.error('文件上传失败:', error)
      return reply.code(500).send({ error: '文件上传失败' })
    }
  })

  // 批量文件上传
  fastify.post('/api/upload/multiple', async (request, reply) => {
    try {
      const parts = request.parts()
      const uploadedFiles = []

      for await (const part of parts) {
        if (part.file) {
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(7)
          const ext = path.extname(part.filename)
          const filename = `${timestamp}-${randomStr}${ext}`
          const filepath = path.join(uploadDir, filename)

          await pump(part.file, fs.createWriteStream(filepath))

          uploadedFiles.push({
            url: `/uploads/${filename}`,
            filename: part.filename,
            size: fs.statSync(filepath).size
          })
        }
      }

      return {
        success: true,
        files: uploadedFiles
      }
    } catch (error) {
      console.error('批量上传失败:', error)
      return reply.code(500).send({ error: '批量上传失败' })
    }
  })
}

module.exports = uploadRoutes;