import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { connection as redis } from '../lib/redis';

// 1. 定义班次响应 Schema (用于 Fastify 预编译序列化)
export const shiftResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  work_hours: z.number().nullable(),
  rest_duration: z.number().nullable(),
  late_threshold: z.number().nullable(),
  early_threshold: z.number().nullable(),
  color: z.string().nullable(),
  is_active: z.boolean(),
  department_id: z.number().nullable(),
  description: z.string().nullable(),
});

export default async function shiftRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取所有班次 (带 Redis 缓存优化)
  app.get('/api/attendance/shifts', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(shiftResponseSchema),
          from_cache: z.boolean().optional(),
        }),
      },
    },
  }, async () => {
    const CACHE_KEY = 'attendance:shifts:all';
    
    // 深度优化：尝试从 Redis 获取 (规约：优先高性能缓存)
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return { success: true, data: JSON.parse(cached), from_cache: true };
    }

    const shifts = await prisma.work_shifts.findMany({
      orderBy: { name: 'asc' }
    });

    const data = shifts.map(s => ({
      ...s,
      is_active: !!s.is_active,
      work_hours: Number(s.work_hours),
    }));

    // 写入缓存
    await redis.setex(CACHE_KEY, 3600, JSON.stringify(data));

    return { success: true, data: data as any };
  });

  // 创建/更新班次 (同时物理清理 Redis 缓存)
  app.post('/api/attendance/shifts', {
    schema: {
      body: z.object({
        name: z.string().min(1),
        start_time: z.string(),
        end_time: z.string(),
        color: z.string().optional(),
        late_threshold: z.number().default(0),
        early_threshold: z.number().default(0),
        is_active: z.boolean().default(true),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    const data = request.body;

    await prisma.work_shifts.create({
      data: {
        ...data,
        is_active: data.is_active ? 1 : 0,
        work_hours: 8 // 示例固定，实际应根据 start/end 计算
      }
    });

    // 规约：数据变更必须物理清理缓存
    await redis.del('attendance:shifts:all');

    return { success: true };
  });
}
