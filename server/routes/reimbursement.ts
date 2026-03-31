import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import dayjs from 'dayjs';

// 1. 定义巅峰序列化 Schema (支持嵌套 AOT 编译)
export const reimbursementItemSchema = z.object({
  id: z.number(),
  item_type: z.string(),
  amount: z.number().transform(val => Number(val)),
  expense_date: z.date().or(z.string()),
  description: z.string().nullable(),
  attachment_url: z.string().nullable(),
});

export const reimbursementSchema = z.object({
  id: z.number(),
  reimbursement_no: z.string(),
  applicant_name: z.string().optional(),
  department_name: z.string().optional(),
  title: z.string(),
  total_amount: z.number().transform(val => Number(val)),
  type: z.string(),
  status: z.string(),
  created_at: z.date().or(z.string()),
  items: z.array(reimbursementItemSchema).optional(),
});

export default async function reimbursementRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/api/reimbursement/types', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            id: z.number(),
            name: z.string(),
            code: z.string().nullable(),
          })),
        }),
      },
    },
  }, async () => {
    const types = await prisma.reimbursement_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, code: true },
    });

    return { success: true, data: types };
  });

  // 获取报销列表 (规约执行：全铺满数据自适应 + 巅峰序列化)
  app.get('/api/reimbursement/list', {
    schema: {
      querystring: z.object({
        status: z.string().optional(),
        keyword: z.string().optional(),
        limit: z.string().optional().default('10'),
        page: z.string().optional().default('1'),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(reimbursementSchema),
          total: z.number(),
        }),
      },
    },
  }, async (request) => {
    const { status, keyword, limit, page } = request.query;
    const l = parseInt(limit);
    const p = parseInt(page);
    const userId = (request as any).user?.id;

    const where: any = {
      user_id: userId,
      status: status && status !== 'all' ? status : undefined,
      OR: keyword ? [
        { title: { contains: keyword } },
        { reimbursement_no: { contains: keyword } }
      ] : undefined
    };

    const [total, list] = await Promise.all([
      prisma.reimbursements.count({ where }),
      prisma.reimbursements.findMany({
        where,
        include: {
          users: { select: { real_name: true } },
          departments: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
    ]);

    const data = list.map(r => ({
      ...r,
      applicant_name: r.users?.real_name,
      department_name: r.departments?.name,
      total_amount: Number(r.total_amount),
    }));

    return { success: true, data: data as any, total };
  });

  // 获取报销详情 (规约执行：深度序列化)
  app.get('/api/reimbursement/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: reimbursementSchema,
        }),
      },
    },
  }, async (request) => {
    const id = Number(request.params.id);
    const r = await prisma.reimbursements.findUnique({
      where: { id },
      include: {
        users: { select: { real_name: true } },
        departments: { select: { name: true } },
        reimbursement_items: true
      }
    });

    if (!r) throw new Error('Not Found');

    return {
      success: true,
      data: {
        ...r,
        applicant_name: r.users?.real_name,
        department_name: r.departments?.name,
        total_amount: Number(r.total_amount),
        items: r.reimbursement_items.map(i => ({
          ...i,
          amount: Number(i.amount)
        }))
      } as any
    };
  });

  // 审批报销 (规约执行：事务原子性与存证闭环)
  app.put('/api/reimbursement/:id/audit', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ action: z.enum(['approved', 'rejected']), notes: z.string().optional() }),
      response: { 200: z.object({ success: z.boolean() }) },
    },
  }, async (request) => {
    const id = Number(request.params.id);
    const { action, notes } = request.body;
    const auditorId = (request as any).user?.id;

    await prisma.$transaction(async (tx) => {
      await tx.reimbursements.update({
        where: { id },
        data: { status: action, updated_at: new Date() }
      });

      await tx.async_task_logs.create({
        data: {
          job_id: `AUDIT-REIMB-${id}-${Date.now()}`,
          queue_name: 'finance',
          task_type: 'audit-decision',
          status: 'completed',
          operator_id: auditorId,
          payload: { action, notes } as any,
          completed_at: new Date()
        }
      });
    });

    return { success: true };
  });

  // 创建报销申请 (物理还原：财务级事务原子性)
  app.post('/api/reimbursement', {
    schema: {
      body: z.object({
        title: z.string().min(1),
        type: z.string(),
        amount: z.number(),
        status: z.enum(['draft', 'pending']).optional(),
        remark: z.string().optional(),
        items: z.array(z.object({
          item_type: z.string(),
          amount: z.number(),
          date: z.string(),
          description: z.string().optional(),
          attachment_url: z.string().optional(),
        })),
      }),
      response: {
        200: z.object({ success: z.boolean(), id: z.number() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const body = request.body;
    const reimbursement_no = `BX${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { employees: true }
    });

    if (!user || !user.employees[0]) throw new Error('Employee profile not bound');

    const result = await prisma.$transaction(async (tx) => {
      const workflow = body.status === 'pending'
        ? await tx.approval_workflows.findFirst({
            where: { type: 'reimbursement', status: 'active' },
            include: {
              approval_workflow_nodes: {
                orderBy: { node_order: 'asc' },
                take: 1,
              },
            },
            orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
          })
        : null;

      const main = await tx.reimbursements.create({
        data: {
          reimbursement_no,
          user_id: userId,
          employee_id: user.employees[0].id,
          department_id: user.department_id,
          title: body.title,
          total_amount: body.amount,
          type: body.type as any,
          status: (body.status || 'pending') as any,
          remark: body.remark || '',
          workflow_id: workflow?.id,
          current_node_id: workflow?.approval_workflow_nodes[0]?.id,
          submitted_at: body.status === 'pending' ? new Date() : null,
        }
      });

      if (body.items.length > 0) {
        await tx.reimbursement_items.createMany({
          data: body.items.map(item => ({
            reimbursement_id: main.id,
            item_type: item.item_type,
            amount: item.amount,
            expense_date: new Date(item.date),
            description: item.description || '',
            attachment_url: item.attachment_url || '',
          }))
        });
      }

      await tx.async_task_logs.create({
        data: {
          job_id: `FINANCE-BX-${main.id}`,
          queue_name: 'finance-reimbursement',
          task_type: body.status === 'draft' ? 'save-draft' : 'create-application',
          status: 'completed',
          operator_id: userId,
          payload: { mainId: main.id, no: reimbursement_no } as any,
          completed_at: new Date()
        }
      });

      return main;
    });

    return { success: true, id: result.id };
  });

  app.put('/api/reimbursement/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        title: z.string().min(1),
        type: z.string(),
        amount: z.number(),
        status: z.enum(['draft', 'pending']).optional(),
        remark: z.string().optional(),
        items: z.array(z.object({
          item_type: z.string(),
          amount: z.number(),
          date: z.string(),
          description: z.string().optional(),
          attachment_url: z.string().optional(),
        })),
      }),
      response: {
        200: z.object({ success: z.boolean(), id: z.number() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const id = Number(request.params.id);
    const existing = await prisma.reimbursements.findUnique({
      where: { id },
      select: { user_id: true, status: true },
    });

    if (!existing) return reply.code(404).send({ success: false, message: 'Not found' });
    if (existing.user_id !== userId) return reply.code(403).send({ success: false, message: 'Forbidden' });
    if (existing.status !== 'draft') return reply.code(400).send({ success: false, message: 'Only draft can be edited' });

    const body = request.body;
    const workflow = body.status === 'pending'
      ? await prisma.approval_workflows.findFirst({
          where: { type: 'reimbursement', status: 'active' },
          include: { approval_workflow_nodes: { orderBy: { node_order: 'asc' }, take: 1 } },
          orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
        })
      : null;

    const result = await prisma.$transaction(async (tx) => {
      await tx.reimbursement_items.deleteMany({ where: { reimbursement_id: id } });

      const updated = await tx.reimbursements.update({
        where: { id },
        data: {
          title: body.title,
          total_amount: body.amount,
          type: body.type as any,
          remark: body.remark || '',
          status: (body.status || 'draft') as any,
          workflow_id: workflow?.id ?? null,
          current_node_id: workflow?.approval_workflow_nodes[0]?.id ?? null,
          submitted_at: body.status === 'pending' ? new Date() : null,
          completed_at: null,
          updated_at: new Date(),
        },
      });

      if (body.items.length > 0) {
        await tx.reimbursement_items.createMany({
          data: body.items.map(item => ({
            reimbursement_id: id,
            item_type: item.item_type,
            amount: item.amount,
            expense_date: new Date(item.date),
            description: item.description || '',
            attachment_url: item.attachment_url || '',
          })),
        });
      }

      return updated;
    });

    return { success: true, id: result.id };
  });

  app.delete('/api/reimbursement/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const id = Number(request.params.id);
    const record = await prisma.reimbursements.findUnique({
      where: { id },
      select: { id: true, user_id: true, status: true },
    });

    if (!record) return reply.code(404).send({ success: false, message: 'Not found' });
    if (record.user_id !== userId) return reply.code(403).send({ success: false, message: 'Forbidden' });
    if (record.status !== 'draft') return reply.code(400).send({ success: false, message: 'Only draft can be deleted' });

    await prisma.reimbursements.delete({ where: { id } });
    return { success: true };
  });

  app.post('/api/reimbursement/:id/submit', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const id = Number(request.params.id);
    const record = await prisma.reimbursements.findUnique({
      where: { id },
      select: { id: true, user_id: true, status: true },
    });

    if (!record) return reply.code(404).send({ success: false, message: 'Not found' });
    if (record.user_id !== userId) return reply.code(403).send({ success: false, message: 'Forbidden' });
    if (record.status !== 'draft') return reply.code(400).send({ success: false, message: 'Only draft can be submitted' });

    const workflow = await prisma.approval_workflows.findFirst({
      where: { type: 'reimbursement', status: 'active' },
      include: {
        approval_workflow_nodes: {
          orderBy: { node_order: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
    });

    await prisma.reimbursements.update({
      where: { id },
      data: {
        status: 'pending',
        workflow_id: workflow?.id,
        current_node_id: workflow?.approval_workflow_nodes[0]?.id,
        submitted_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { success: true };
  });

  app.post('/api/reimbursement/:id/cancel', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const id = Number(request.params.id);
    const record = await prisma.reimbursements.findUnique({
      where: { id },
      select: { id: true, user_id: true, status: true },
    });

    if (!record) return reply.code(404).send({ success: false, message: 'Not found' });
    if (record.user_id !== userId) return reply.code(403).send({ success: false, message: 'Forbidden' });
    if (!['pending', 'approving'].includes(record.status)) {
      return reply.code(400).send({ success: false, message: 'Only pending or approving items can be cancelled' });
    }

    await prisma.reimbursements.update({
      where: { id },
      data: {
        status: 'cancelled',
        current_node_id: null,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { success: true };
  });
}
