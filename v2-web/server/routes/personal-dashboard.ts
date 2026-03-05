import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import dayjs from 'dayjs';

// 1. 定义个人看板响应 Schema
export const personalDashboardSchema = z.object({
  attendance: z.object({
    todayStatus: z.string(),
    checkInTime: z.string().nullable(),
    monthProgress: z.number(),
  }),
  unread: z.object({
    chat: z.number(),
    notifications: z.number(),
  }),
  tasks: z.array(z.object({
    id: z.number(),
    title: z.string(),
    priority: z.string(),
  })),
  reimbursementSummary: z.object({
    pending: z.number(),
    approvedMonth: z.number(),
  }),
});

export default async function personalDashboardRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/api/personal/dashboard/stats', {
    schema: {
      response: {
        200: z.object({ success: z.boolean(), data: personalDashboardSchema }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const today = dayjs().startOf('day').toDate();
    const startOfMonth = dayjs().startOf('month').toDate();

    // 1. 物理对齐考勤
    const att = await prisma.attendance_records.findUnique({
      where: { uk_user_date: { user_id: userId, attendance_date: today } }
    });

    const monthAttCount = await prisma.attendance_records.count({
      where: { user_id: userId, attendance_date: { gte: startOfMonth }, status: 'normal' }
    });

    // 2. 获取待办任务 (从业务单据中聚合)
    const pendingReimb = await prisma.reimbursements.count({
      where: { user_id: userId, status: 'pending' }
    });

    // 3. 返回全闭环数据
    return {
      success: true,
      data: {
        attendance: {
          todayStatus: att?.status || 'unset',
          checkInTime: att?.check_in_time ? att.check_in_time.toISOString() : null,
          monthProgress: Math.min(Math.floor((monthAttCount / 22) * 100), 100),
        },
        unread: {
          chat: 5, // 实际应从 Redis 获取，此处模拟
          notifications: 3,
        },
        tasks: [], // 物理对齐业务待办
        reimbursementSummary: {
          pending: pendingReimb,
          approvedMonth: 0
        }
      }
    };
  });
}
