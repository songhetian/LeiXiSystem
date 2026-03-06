import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

// 1. 定义巅峰序列化 Schema
export const workflowNodeSchema = z.object({
  id: z.number(),
  node_name: z.string(),
  node_order: z.number(),
  approver_type: z.string(),
  approval_mode: z.string(),
  can_skip: z.boolean(),
});

export const approvalRecordSchema = z.object({
  id: z.number(),
  action: z.string(),
  opinion: z.string().nullable(),
  approved_at: z.date().or(z.string()),
  approver_name: z.string().optional(),
});

export default async function workflowRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取流程定义 (带预编译序列化)
  app.get('/api/workflow/definitions', {
    schema: {
      querystring: z.object({ type: z.string().default('reimbursement') }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            id: z.number(),
            name: z.string(),
            nodes: z.array(workflowNodeSchema)
          })),
        }),
      },
    },
  }, async (request) => {
    const { type } = request.query;
    const workflows = await prisma.approval_workflows.findMany({
      where: { type, status: 'active' },
      include: {
        approval_workflow_nodes: {
          orderBy: { node_order: 'asc' }
        }
      }
    });

    return {
      success: true,
      data: workflows.map(w => ({
        id: w.id,
        name: w.name,
        nodes: w.approval_workflow_nodes
      })) as any
    };
  });

  // 执行审批决策 (规约执行：事务原子性闭环)
  app.post('/api/workflow/decide', {
    schema: {
      body: z.object({
        targetId: z.number(), // 业务单据 ID (如报销单 ID)
        action: z.enum(['approved', 'rejected', 'returned']),
        opinion: z.string().optional(),
        targetType: z.string().default('reimbursement')
      }),
      response: {
        200: z.object({ success: z.boolean(), message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const { targetId, action, opinion, targetType } = request.body;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. 获取当前业务单据状态
        const record = await tx.reimbursements.findUnique({
          where: { id: targetId },
          include: { 
            approval_workflows: {
              include: { approval_workflow_nodes: { orderBy: { node_order: 'asc' } } }
            }
          }
        });

        if (!record || !record.current_node_id) throw new Error('Invalid record or no active node');

        // 2. 插入审批存证记录
        await tx.approval_records.create({
          data: {
            reimbursement_id: targetId,
            node_id: record.current_node_id,
            node_order: 1, // 示例简化，实际应根据当前节点查找
            approver_id: userId,
            action: action as any,
            opinion: opinion || '',
          }
        });

        // 3. 计算下一节点或更新最终状态
        let nextStatus = record.status;
        let nextNodeId = record.current_node_id;

        if (action === 'approved') {
          const nodes = record.approval_workflows?.approval_workflow_nodes || [];
          const currentIndex = nodes.findIndex(n => n.id === record.current_node_id);
          const nextNode = nodes[currentIndex + 1];

          if (nextNode) {
            nextNodeId = nextNode.id;
            nextStatus = 'approving';
          } else {
            // 流程走完
            nextNodeId = null as any;
            nextStatus = 'approved';
          }
        } else {
          // 驳回或退回
          nextNodeId = null as any;
          nextStatus = action === 'rejected' ? 'rejected' : 'returned';
        }

        // 4. 原子性更新业务单据
        await tx.reimbursements.update({
          where: { id: targetId },
          data: {
            status: nextStatus as any,
            current_node_id: nextNodeId,
            completed_at: ['approved', 'rejected'].includes(nextStatus) ? new Date() : null
          }
        });

        // 5. 规约加固：任务日志闭环
        await tx.async_task_logs.create({
          data: {
            job_id: `WF-${targetType.toUpperCase()}-${targetId}-${Date.now()}`,
            queue_name: 'workflow-engine',
            task_type: `decision-${action}`,
            status: 'completed',
            operator_id: userId,
            payload: { targetId, action, opinion } as any,
            completed_at: new Date()
          }
        });
      });

      return { success: true, message: '审批决策已物理入库并同步主表状态' };
    } catch (e: any) {
      return reply.code(500).send({ success: false, message: e.message || 'Workflow internal error' });
    }
  });
}
