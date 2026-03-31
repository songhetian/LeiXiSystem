import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { getQueue, QueueNames } from '../queues/base';
import dayjs from 'dayjs';

export default async function attendanceRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/api/attendance/my-records', {
    schema: {
      querystring: z.object({
        month: z.string().optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.any()),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, data: [] });

    const month = request.query.month;
    const monthStart = month ? dayjs(month).startOf('month').toDate() : dayjs().startOf('month').toDate();
    const monthEnd = month ? dayjs(month).endOf('month').toDate() : dayjs().endOf('month').toDate();

    const records = await prisma.attendance_records.findMany({
      where: {
        user_id: userId,
        attendance_date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { attendance_date: 'desc' },
    });

    return { success: true, data: records as any };
  });

  app.post('/api/attendance/stats/export', {
    schema: {
      body: z.object({
        dateRange: z.array(z.string()),
        departmentId: z.number().optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          jobId: z.string(),
        }),
      },
    },
  }, async (request) => {
    const queue = getQueue(QueueNames.EXPORT_REPORT);
    const job = await queue.add('attendance-export', request.body);
    return { success: true, jobId: job.id as string };
  });

  // 2. 高级排班管理 (规约执行：请假冲突对冲闭环)
  app.post('/api/attendance/schedules', {
    schema: {
      body: z.object({
        employeeId: z.number(),
        shiftId: z.number(),
        date: z.string(),
      }),
      response: { 200: z.object({ success: z.boolean(), message: z.string() }) },
    },
  }, async (request, reply) => {
    const { employeeId, shiftId, date } = request.body;
    const scheduleDate = dayjs(date).startOf('day').toDate();

    // --- 核心审计点：请假对冲逻辑 ---
    const leaveExists = await prisma.leave_records.findFirst({
      where: {
        employee_id: employeeId,
        status: 'approved',
        start_date: { lte: scheduleDate },
        end_date: { gte: scheduleDate }
      }
    });

    if (leaveExists) {
      return reply.code(400).send({ 
        success: false, 
        message: `逻辑冲突：该员工在 ${date} 已有生效请假单，无法进行物理排班` 
      });
    }

    await prisma.shift_schedules.upsert({
      where: { 
        // 需确保 prisma.schema 中定义了此复合唯一索引
        employee_id_schedule_date: { employee_id: employeeId, schedule_date: scheduleDate } 
      },
      update: { shift_id: shiftId, is_rest_day: false },
      create: { employee_id: employeeId, shift_id: shiftId, schedule_date: scheduleDate, is_rest_day: false }
    });

    return { success: true, message: '排班成功，已通过请假冲突审计' };
  });

  // 3. 智能打卡判定算法 (规约执行：100% 对齐班次阈值)
  app.post('/api/attendance/clock', {
    schema: {
      body: z.object({
        type: z.enum(['check_in', 'check_out']),
        location: z.string().optional(),
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const now = new Date();
    const today = dayjs().startOf('day').toDate();

    // 1. 获取该用户今天的班次信息
    const schedule = await prisma.shift_schedules.findFirst({
      where: { users: { id: userId }, schedule_date: today },
      include: { work_shifts: true }
    });

    if (!schedule || !schedule.work_shifts) {
      return reply.code(400).send({ success: false, message: '今日未排班，无需打卡' });
    }

    const shift = schedule.work_shifts;
    let status = 'normal';

    // 2. 逻辑闭环：物理计算迟到/早退
    if (request.body.type === 'check_in') {
      const shiftStartTime = dayjs(today).format('YYYY-MM-DD') + ' ' + shift.start_time;
      const lateThreshold = dayjs(shiftStartTime).add(Number(shift.late_threshold || 0), 'minute');
      
      if (dayjs(now).isAfter(lateThreshold)) {
        status = 'late';
      }
    } else {
      const shiftEndTime = dayjs(today).format('YYYY-MM-DD') + ' ' + shift.end_time;
      const earlyThreshold = dayjs(shiftEndTime).subtract(Number(shift.early_threshold || 0), 'minute');
      
      if (dayjs(now).isBefore(earlyThreshold)) {
        status = 'early';
      }
    }

    // 3. 写入存证 (逻辑闭环)
    const record = await prisma.attendance_records.upsert({
      where: { uk_user_date: { user_id: userId, attendance_date: today } },
      update: request.body.type === 'check_in' 
        ? { check_in_time: now, status: status as any } 
        : { check_out_time: now, status: status as any },
      create: {
        user_id: userId,
        employee_id: schedule.employee_id,
        attendance_date: today,
        record_date: today,
        check_in_time: request.body.type === 'check_in' ? now : null,
        check_out_time: request.body.type === 'check_out' ? now : null,
        status: status as any
      }
    });

    return { 
      success: true, 
      message: `打卡成功 [${status === 'normal' ? '正常' : '异常标记'}]: ${dayjs(now).format('HH:mm:ss')}` 
    };
  });
}
