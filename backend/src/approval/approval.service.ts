import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { buildApprovalChain, type WorkflowNode, type RoutingContext } from './engine/routing-engine';
import { NotificationService } from '../notification/notification.service';
import { ERROR_CODES } from '../common/error-codes';

const WORKFLOW_CACHE_TTL = 30 * 60;

function workflowIdKey(id: number) {
  return `approval:workflow:id:${id}`;
}

function workflowCodeKey(code: string) {
  return `approval:workflow:code:${code}`;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private eventEmitter: EventEmitter2,
    private redis: RedisService,
  ) {}

  // ===== 审批流配置 =====
  async listWorkflows(module?: string, status?: string) {
    const where: any = { deletedAt: null };
    if (module) where.module = module;
    if (status) where.status = status;
    return this.prisma.approvalWorkflow.findMany({
      where,
      include: { nodes: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'asc' },
    });
  }

  async getWorkflowDetail(id: number) {
    if (this.redis.isEnabled) {
      const cached = await this.redis.get(workflowIdKey(id));
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id, deletedAt: null },
      include: { nodes: { orderBy: { order: 'asc' } } },
    });
    if (!workflow) {
      throw new NotFoundException({ code: 6310, message: '审批流不存在' });
    }
    if (this.redis.isEnabled) {
      await this.redis.set(workflowIdKey(id), JSON.stringify(workflow), WORKFLOW_CACHE_TTL);
      await this.redis.set(workflowCodeKey(workflow.code), JSON.stringify(workflow), WORKFLOW_CACHE_TTL);
    }
    return workflow;
  }

  async createWorkflow(params: {
    code: string;
    name: string;
    module: string;
    status?: string;
    maxResubmits?: number;
    nodes: Array<{
      nodeKey: string;
      name: string;
      type: string;
      roleCode?: string;
      approvalGroupId?: number;
      order: number;
      conditionField?: string;
      conditionOperator?: string;
      conditionValue?: string;
    }>;
  }) {
    try {
      return await this.prisma.approvalWorkflow.create({
        data: {
          code: params.code,
          name: params.name,
          module: params.module,
          status: params.status as any || 'draft',
          maxResubmits: params.maxResubmits ?? 3,
          nodes: {
            create: params.nodes.map((n) => ({
              nodeKey: n.nodeKey,
              name: n.name,
              type: n.type,
              roleCode: n.roleCode,
              approvalGroupId: n.approvalGroupId,
              order: n.order,
              conditionField: n.conditionField,
              conditionOperator: n.conditionOperator,
              conditionValue: n.conditionValue,
            })),
          },
        },
        include: { nodes: { orderBy: { order: 'asc' } } },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 6301, message: '审批流编码已存在' });
      }
      throw e;
    }
  }

  async updateWorkflow(id: number, params: {
    name?: string;
    module?: string;
    status?: string;
    maxResubmits?: number;
    nodes?: Array<{
      nodeKey: string;
      name: string;
      type: string;
      roleCode?: string;
      approvalGroupId?: number;
      order: number;
      conditionField?: string;
      conditionOperator?: string;
      conditionValue?: string;
    }>;
  }) {
    const existing = await this.prisma.approvalWorkflow.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 6310, message: '审批流不存在' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (params.name !== undefined) updateData.name = params.name;
      if (params.module !== undefined) updateData.module = params.module;
      if (params.status !== undefined) updateData.status = params.status as any;
      if (params.maxResubmits !== undefined) updateData.maxResubmits = params.maxResubmits;

      if (params.nodes) {
        await tx.approvalWorkflowNode.deleteMany({ where: { workflowId: id } });
        updateData.nodes = {
          create: params.nodes.map((n) => ({
            nodeKey: n.nodeKey,
            name: n.name,
            type: n.type,
            roleCode: n.roleCode,
            approvalGroupId: n.approvalGroupId,
            order: n.order,
            conditionField: n.conditionField,
            conditionOperator: n.conditionOperator,
            conditionValue: n.conditionValue,
          })),
        };
      }

      return tx.approvalWorkflow.update({
        where: { id },
        data: updateData,
        include: { nodes: { orderBy: { order: 'asc' } } },
      });
    });

    if (this.redis.isEnabled) {
      await this.redis.del(workflowIdKey(id));
      await this.redis.del(workflowCodeKey(existing.code));
      if (updated.code !== existing.code) {
        await this.redis.del(workflowCodeKey(updated.code));
      }
    }

    return updated;
  }

  async deleteWorkflow(id: number) {
    const existing = await this.prisma.approvalWorkflow.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 6310, message: '审批流不存在' });
    }
    const hasInstances = await this.prisma.approvalInstance.count({ where: { workflowId: id } });
    if (hasInstances > 0) {
      throw new BadRequestException({ code: 6311, message: '该审批流已有关联的审批实例，无法删除' });
    }
    await this.prisma.approvalWorkflow.update({ where: { id }, data: { deletedAt: new Date() } });
    if (this.redis.isEnabled) {
      await this.redis.del(workflowIdKey(id));
      await this.redis.del(workflowCodeKey(existing.code));
    }
    return { success: true };
  }

  async restoreWorkflow(id: number) {
    const existing = await this.prisma.approvalWorkflow.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 6310, message: '审批流不存在' });
    }
    if (!existing.deletedAt) {
      throw new ConflictException({ code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_DELETED, message: '审批流未被删除，不可恢复' });
    }
    await this.prisma.approvalWorkflow.update({ where: { id }, data: { deletedAt: null } });
    if (this.redis.isEnabled) {
      await this.redis.del(workflowIdKey(id));
      await this.redis.del(workflowCodeKey(existing.code));
    }
    return { success: true };
  }

  // ===== 发起审批 =====
  async startInstance(params: {
    workflowCode: string;
    title: string;
    formData?: Record<string, any>;
    userId: number;
    userName: string;
    departmentId?: number;
    ccEmployeeIds?: number[];
  }) {
    const cacheKey = workflowCodeKey(params.workflowCode);
    let workflow: Awaited<ReturnType<typeof this.prisma.approvalWorkflow.findUnique>> & { nodes: any[] } | null = null;
    
    if (this.redis.isEnabled) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          workflow = JSON.parse(cached);
        } catch {}
      }
    }
    if (!workflow) {
      workflow = await this.prisma.approvalWorkflow.findUnique({
        where: { code: params.workflowCode, deletedAt: null },
        include: { nodes: { orderBy: { order: 'asc' } } },
      });
      if (workflow && this.redis.isEnabled) {
        await this.redis.set(workflowIdKey(workflow.id), JSON.stringify(workflow), WORKFLOW_CACHE_TTL);
        await this.redis.set(cacheKey, JSON.stringify(workflow), WORKFLOW_CACHE_TTL);
      }
    }
    if (!workflow) {
      throw new NotFoundException({ code: 6302, message: '审批流不存在' });
    }
    if (workflow.status !== 'active') {
      throw new BadRequestException({ code: 6303, message: '审批流未激活' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new NotFoundException({ code: 6308, message: '用户不存在' });
    }

    const engineNodes: WorkflowNode[] = workflow.nodes.map((n) => ({
      id: n.nodeKey,
      name: n.name,
      type: n.type as any,
      roleCode: n.roleCode || undefined,
      order: n.order,
      condition:
        n.conditionField && n.conditionOperator
          ? {
              field: n.conditionField,
              operator: n.conditionOperator as any,
              value: n.conditionValue || '',
            }
          : undefined,
    }));

    const depts = await this.prisma.department.findMany({
      where: { managerId: { not: null } },
      select: { id: true, manager: { select: { userId: true } } },
    });
    const departmentManagers: Record<number, number> = {};
    for (const d of depts) {
      if (d.manager?.userId) departmentManagers[d.id] = d.manager.userId;
    }

    const ctx: RoutingContext = {
      applicantDepartmentId: params.departmentId || 0,
      applicantRoleCodes: [],
      formData: params.formData || {},
      departmentManagers,
    };
    const chain = buildApprovalChain(engineNodes, ctx);
    if (chain.length === 0) {
      throw new BadRequestException({ code: 6304, message: '没有可用的审批节点' });
    }

    const firstNode = chain[0];
    const firstNodeEntity = workflow.nodes.find((n) => n.nodeKey === firstNode.nodeKey);

    try {
      const instance = await this.prisma.$transaction(async (tx) => {
        const instance = await tx.approvalInstance.create({
          data: {
            workflowId: workflow.id,
            workflowCode: workflow.code,
            title: params.title,
            applicantId: params.userId,
            applicantName: user.realName,
            departmentId: params.departmentId,
            formData: params.formData ? JSON.stringify(params.formData) : undefined,
            status: 'pending',
            currentNodeKey: firstNode.nodeKey,
            currentNodeName: firstNode.nodeName,
            ccEmployeeIds: params.ccEmployeeIds?.length ? JSON.stringify(params.ccEmployeeIds) : null,
            records: {
              create: chain.map((item) => {
                const nodeEntity = workflow.nodes.find((n) => n.nodeKey === item.nodeKey);
                return {
                  nodeId: nodeEntity!.id,
                  nodeKey: item.nodeKey,
                  nodeName: item.nodeName,
                  order: item.order,
                  status: 'pending' as const,
                };
              }),
            },
          },
          include: { records: { orderBy: { order: 'asc' } } },
        });
        return instance;
      });

      // Notify the approvers of the first node. Wrapped in try/catch so a
      // notification failure never breaks the instance creation.
      try {
        await this.notifyApproversForNode(
          firstNode.nodeKey,
          workflow.id,
          instance.id,
          instance.title,
        );
      } catch (err) {
        this.logger.error(
          `Failed to create approval-pending notifications for instance ${instance.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return instance;
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 6309, message: '审批实例创建冲突' });
      }
      throw e;
    }
  }

  // ===== 审批处理 =====
  async approve(params: {
    instanceId: number;
    userId: number;
    userName: string;
    comment?: string;
  }) {
    return this.handleApproval(params, 'approved');
  }

  async reject(params: {
    instanceId: number;
    userId: number;
    userName: string;
    comment?: string;
  }) {
    return this.handleApproval(params, 'rejected');
  }

  async withdraw(params: { instanceId: number; userId: number; reason?: string }) {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: params.instanceId },
    });
    if (!instance) {
      throw new NotFoundException({ code: 6305, message: '审批实例不存在' });
    }
    if (instance.status !== 'pending') {
      throw new BadRequestException({ code: 6306, message: `当前状态不可撤回` });
    }
    if (instance.applicantId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '只有申请人可以撤回' });
    }

    const updated = await this.prisma.approvalInstance.update({
      where: { id: params.instanceId },
      data: {
        status: 'cancelled',
        currentNodeKey: null,
        currentNodeName: null,
      },
    });

    // 发布撤回事件
    try {
      const workflow = await this.prisma.approvalWorkflow.findUnique({
        where: { id: instance.workflowId },
        select: { code: true, module: true },
      });
      this.eventEmitter.emit('approval.withdrawn', {
        instanceId: instance.id,
        workflowId: instance.workflowId,
        workflowCode: workflow?.code,
        module: workflow?.module,
        status: 'cancelled',
        reason: params.reason,
      });
    } catch (err) {
      this.logger.error(`Failed to emit approval.withdrawn: ${err instanceof Error ? err.message : String(err)}`);
    }

    return updated;
  }

  async resubmit(params: {
    instanceId: number;
    userId: number;
    formData?: Record<string, any>;
  }) {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: params.instanceId },
      include: { records: { orderBy: { order: 'asc' } }, workflow: { include: { nodes: { orderBy: { order: 'asc' } } } } },
    });
    if (!instance) throw new NotFoundException({ code: 6301, message: '审批实例不存在' });
    if (!['rejected', 'cancelled'].includes(instance.status)) {
      throw new BadRequestException({ code: 6307, message: '只有驳回或撤回的审批才能重新提交' });
    }
    if (instance.applicantId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    if (instance.resubmitCount >= instance.workflow.maxResubmits) {
      throw new BadRequestException({ code: 6312, message: `重新提交次数已达上限（最多 ${instance.workflow.maxResubmits} 次）` });
    }

    const formData = params.formData || JSON.parse(instance.formData || '{}');

    const depts = await this.prisma.department.findMany({
      where: { managerId: { not: null } },
      select: { id: true, manager: { select: { userId: true } } },
    });
    const departmentManagers: Record<number, number> = {};
    for (const d of depts) {
      if (d.manager?.userId) departmentManagers[d.id] = d.manager.userId;
    }

    const engineNodes: WorkflowNode[] = instance.workflow.nodes.map((n) => ({
      id: n.nodeKey,
      name: n.name,
      type: n.type as any,
      roleCode: n.roleCode || undefined,
      order: n.order,
      condition:
        n.conditionField && n.conditionOperator
          ? { field: n.conditionField, operator: n.conditionOperator as any, value: n.conditionValue || '' }
          : undefined,
    }));

    const ctx: RoutingContext = {
      applicantDepartmentId: instance.departmentId || 0,
      formData,
      departmentManagers,
    };
    const chain = buildApprovalChain(engineNodes, ctx);
    if (chain.length === 0) {
      throw new BadRequestException({ code: 6304, message: '没有可用的审批节点' });
    }

    const firstNode = chain[0];

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approvalRecord.deleteMany({ where: { instanceId: instance.id } });
      await tx.approvalRecord.createMany({
        data: chain.map((item) => ({
          instanceId: instance.id,
          nodeId: instance.workflow.nodes.find((n) => n.nodeKey === item.nodeKey)!.id,
          nodeKey: item.nodeKey,
          nodeName: item.nodeName,
          order: item.order,
          status: 'pending' as const,
        })),
      });
      return tx.approvalInstance.update({
        where: { id: instance.id },
        data: {
          status: 'pending',
          currentNodeKey: firstNode.nodeKey,
          currentNodeName: firstNode.nodeName,
          formData: JSON.stringify(formData),
          resubmitCount: { increment: 1 },
        },
      });
    });

    // 发布重提交事件
    try {
      this.eventEmitter.emit('approval.resubmitted', {
        instanceId: instance.id,
        workflowId: instance.workflowId,
        workflowCode: instance.workflowCode,
        module: instance.workflow.module,
        status: 'pending',
      });
    } catch (err) {
      this.logger.error(`Failed to emit approval.resubmitted: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
  }

  async transfer(params: {
    instanceId: number;
    userId: number;
    targetUserId: number;
    comment?: string;
  }) {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: params.instanceId },
      include: { records: { orderBy: { order: 'asc' } } },
    });
    if (!instance) throw new NotFoundException({ code: 6301, message: '审批实例不存在' });
    if (instance.status !== 'pending') {
      throw new BadRequestException({ code: 6306, message: `审批已${instance.status}` });
    }

    const currentRecord = instance.records.find(
      (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
    );
    if (!currentRecord) throw new BadRequestException({ code: 6307, message: '当前无待审批节点' });

    const canApprove = await this.canUserApprove(params.userId, currentRecord.nodeKey, instance.workflowId);
    if (!canApprove && currentRecord.approverId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: params.targetUserId } });
    if (!targetUser) throw new NotFoundException({ code: 6308, message: '目标用户不存在' });

    const result = await this.prisma.approvalRecord.update({
      where: { id: currentRecord.id },
      data: {
        approverId: params.targetUserId,
        approverName: targetUser.realName,
        comment: params.comment ? `[转交] ${params.comment}` : null,
      },
    });

    return result;
  }

  async addSign(params: {
    instanceId: number;
    userId: number;
    targetUserId: number;
    position: 'before' | 'after';
    comment?: string;
  }) {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: params.instanceId },
      include: { records: { orderBy: { order: 'asc' } } },
    });
    if (!instance) throw new NotFoundException({ code: 6301, message: '审批实例不存在' });
    if (instance.status !== 'pending') {
      throw new BadRequestException({ code: 6306, message: `审批已${instance.status}` });
    }

    const currentRecord = instance.records.find(
      (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
    );
    if (!currentRecord) throw new BadRequestException({ code: 6307, message: '当前无待审批节点' });

    const canApprove = await this.canUserApprove(params.userId, currentRecord.nodeKey, instance.workflowId);
    if (!canApprove && currentRecord.approverId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: params.targetUserId } });
    if (!targetUser) throw new NotFoundException({ code: 6308, message: '目标用户不存在' });

    const baseOrder = currentRecord.order;
    const signOrder = params.position === 'before' ? baseOrder - 0.5 : baseOrder + 0.5;

    const result = await this.prisma.$transaction(async (tx) => {
      const newRecord = await tx.approvalRecord.create({
        data: {
          instanceId: instance.id,
          nodeId: currentRecord.nodeId,
          nodeKey: `${currentRecord.nodeKey}_addsign_${Date.now()}`,
          nodeName: `${currentRecord.nodeName}（加签）`,
          order: signOrder,
          status: 'pending' as const,
          approverId: params.targetUserId,
          approverName: targetUser.realName,
          comment: params.comment ? `[加签] ${params.comment}` : null,
        },
      });

      const newCurrentKey = params.position === 'before'
        ? newRecord.nodeKey
        : instance.currentNodeKey;
      const newCurrentName = params.position === 'before'
        ? newRecord.nodeName
        : instance.currentNodeName;

      await tx.approvalInstance.update({
        where: { id: instance.id },
        data: {
          currentNodeKey: newCurrentKey,
          currentNodeName: newCurrentName,
        },
      });

      return newRecord;
    });

    return result;
  }

  private async handleApproval(
    params: {
      instanceId: number;
      userId: number;
      userName: string;
      comment?: string;
    },
    action: 'approved' | 'rejected',
  ) {
    const approver = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!approver) {
      throw new NotFoundException({ code: 6308, message: '用户不存在' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const instance = await tx.approvalInstance.findUnique({
        where: { id: params.instanceId },
        include: { records: { orderBy: { order: 'asc' } } },
      });
      if (!instance) {
        throw new NotFoundException({ code: 6305, message: '审批实例不存在' });
      }
      if (instance.status !== 'pending') {
        throw new BadRequestException({ code: 6306, message: `审批已${instance.status}` });
      }

      const currentRecord = instance.records.find(
        (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
      );
      if (!currentRecord) {
        throw new BadRequestException({ code: 6307, message: '当前无待审批节点' });
      }

      const canApprove = await this.canUserApprove(params.userId, currentRecord.nodeKey, instance.workflowId);
      if (!canApprove && currentRecord.approverId !== params.userId) {
        throw new ForbiddenException({ code: 5003, message: '无审批权限' });
      }

      const updateResult = await tx.approvalRecord.updateMany({
        where: {
          id: currentRecord.id,
          status: 'pending',
        },
        data: {
          status: action,
          approverId: params.userId,
          approverName: approver.realName,
          comment: params.comment,
          handledAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const latestRecord = await tx.approvalRecord.findUnique({
          where: { id: currentRecord.id },
        });
        if (latestRecord?.status === action && latestRecord.approverId === params.userId) {
          const latestInstance = await tx.approvalInstance.findUnique({
            where: { id: params.instanceId },
          });
          return latestInstance!;
        }
        throw new BadRequestException({ code: 6309, message: '审批状态已变更，请刷新后重试' });
      }

      if (action === 'rejected') {
        const updated = await tx.approvalInstance.update({
          where: { id: params.instanceId },
          data: { status: 'rejected', currentNodeKey: null, currentNodeName: null },
        });
        return updated;
      }

      const nextRecord = instance.records.find(
        (r) => r.order > currentRecord.order && r.status === 'pending',
      );

      if (nextRecord) {
        const updated = await tx.approvalInstance.update({
          where: { id: params.instanceId },
          data: {
            currentNodeKey: nextRecord.nodeKey,
            currentNodeName: nextRecord.nodeName,
          },
        });
        return updated;
      } else {
        const updated = await tx.approvalInstance.update({
          where: { id: params.instanceId },
          data: { status: 'approved', currentNodeKey: null, currentNodeName: null },
        });
        return updated;
      }
    });

    // If the approval advanced to a next node (still pending, has a current
    // node), notify the next node's approvers. Wrapped in try/catch so a
    // notification failure never breaks the approval flow.
    if (action === 'approved' && result.status === 'pending' && result.currentNodeKey) {
      try {
        await this.notifyApproversForNode(
          result.currentNodeKey,
          result.workflowId,
          params.instanceId,
          result.title,
        );
      } catch (err) {
        this.logger.error(
          `Failed to create approval-pending notifications for next node of instance ${params.instanceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (action === 'approved' && result.status === 'approved') {
      try {
        await this.notifyApplicant(result.applicantId, result.id, result.title, 'approved', params.comment);
      } catch (err) {
        this.logger.error(
          `Failed to create applicant approval notification for instance ${params.instanceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (result.ccEmployeeIds) {
        try {
          await this.notifyCcEmployees(result.ccEmployeeIds, result.id, result.title);
        } catch (err) {
          this.logger.error(
            `Failed to create cc notifications for instance ${params.instanceId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    if (action === 'rejected') {
      try {
        await this.notifyApplicant(result.applicantId, params.instanceId, result.title, 'rejected', params.comment);
      } catch (err) {
        this.logger.error(
          `Failed to create applicant reject notification for instance ${params.instanceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 发布审批事件
    if (action === 'rejected' || result.status === 'approved') {
      const eventName = action === 'rejected' ? 'approval.rejected' : 'approval.approved';
      try {
        const workflow = await this.prisma.approvalWorkflow.findUnique({
          where: { id: result.workflowId },
          select: { code: true, module: true },
        });
        this.eventEmitter.emit(eventName, {
          instanceId: result.id,
          workflowId: result.workflowId,
          workflowCode: workflow?.code,
          module: workflow?.module,
          status: action === 'rejected' ? 'rejected' : 'approved',
          approverId: params.userId,
          approverName: params.userName,
          comment: params.comment,
        });
      } catch (err) {
        this.logger.error(`Failed to emit ${eventName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  }

  private async canUserApprove(userId: number, nodeKey: string, workflowId: number): Promise<boolean> {
    const node = await this.prisma.approvalWorkflowNode.findUnique({
      where: { workflowId_nodeKey: { workflowId, nodeKey } },
    });
    if (!node) return false;

    if (node.type === 'role' && node.roleCode) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      return userRoles.some((ur) => ur.role.code === node.roleCode);
    }

    if (node.type === 'group' && node.approvalGroupId) {
      const member = await this.prisma.approvalGroupMember.findUnique({
        where: {
          groupId_userId: { groupId: node.approvalGroupId, userId },
        },
      });
      return !!member;
    }

    return false;
  }

  /**
   * Resolves the approver user IDs for a given workflow node and creates
   * "pending approval" notifications for each of them.
   *
   * Supports `role`-based nodes (users with the matching role code) and
   * `group`-based nodes (members of the specified approval group).
   */
  private async notifyApproversForNode(
    nodeKey: string,
    workflowId: number,
    instanceId: number,
    title: string,
  ): Promise<void> {
    const node = await this.prisma.approvalWorkflowNode.findUnique({
      where: { workflowId_nodeKey: { workflowId, nodeKey } },
    });
    if (!node) return;

    let userIds: number[] = [];

    if (node.type === 'role' && node.roleCode) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { role: { code: node.roleCode } },
        select: { userId: true },
      });
      userIds = userRoles.map((ur) => ur.userId);
    } else if (node.type === 'group' && node.approvalGroupId) {
      const members = await this.prisma.approvalGroupMember.findMany({
        where: { groupId: node.approvalGroupId },
        select: { userId: true },
      });
      userIds = members.map((m) => m.userId);
    }

    if (userIds.length > 0) {
      await this.notificationService.createMany(userIds, {
        title: `待审批：${title}`,
        content: '您有一条待审批事项',
        type: 'approval',
        relatedId: instanceId,
        relatedType: 'approval_instance',
      });
    }
  }

  private async notifyCcEmployees(ccEmployeeIdsJson: string, instanceId: number, title: string) {
    let ccIds: number[] = [];
    try {
      ccIds = JSON.parse(ccEmployeeIdsJson);
    } catch {
      return;
    }
    if (!ccIds.length) return;

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: ccIds }, userId: { not: null } },
      select: { userId: true },
    });
    const userIds = employees.map((e) => e.userId!).filter(Boolean);
    if (userIds.length > 0) {
      await this.notificationService.createMany(userIds, {
        title: `审批通过：${title}`,
        content: '您收到一条审批抄送',
        type: 'approval',
        relatedId: instanceId,
        relatedType: 'approval_instance',
      });
    }
  }

  private async notifyApplicant(
    applicantId: number,
    instanceId: number,
    title: string,
    result: 'approved' | 'rejected',
    comment?: string,
  ) {
    const resultText = result === 'approved' ? '已通过' : '被驳回';
    const notificationTitle = `您的${title}${resultText}`;
    let content = '';
    if (result === 'approved') {
      content = comment ? `审批已通过，审批意见：${comment}` : '审批已通过';
    } else {
      content = comment ? `审批被驳回，驳回原因：${comment}` : '审批被驳回';
    }

    await this.notificationService.create({
      userId: applicantId,
      title: notificationTitle,
      content,
      type: 'approval',
      relatedId: instanceId,
      relatedType: 'approval_instance',
    });
  }

  // ===== 待办中心 =====
  async listTodos(userId: number, query: { page: number; pageSize: number }) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const roleCodes = userRoles.map((ur) => ur.role.code);

    const pendingNodes = await this.prisma.approvalWorkflowNode.findMany({
      where: {
        type: 'role',
        roleCode: { in: roleCodes },
      },
    });
    const nodeIds = pendingNodes.map((n) => n.id);

    const where: any = {
      nodeId: { in: nodeIds },
      status: 'pending',
      instance: { status: 'pending' },
    };

    const [records, total] = await Promise.all([
      this.prisma.approvalRecord.findMany({
        where,
        include: {
          instance: {
            select: {
              id: true,
              title: true,
              workflowCode: true,
              applicantName: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.approvalRecord.count({ where }),
    ]);

    const list = records.map((r) => ({
      id: r.id,
      instanceId: r.instanceId,
      nodeKey: r.nodeKey,
      nodeName: r.nodeName,
      title: r.instance.title,
      workflowCode: r.instance.workflowCode,
      applicantName: r.instance.applicantName,
      instanceStatus: r.instance.status,
      createdAt: r.createdAt,
    }));

    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  // ===== 我的申请 =====
  async listMySubmissions(userId: number, query: { page: number; pageSize: number; status?: string }) {
    const where: any = { applicantId: userId };
    if (query.status) where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.approvalInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.approvalInstance.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  // ===== 我已审批（已办）=====
  async listMyApproved(userId: number, query: { page: number; pageSize: number; status?: string }) {
    const where: any = {
      approverId: userId,
      status: { in: ['approved', 'rejected'] },
    };

    const [records, total] = await Promise.all([
      this.prisma.approvalRecord.findMany({
        where,
        include: {
          instance: {
            include: {
              workflow: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { handledAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.approvalRecord.count({ where }),
    ]);

    const list = records.map((r) => ({
      id: r.id,
      instanceId: r.instanceId,
      nodeKey: r.nodeKey,
      nodeName: r.nodeName,
      title: r.instance.title,
      workflowCode: r.instance.workflowCode,
      workflowName: (r.instance as any).workflow?.name || '',
      applicantName: r.instance.applicantName,
      instanceStatus: r.instance.status,
      action: r.status,
      comment: r.comment,
      handledAt: r.handledAt,
      createdAt: r.instance.createdAt,
      currentNodeName: r.instance.currentNodeName,
    }));

    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  // ===== 审批详情 =====
  async getInstanceDetail(id: number, userId: number) {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id },
      include: {
        records: { orderBy: { order: 'asc' } },
      },
    });
    if (!instance) {
      throw new NotFoundException({ code: 6305, message: '审批实例不存在' });
    }

    // IDOR fix: only the applicant, an approver, or admin/hr can view the detail
    if (instance.applicantId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const roleCodes = userRoles.map((ur) => ur.role.code);
      const isPrivileged = roleCodes.some((c) => c === 'admin' || c === 'hr');
      const isApprover = instance.records.some(
        (r) => r.approverId === userId,
      );
      if (!isPrivileged && !isApprover) {
        throw new ForbiddenException({ code: 4030, message: '无权查看该审批实例' });
      }
    }

    return instance;
  }

  // ===== 审批意见模板 =====
  async listCommentTemplates(type?: string) {
    const where: any = {};
    if (type) where.type = type;
    return this.prisma.approvalCommentTemplate.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async createCommentTemplate(data: { name: string; content: string; type: string; sortOrder?: number }) {
    return this.prisma.approvalCommentTemplate.create({ data: data as any });
  }

  async updateCommentTemplate(id: number, data: { name?: string; content?: string; type?: string; sortOrder?: number }) {
    return this.prisma.approvalCommentTemplate.update({ where: { id }, data: data as any });
  }

  async deleteCommentTemplate(id: number) {
    await this.prisma.approvalCommentTemplate.delete({ where: { id } });
    return { success: true };
  }
}
