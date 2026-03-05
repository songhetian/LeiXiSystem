import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

// 1. 定义变动记录响应 Schema (巅峰优化：强制 AOT 序列化)
export const employeeChangeSchema = z.object({
  id: z.number().or(z.bigint()).transform(val => Number(val)),
  employee_id: z.number(),
  user_id: z.number(),
  change_type: z.enum(['hire', 'transfer', 'promotion', 'resign', 'other']),
  change_date: z.date().or(z.string()).transform(val => typeof val === 'string' ? val : val.toISOString()),
  old_department_name: z.string().nullable(),
  new_department_name: z.string().nullable(),
  old_position_name: z.string().nullable(),
  new_position_name: z.string().nullable(),
  real_name: z.string().optional(),
  employee_no: z.string().optional(),
  reason: z.string().nullable(),
  created_at: z.date().or(z.string()),
});

export default async function hrChangeRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取全量变动记录 (规约：执行全链路类型安全 Prisma API)
  app.get('/api/hr/changes', {
    schema: {
      querystring: z.object({
        type: z.string().optional(),
        limit: z.string().optional().default('20'),
        page: z.string().optional().default('1'),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(employeeChangeSchema),
          total: z.number(),
        }),
      },
    },
  }, async (request) => {
    const { type, limit, page } = request.query;
    const l = parseInt(limit);
    const p = parseInt(page);

    const where: any = {};
    if (type && type !== 'all') {
      where.change_type = type;
    }

    // 物理还原：使用 Prisma Fluent API 代替原生 SQL
    const [total, changes] = await Promise.all([
      prisma.employee_changes.count({ where }),
      prisma.employee_changes.findMany({
        where,
        include: {
          users: { select: { real_name: true } },
          employees: { select: { employee_no: true } },
          // 注意：此处关联名需根据 prisma.schema 中的定义确定
          departments_employee_status_records_old_department_idTodepartments: { select: { name: true } },
          departments_employee_status_records_new_department_idTodepartments: { select: { name: true } },
          // 职位关联
          positions_employee_changes_old_position_idTopositions: { select: { name: true } },
          positions_employee_changes_new_position_idTopositions: { select: { name: true } }
        },
        orderBy: [{ change_date: 'desc' }, { id: 'desc' }],
        skip: (p - 1) * l,
        take: l,
      })
    ]);

    // 应用层扁平化处理 (规约：确保 Schema 序列化性能)
    const formattedData = changes.map(ec => ({
      ...ec,
      real_name: ec.users?.real_name,
      employee_no: ec.employees?.employee_no,
      old_department_name: (ec as any).departments_employee_status_records_old_department_idTodepartments?.name,
      new_department_name: (ec as any).departments_employee_status_records_new_department_idTodepartments?.name,
      old_position_name: (ec as any).positions_employee_changes_old_position_idTopositions?.name,
      new_position_name: (ec as any).positions_employee_changes_new_position_idTopositions?.name,
    }));

    return { 
      success: true, 
      data: formattedData as any, 
      total 
    };
  });

  app.post('/api/hr/changes', {
    schema: {
      body: z.object({
        employee_id: z.number(),
        change_type: z.enum(['transfer', 'promotion', 'resign', 'other']),
        change_date: z.string(),
        new_department_id: z.number().optional(),
        new_position_id: z.number().optional(),
        reason: z.string().optional(),
      }),
      response: {
        200: z.object({ success: z.boolean(), id: z.number() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body;
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const employee = await prisma.employees.findUnique({
      where: { id: data.employee_id },
      include: { users: true }
    });

    if (!employee) throw new Error('Employee not found');

    const result = await prisma.employee_changes.create({
      data: {
        employee_id: data.employee_id,
        user_id: employee.user_id,
        change_type: data.change_type,
        change_date: new Date(data.change_date),
        old_department_id: employee.users.department_id,
        new_department_id: data.new_department_id || employee.users.department_id,
        old_position_id: employee.position_id,
        new_position_id: data.new_position_id || employee.position_id,
        reason: data.reason || '手动补录',
        created_by: userId
      }
    });

    return { success: true, id: Number(result.id) };
  });
}
