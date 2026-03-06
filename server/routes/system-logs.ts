import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

export const operationLogSchema = z.object({
  id: z.number().or(z.bigint()).transform(val => Number(val)),
  user_id: z.number().nullable(),
  username: z.string().nullable(),
  real_name: z.string().nullable(),
  module: z.string(),
  action: z.string(),
  status: z.boolean(),
  ip: z.string().nullable(),
  created_at: z.date().or(z.string()),
});

export default async function systemLogRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/api/admin/logs', {
    schema: {
      querystring: z.object({
        module: z.string().optional(),
        keyword: z.string().optional(),
        status: z.string().optional(),
        limit: z.string().optional().default('20'),
        page: z.string().optional().default('1'),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(operationLogSchema),
          total: z.number(),
        }),
      },
    },
  }, async (request) => {
    const { module, keyword, status, limit, page } = request.query;
    const l = parseInt(limit);
    const p = parseInt(page);

    const where: any = {
      module: module || undefined,
      status: status === 'true' ? true : status === 'false' ? false : undefined,
      OR: keyword ? [
        { real_name: { contains: keyword } },
        { action: { contains: keyword } }
      ] : undefined
    };

    // 规约执行：使用 select 代替 include，实现物理级查询减负
    const [total, logs] = await Promise.all([
      prisma.operation_logs.count({ where }),
      prisma.operation_logs.findMany({
        where,
        select: {
          id: true,
          user_id: true,
          username: true,
          real_name: true,
          module: true,
          action: true,
          status: true,
          ip: true,
          created_at: true,
          // 物理排除：params (可能很大)、user_agent、method、url、error_msg 等非列表必需字段
        },
        orderBy: { id: 'desc' },
        skip: (p - 1) * l,
        take: l,
      })
    ]);

    return { success: true, data: logs as any, total };
  });
}
