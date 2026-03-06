import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { getQueue, QueueNames } from '../queues/base';

// 1. 定义序列化 Schema
export const broadcastSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  type: z.string().nullable(),
  priority: z.string().nullable(),
  created_at: z.date().or(z.string()),
  creator_name: z.string().optional(),
  is_read: z.boolean().optional(),
});

export default async function broadcastRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 发布广播 (规约执行：身份认证闭环)
  app.post('/api/broadcasts', {
    schema: {
      body: z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        targetType: z.enum(['all', 'department', 'role', 'individual']),
        targetDepartments: z.array(z.number()).optional(),
        targetRoles: z.array(z.string()).optional(),
        targetUsers: z.array(z.number()).optional(),
        type: z.string().default('info'),
        priority: z.string().default('normal'),
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const body = request.body;

    const broadcast = await prisma.broadcasts.create({
      data: {
        title: body.title,
        content: body.content,
        type: body.type,
        priority: body.priority,
        target_type: body.targetType,
        target_departments: body.targetDepartments as any,
        target_roles: body.targetRoles as any,
        target_users: body.targetUsers as any,
        creator_id: userId,
      }
    });

    const queue = getQueue(QueueNames.BATCH_NOTIFY);
    const job = await queue.add('broadcast-distribute', {
      broadcastId: broadcast.id,
      ...body
    });

    return { success: true, broadcastId: broadcast.id, jobId: job.id };
  });

  // 获取收到的广播列表 (规约执行：身份认证闭环)
  app.get('/api/broadcasts/my', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(broadcastSchema),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const recipients = await prisma.broadcast_recipients.findMany({
      where: { user_id: userId },
      include: {
        broadcasts: {
          include: { users: true }
        }
      },
      orderBy: { broadcasts: { created_at: 'desc' } },
      take: 50
    });

    return {
      success: true,
      data: recipients.map(r => ({
        id: r.broadcasts.id,
        title: r.broadcasts.title,
        content: r.broadcasts.content,
        type: r.broadcasts.type,
        priority: r.broadcasts.priority,
        created_at: r.broadcasts.created_at,
        creator_name: r.broadcasts.users.real_name,
        is_read: !!r.is_read
      })) as any
    };
  });
}
