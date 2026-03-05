import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

// 1. 定义巅峰序列化 Schema
export const personalProfileSchema = z.object({
  id: z.number(),
  username: z.string(),
  real_name: z.string(),
  avatar: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  department_name: z.string().optional(),
  position_name: z.string().optional(),
  employee_no: z.string().optional(),
});

export const salarySlipSchema = z.object({
  id: z.number(),
  salary_month: z.date().or(z.string()),
  net_salary: z.number(),
  status: z.string(),
  basic_salary: z.number().optional(),
  performance_bonus: z.number().optional(),
  deductions: z.number().optional(),
});

export default async function personalRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取个人详细资料 (规约执行：AOT 序列化 + 逻辑闭环)
  app.get('/api/personal/profile', {
    schema: {
      response: {
        200: z.object({ success: z.boolean(), data: personalProfileSchema }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        departments: { select: { name: true } },
        employees: { 
          include: { positions: { select: { name: true } } }
        }
      }
    });

    if (!user) throw new Error('User data lost');

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        avatar: user.avatar,
        email: user.email,
        phone: user.phone,
        department_name: user.departments?.name,
        position_name: user.employees[0]?.positions?.name,
        employee_no: user.employees[0]?.employee_no,
      }
    };
  });

  // 获取个人薪资历史 (规约执行：财务存证闭环)
  app.get('/api/personal/salary', {
    schema: {
      response: {
        200: z.object({ success: z.boolean(), data: z.array(salarySlipSchema) }),
      },
    },
  }, async (request) => {
    const userId = (request as any).user?.id;
    const employee = await prisma.employees.findUnique({ where: { user_id: userId } });
    
    if (!employee) return { success: true, data: [] };

    const slips = await prisma.payslips.findMany({
      where: { employee_id: employee.id, status: 'confirmed' },
      orderBy: { salary_month: 'desc' }
    });

    return {
      success: true,
      data: slips.map(s => ({
        id: r.id,
        salary_month: s.salary_month,
        net_salary: Number(s.net_salary),
        status: s.status,
        basic_salary: Number(s.basic_salary),
        performance_bonus: Number(s.performance_bonus),
        deductions: Number(s.deductions),
      })) as any
    };
  });
}
