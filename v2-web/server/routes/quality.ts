import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { getQueue, QueueNames } from '../queues/base';

// 1. 定义 Zod Schema (对标数据库 quality_rules 表)
export const qualityRuleSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  criteria: z.string().nullable(),
  score_weight: z.number(),
  is_active: z.number().or(z.boolean()), // 兼容 TinyInt
  created_at: z.date().or(z.string()),
});

export default async function qualityRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // --- 质检规则管理 ---

  // 获取所有规则 (带分类过滤)
  app.get('/api/quality/rules', {
    schema: {
      querystring: z.object({
        category: z.string().optional(),
        is_active: z.string().optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(qualityRuleSchema),
        }),
      },
    },
  }, async (request) => {
    const { category, is_active } = request.query;
    
    const where: any = {};
    if (category) where.category = category;
    if (is_active !== undefined) where.is_active = is_active === 'true' ? 1 : 0;

    const rules = await prisma.quality_rules.findMany({
      where,
      orderBy: { id: 'asc' }
    });

    return { 
      success: true, 
      data: rules.map(r => ({
        ...r,
        score_weight: Number(r.score_weight),
        is_active: !!r.is_active
      })) as any 
    };
  });

  // 切换规则状态 (启用/禁用)
  app.put('/api/quality/rules/:id/toggle', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ is_enabled: z.boolean() }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const { is_enabled } = request.body;

    await prisma.quality_rules.update({
      where: { id: Number(id) },
      data: { is_active: is_enabled ? 1 : 0 }
    });

    return { success: true };
  });

  // --- 会话质检核心 ---

  // 异步导入会话 (通过 BullMQ)
  app.post('/api/quality/sessions/import', async (request, reply) => {
    const data = await (request as any).body;
    
    const filePart = data.file;
    const platformId = Number(data.platform?.value);
    const shopId = Number(data.shop?.value);

    if (!filePart || !platformId || !shopId) {
      return reply.code(400).send({ success: false, message: 'Missing parameters' });
    }

    const buffer = await filePart.toBuffer();
    
    // 推入异步队列
    const queue = getQueue(QueueNames.IMPORT_QUALITY);
    const job = await queue.add('import-task', {
      fileBuffer: buffer.toString('base64'),
      platformId,
      shopId
    });

    return { success: true, jobId: job.id };
  });

  // 获取导入进度
  app.get('/api/quality/sessions/import/status/:jobId', async (request) => {
    const { jobId } = request.params as { jobId: string };
    const queue = getQueue(QueueNames.IMPORT_QUALITY);
    const job = await queue.getJob(jobId);

    if (!job) return { success: false, message: 'Job not found' };

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;

    return { success: true, state, progress, result };
  });
}
