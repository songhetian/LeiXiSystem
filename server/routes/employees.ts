import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';

export default async function employeeRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/api/employees', {
    schema: {
      querystring: z.object({
        keyword: z.string().optional(),
        department_id: z.string().optional(),
        position: z.string().optional(),
        status: z.string().optional(),
      }),
      response: {
        200: z.array(z.any()),
      },
    },
  }, async (request) => {
    const rows = await prisma.employees.findMany({
      where: {
        status: request.query.status ? request.query.status as any : undefined,
        position_id: undefined,
        users: {
          department_id: request.query.department_id ? Number(request.query.department_id) : undefined,
          real_name: request.query.keyword ? { contains: request.query.keyword } : undefined,
        },
      },
      include: {
        users: { include: { departments: true } },
        positions: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return rows
      .filter((row) => !request.query.position || row.positions?.name === request.query.position)
      .map((row) => ({
        id: row.id,
        user_id: row.user_id,
        employee_no: row.employee_no,
        real_name: row.users.real_name,
        username: row.users.username,
        email: row.users.email,
        phone: row.users.phone,
        department_id: row.users.department_id,
        department_name: row.users.departments?.name,
        position_name: row.positions?.name,
        status: row.status,
        hire_date: row.hire_date,
        rating: row.rating ? 5 : 0,
        avatar: row.users.avatar,
        is_department_manager: row.users.is_department_manager,
      })) as any;
  });

  app.post('/api/employees', {
    schema: {
      body: z.object({
        real_name: z.string().min(1),
        username: z.string().min(1).optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        department_id: z.number().optional(),
        position_id: z.number().optional(),
        hire_date: z.string().optional(),
        status: z.string().optional(),
        employee_no: z.string().optional(),
        password: z.string().optional(),
      }),
      response: {
        200: z.object({ success: z.boolean(), id: z.number() }),
      },
    },
  }, async (request) => {
    const body = request.body;
    const username = body.username || `user_${Date.now()}`;
    const passwordHash = await bcrypt.hash(body.password || '123456', 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          username,
          real_name: body.real_name,
          email: body.email || null,
          phone: body.phone || null,
          password_hash: passwordHash,
          department_id: body.department_id || null,
          status: (body.status || 'active') as any,
        },
      });

      const employee = await tx.employees.create({
        data: {
          user_id: user.id,
          employee_no: body.employee_no || `EMP${String(user.id).padStart(6, '0')}`,
          hire_date: body.hire_date ? new Date(body.hire_date) : new Date(),
          position_id: body.position_id || null,
          status: (body.status || 'active') as any,
        },
      });

      return employee;
    });

    return { success: true, id: result.id };
  });

  app.put('/api/employees/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        real_name: z.string().optional(),
        username: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        department_id: z.number().nullable().optional(),
        position_id: z.number().nullable().optional(),
        hire_date: z.string().optional(),
        status: z.string().optional(),
        employee_no: z.string().optional(),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    const employeeId = Number(request.params.id);
    const existing = await prisma.employees.findUnique({
      where: { id: employeeId },
      select: { user_id: true },
    });

    if (!existing) {
      throw new Error('Employee not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: existing.user_id },
        data: {
          ...(request.body.real_name !== undefined ? { real_name: request.body.real_name } : {}),
          ...(request.body.username !== undefined ? { username: request.body.username } : {}),
          ...(request.body.email !== undefined ? { email: request.body.email || null } : {}),
          ...(request.body.phone !== undefined ? { phone: request.body.phone || null } : {}),
          ...(request.body.department_id !== undefined ? { department_id: request.body.department_id } : {}),
          ...(request.body.status !== undefined ? { status: request.body.status as any } : {}),
        },
      });

      await tx.employees.update({
        where: { id: employeeId },
        data: {
          ...(request.body.employee_no !== undefined ? { employee_no: request.body.employee_no } : {}),
          ...(request.body.position_id !== undefined ? { position_id: request.body.position_id } : {}),
          ...(request.body.hire_date !== undefined ? { hire_date: new Date(request.body.hire_date) } : {}),
          ...(request.body.status !== undefined ? { status: request.body.status as any } : {}),
        },
      });
    });

    return { success: true };
  });

  app.delete('/api/employees/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    const employeeId = Number(request.params.id);
    const existing = await prisma.employees.findUnique({
      where: { id: employeeId },
      select: { user_id: true },
    });

    if (!existing) {
      return { success: true };
    }

    await prisma.users.delete({
      where: { id: existing.user_id },
    });

    return { success: true };
  });

  app.put('/api/users/:id/department-manager', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        isDepartmentManager: z.boolean(),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    await prisma.users.update({
      where: { id: Number(request.params.id) },
      data: { is_department_manager: request.body.isDepartmentManager },
    });

    return { success: true };
  });
}
