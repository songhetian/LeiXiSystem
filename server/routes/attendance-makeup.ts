import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

export default async function makeupRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. 提交补卡申请 (规约：事务原子性闭环)
  app.post('/api/attendance/makeup', {
    schema: {
      body: z.object({
        date: z.string(),
        clockType: z.enum(['check_in', 'check_out']),
        clockTime: z.string(),
        reason: z.string().min(1),
      }),
      response: { 200: z.object({ success: z.boolean(), id: z.number() }) }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const body = request.body;
    const employee = await prisma.employees.findUnique({ where: { user_id: userId } });
    if (!employee) throw new Error('Employee not found');

    const result = await prisma.makeup_records.create({
      data: {
        user_id: userId,
        employee_id: employee.id,
        record_date: new Date(body.date),
        clock_type: body.clockType as any,
        clock_time: new Date(body.clockTime),
        reason: body.reason,
        status: 'pending'
      }
    });

    return { success: true, id: result.id };
  });

  // 2. 审批补卡 (规约：物理更新打卡表)
  app.put('/api/attendance/makeup/:id/audit', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ action: z.enum(['approved', 'rejected']), notes: z.string().optional() })
    }
  }, async (request) => {
    const id = Number(request.params.id);
    const { action, notes } = request.body;

    await prisma.$transaction(async (tx) => {
      const makeup = await tx.makeup_records.update({
        where: { id },
        data: { status: action, approval_note: notes, approved_at: new Date() }
      });

      if (action === 'approved') {
        // 物理缝合：更新正式打卡记录
        await tx.attendance_records.upsert({
          where: { uk_user_date: { user_id: makeup.user_id, attendance_date: makeup.record_date } },
          update: makeup.clock_type === 'check_in' 
            ? { check_in_time: makeup.clock_time, status: 'normal' }
            : { check_out_time: makeup.clock_time, status: 'normal' },
          create: {
            user_id: makeup.user_id,
            employee_id: makeup.employee_id,
            attendance_date: makeup.record_date,
            record_date: makeup.record_date,
            check_in_time: makeup.clock_type === 'check_in' ? makeup.clock_time : null,
            check_out_time: makeup.clock_type === 'check_out' ? makeup.clock_time : null,
            status: 'normal'
          }
        });
      }
    });

    return { success: true };
  });
}
