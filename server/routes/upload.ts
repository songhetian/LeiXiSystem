import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../lib/config';

export default async function uploadRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post('/api/upload', {
    schema: {
      querystring: z.object({
        bizType: z.string().optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          bizPath: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ success: false, message: 'No file uploaded' });
    }

    const bizType = request.query.bizType || 'common';
    const uploadRoot = path.resolve(process.cwd(), config.storage.local.path);
    const targetDir = path.join(uploadRoot, bizType);
    await mkdir(targetDir, { recursive: true });

    const ext = path.extname(file.filename || '') || '.bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const targetPath = path.join(targetDir, filename);
    const buffer = await file.toBuffer();
    await writeFile(targetPath, buffer);

    return { success: true, bizPath: `/uploads/${bizType}/${filename}` };
  });

  app.get('/uploads/*', async (request, reply) => {
    const wildcardPath = (request.params as { '*': string })['*'];
    const filePath = path.join(path.resolve(process.cwd(), config.storage.local.path), wildcardPath);
    const buffer = await readFile(filePath);
    return reply.send(buffer);
  });
}
