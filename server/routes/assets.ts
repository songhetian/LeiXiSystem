import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

// 1. 定义巅峰序列化 Schema
export const assetCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string().nullable(),
  status: z.string().nullable(),
});

export const assetInstanceSchema = z.object({
  id: z.number(),
  asset_no: z.string(),
  model_id: z.number().nullable(),
  model_name: z.string().optional(),
  form_name: z.string().optional(),
  current_user_id: z.number().nullable(),
  user_name: z.string().optional(),
  user_avatar: z.string().optional(),
  department_name: z.string().optional(),
  device_status: z.string().nullable(),
  status: z.string().nullable(),
});

export const assetRequestSchema = z.object({
  id: z.number(),
  asset_id: z.number(),
  asset_no: z.string().optional(),
  device_name: z.string().optional(),
  user_id: z.number(),
  applicant_name: z.string().optional(),
  department_name: z.string().optional(),
  type: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  admin_notes: z.string().nullable(),
  created_at: z.date().or(z.string()),
});

export default async function assetRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取资产分类 (AOT 序列化)
  app.get('/api/assets/categories', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(assetCategorySchema),
        }),
      },
    },
  }, async () => {
    const categories = await prisma.asset_categories.findMany({
      where: { status: { not: 'deleted' } }
    });
    return { success: true, data: categories as any };
  });

  // 获取实机明细 (规约执行：权限闭环与自适应查询)
  app.get('/api/assets/instances', {
    schema: {
      querystring: z.object({
        device_status: z.string().optional(),
        keyword: z.string().optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(assetInstanceSchema),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const { device_status, keyword } = request.query;

    const instances = await prisma.devices.findMany({
      where: {
        status: { not: 'deleted' },
        device_status: device_status || undefined,
        OR: keyword ? [
          { asset_no: { contains: keyword } },
          { users: { real_name: { contains: keyword } } }
        ] : undefined
      },
      include: {
        asset_models: { include: { asset_device_forms: true } },
        users: { include: { departments: true } }
      },
      orderBy: { id: 'desc' }
    });

    const data = instances.map(dev => ({
      id: dev.id,
      asset_no: dev.asset_no,
      model_id: dev.model_id,
      model_name: dev.asset_models?.name,
      form_name: dev.asset_models?.asset_device_forms?.name,
      current_user_id: dev.current_user_id,
      user_name: dev.users?.real_name,
      user_avatar: dev.users?.avatar,
      department_name: dev.users?.departments?.name,
      device_status: dev.device_status,
      status: dev.status,
    }));

    return { success: true, data: data as any };
  });

  // 审批资产申请 (规约执行：事务原子性闭环)
  app.put('/api/assets/requests/:id/audit', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        action: z.enum(['approved', 'rejected']),
        notes: z.string().optional(),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request, reply) => {
    const requestId = Number(request.params.id);
    const { action, notes } = request.body;
    const auditorId = (request as any).user?.id;

    if (!auditorId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    await prisma.$transaction(async (tx) => {
      const req = await tx.asset_requests.findUnique({
        where: { id: requestId },
        include: { devices: true }
      });

      if (!req) throw new Error('Request not found');

      // 1. 更新申请表状态
      await tx.asset_requests.update({
        where: { id: requestId },
        data: {
          status: action,
          admin_notes: notes,
          handled_by: auditorId,
          handled_at: new Date(),
          completed_at: action === 'approved' ? new Date() : null
        }
      });

      // 2. 如果审批通过，物理同步更新设备状态
      if (action === 'approved' && req.asset_id) {
        await tx.devices.update({
          where: { id: req.asset_id },
          data: {
            device_status: req.type === 'return' ? 'idle' : 'in_use',
            current_user_id: req.type === 'return' ? null : req.user_id,
            updated_at: new Date()
          }
        });

        // 3. 规约执行：记录资产变动存证 (逻辑闭环)
        await tx.async_task_logs.create({
          data: {
            job_id: `ASSET-AUDIT-${requestId}`,
            queue_name: 'asset-management',
            task_type: `audit-${req.type}`,
            status: 'completed',
            operator_id: auditorId,
            payload: { requestId, action, notes } as any,
            completed_at: new Date()
          }
        });
      }
    });

    return { success: true };
  });
}
