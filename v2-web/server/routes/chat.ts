import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { connection as redis } from '../lib/redis';

// 1. 定义消息序列化 Schema (巅峰性能)
export const chatMessageSchema = z.object({
  id: z.number().or(z.bigint()).transform(val => Number(val)),
  sender_id: z.number(),
  group_id: z.number().nullable(),
  receiver_id: z.number().nullable(),
  content: z.string().nullable(),
  msg_type: z.string().default('text'),
  file_url: z.string().nullable(),
  created_at: z.date().or(z.string()),
  sender_name: z.string().optional(),
  sender_avatar: z.string().optional(),
});

export default async function chatRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取群组历史消息 (带缓存优先逻辑)
  app.get('/api/chat/groups/:id/messages', {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({
        beforeId: z.string().optional(),
        limit: z.string().optional().default('50'),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(chatMessageSchema),
        }),
      },
    },
  }, async (request) => {
    const groupId = Number(request.params.id);
    const limit = parseInt(request.query.limit);
    const beforeId = request.query.beforeId ? Number(request.query.beforeId) : undefined;

    // 1. 物理还原：尝试从 Redis List 获取最近消息
    if (!beforeId) {
      const cached = await redis.lrange(`chat:group:${groupId}:recent_messages`, 0, limit - 1);
      if (cached.length > 0) {
        return { success: true, data: cached.map(m => JSON.parse(m)) };
      }
    }

    // 2. 数据库兜底查询 (Prisma Fluent API)
    const messages = await prisma.chat_messages.findMany({
      where: {
        group_id: groupId,
        id: beforeId ? { lt: beforeId } : undefined,
      },
      include: {
        users_chat_messages_sender_idTousers: {
          select: { real_name: true, avatar: true }
        }
      },
      orderBy: { id: 'desc' },
      take: limit,
    });

    const formatted = messages.map(m => ({
      ...m,
      sender_name: m.users_chat_messages_sender_idTousers.real_name,
      sender_avatar: m.users_chat_messages_sender_idTousers.avatar,
    }));

    return { success: true, data: formatted as any };
  });

  // 获取用户群组列表 (带未读数闭环)
  app.get('/api/chat/groups', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            id: z.number(),
            name: z.string(),
            avatar: z.string().nullable(),
            unread_count: z.number(),
            last_msg: z.any().optional(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const memberships = await prisma.chat_group_members.findMany({
      where: { user_id: userId },
      include: {
        chat_groups: true
      }
    });

    // 物理还原：从 Redis 获取实时未读数 (HGETALL)
    const unreadMap = await redis.hgetall(`chat:unread:${userId}`);

    const data = await Promise.all(memberships.map(async (m) => {
      const lastMsgStr = await redis.get(`chat:group:${m.group_id}:last_msg`);
      return {
        id: m.chat_groups.id,
        name: m.chat_groups.name,
        avatar: m.chat_groups.avatar,
        unread_count: Number(unreadMap[m.group_id] || 0),
        last_msg: lastMsgStr ? JSON.parse(lastMsgStr) : null,
      };
    }));

    return { success: true, data };
  });
}
