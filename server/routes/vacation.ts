import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

// 1. 定义巅峰序列化 Schema
export const vacationBalanceSchema = z.object({
  id: z.number(),
  year: z.number(),
  annual_leave_total: z.number().transform(Number),
  annual_leave_used: z.number().transform(Number),
  sick_leave_total: z.number().transform(Number),
  sick_leave_used: z.number().transform(Number),
  compensatory_leave_total: z.number().transform(Number),
  compensatory_leave_used: z.number().transform(Number),
  real_name: z.string().optional(),
  employee_no: z.string().optional(),
  department_name: z.string().optional(),
});

export default async function vacationRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取个人假期余额 (规约：AOT 序列化 + 身份闭环)
  app.get('/api/vacation/my-balance', {
    schema: {
      querystring: z.object({ year: z.string().optional() }),
      response: {
        200: z.object({ success: z.boolean(), data: vacationBalanceSchema.nullable() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const year = request.query.year ? parseInt(request.query.year) : new Date().getFullYear();

    const balance = await prisma.vacation_balances.findFirst({
      where: { user_id: userId, year },
      include: { users: { select: { real_name: true } } }
    });

    return { 
      success: true, 
      data: balance ? {
        ...balance,
        real_name: balance.users.real_name,
        annual_leave_total: Number(balance.annual_leave_total),
        annual_leave_used: Number(balance.annual_leave_used),
        sick_leave_total: Number(balance.sick_leave_total),
        sick_leave_used: Number(balance.sick_leave_used),
        compensatory_leave_total: Number(balance.compensatory_leave_total),
        compensatory_leave_used: Number(balance.compensatory_leave_used),
      } : null 
    };
  });

  // 获取全员余额列表 (HR 规约：全铺满自适应查询)
  app.get('/api/vacation/balances', {
    schema: {
      querystring: z.object({
        department_id: z.string().optional(),
        search: z.string().optional(),
        year: z.string().optional().default('2026'),
        page: z.string().optional().default('1'),
      }),
      response: {
        200: z.object({ success: z.boolean(), data: z.array(vacationBalanceSchema), total: z.number() }),
      },
    },
  }, async (request) => {
    const { department_id, search, year, page } = request.query;
    const p = parseInt(page);
    const y = parseInt(year);

    const where: any = {
      year: y,
      users: {
        department_id: department_id ? Number(department_id) : undefined,
        OR: search ? [
          { real_name: { contains: search } },
          { username: { contains: search } }
        ] : undefined
      }
    };

    const [total, list] = await Promise.all([
      prisma.vacation_balances.count({ where }),
      prisma.vacation_balances.findMany({
        where,
        include: {
          users: { 
            include: { 
              departments: { select: { name: true } },
              employees: { select: { employee_no: true } }
            } 
          }
        },
        orderBy: { id: 'desc' },
        skip: (p - 1) * 20,
        take: 20
      })
    ]);

    const data = list.map(b => ({
      ...b,
      real_name: b.users.real_name,
      employee_no: b.users.employees[0]?.employee_no,
      department_name: b.users.departments?.name,
      annual_leave_total: Number(b.annual_leave_total),
      annual_leave_used: Number(b.annual_leave_used),
      sick_leave_total: Number(b.sick_leave_total),
      sick_leave_used: Number(b.sick_leave_used),
      compensatory_leave_total: Number(b.compensatory_leave_total),
      compensatory_leave_used: Number(b.compensatory_leave_used),
    }));

    return { success: true, data: data as any, total };
  });

  // 调整余额 (规约执行：事务闭环 + 审计存证)
  app.post('/api/vacation/adjust', {
    schema: {
      body: z.object({
        balanceId: z.number(),
        annual: z.number().optional(),
        sick: z.number().optional(),
        compensatory: z.number().optional(),
        reason: z.string(),
      }),
    },
  }, async (request) => {
    const userId = (request as any).user?.id || 1;
    const body = request.body;

    return await prisma.$transaction(async (tx) => {
      const oldBalance = await tx.vacation_balances.findUnique({ where: { id: body.balanceId } });
      if (!oldBalance) throw new Error('Balance record not found');

      const updated = await tx.vacation_balances.update({
        where: { id: body.balanceId },
        data: {
          annual_leave_total: body.annual ?? oldBalance.annual_leave_total,
          sick_leave_total: body.sick ?? oldBalance.sick_leave_total,
          compensatory_leave_total: body.compensatory ?? oldBalance.compensatory_leave_total,
        }
      });

      // 规约执行：任务日志物理闭环
      await tx.async_task_logs.create({
        data: {
          job_id: `VAC-ADJ-${body.balanceId}-${Date.now()}`,
          queue_name: 'vacation',
          task_type: 'balance-adjust',
          status: 'completed',
          operator_id: userId,
          payload: body as any,
          completed_at: new Date()
        }
      });

      return { success: true, data: updated };
    });
  });
}
