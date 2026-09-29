import {
  Injectable,
  Optional,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RoleWorkflowService } from './role-workflow.service';
import { buildApprovalChain, type WorkflowNode, type RoutingContext } from './engine/routing-engine';
import { NotificationClientInterface } from '../notification/notification-client.interface';
import { ERROR_CODES } from '../common/error-codes';
import { generateAutoCode } from '../common/code-gen.util';

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
    @Inject('NOTIFICATION_CLIENT') private notificationService: NotificationClientInterface,
    private eventEmitter: EventEmitter2,
    private redis: RedisService,
    @Optional() private roleWorkflowService?: RoleWorkflowService,
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
        } catch (err) {
          // 缓存反序列化失败：值已损坏（序列化版本变更/Redis 注入），回退到 DB；
          // warn 留痕，便于运维发现并清理脏缓存。
          this.logger.warn(`workflow cache parse failed (id=${id}): ${err instanceof Error ? err.message : String(err)}`);
        }
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
    code?: string;
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
          code: params.code || generateAutoCode('WF'),
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
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_WORKFLOW_IN_USE, message: '该审批流已有关联的审批实例，无法删除' });
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
    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.APPROVAL_USER_NOT_FOUND, message: '用户不存在' });
    }

    // 职责授权：按申请人角色绑定的已激活流程优先；否则使用入参流程编码
    let workflowCode = params.workflowCode;
    const boundWorkflow = this.roleWorkflowService
      ? await this.roleWorkflowService.resolveWorkflowForUser(params.userId)
      : null;
    if (boundWorkflow?.code) {
      workflowCode = boundWorkflow.code;
    }

    const cacheKey = workflowCodeKey(workflowCode);
    type WorkflowWithNodes = NonNullable<
      Awaited<ReturnType<PrismaService['approvalWorkflow']['findUnique']>>
    > & { nodes: any[] };
    let workflow: WorkflowWithNodes | null = null;

    if (this.redis.isEnabled) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          workflow = JSON.parse(cached);
        } catch (err) {
          this.logger.warn(`workflow cache parse failed (code=${workflowCode}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    if (!workflow) {
      workflow = await this.prisma.approvalWorkflow.findUnique({
        where: { code: workflowCode, deletedAt: null },
        include: { nodes: { orderBy: { order: 'asc' } } },
      });
      if (workflow && this.redis.isEnabled) {
        await this.redis.set(workflowIdKey(workflow.id), JSON.stringify(workflow), WORKFLOW_CACHE_TTL);
        await this.redis.set(cacheKey, JSON.stringify(workflow), WORKFLOW_CACHE_TTL);
      }
    }
    if (!workflow) {
      throw new NotFoundException({ code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND, message: '审批流不存在' });
    }
    if (workflow.status !== 'active') {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_ACTIVE, message: '审批流未激活' });
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
      applicantUserId: params.userId,
      formData: params.formData || {},
      departmentManagers,
    };
    const chain = buildApprovalChain(engineNodes, ctx);
    if (chain.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_NO_AVAILABLE_NODE, message: '没有可用的审批节点' });
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
          { applicantDepartmentId: params.departmentId, applicantId: params.userId },
        );
      } catch (err) {
        this.logger.error(
          `Failed to create approval-pending notifications for instance ${instance.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return instance;
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: ERROR_CODES.APPROVAL_INSTANCE_CONFLICT, message: '审批实例创建冲突' });
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
      throw new NotFoundException({ code: ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND, message: '审批实例不存在' });
    }
    if (instance.status !== 'pending') {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID, message: `当前状态不可撤回` });
    }
    if (instance.applicantId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '只有申请人可以撤回' });
    }

    // 状态流转必须带 status='pending' 条件做 CAS：上面的读取只是快照，
    // 并发的审批事务在同一时刻也读到 pending 并无条件写回，会把撤回覆盖成 approved。
    const claimed = await this.prisma.approvalInstance.updateMany({
      where: { id: params.instanceId, status: 'pending' },
      data: {
        status: 'cancelled',
        currentNodeKey: null,
        currentNodeName: null,
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID,
        message: `当前状态不可撤回`,
      });
    }

    const updated = await this.prisma.approvalInstance.findUnique({
      where: { id: params.instanceId },
    });

    // 「待审批」通知随撤回立即失效，否则审批人点开会落到已取消的单据
    await this.clearPendingNotifications(params.instanceId);

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
    if (!instance) throw new NotFoundException({ code: ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND, message: '审批实例不存在' });
    if (!['rejected', 'cancelled'].includes(instance.status)) {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID, message: '只有驳回或撤回的审批才能重新提交' });
    }
    if (instance.applicantId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    if (instance.resubmitCount >= instance.workflow.maxResubmits) {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_RESUBMIT_LIMIT, message: `重新提交次数已达上限（最多 ${instance.workflow.maxResubmits} 次）` });
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
      applicantUserId: instance.applicantId,
      formData,
      departmentManagers,
    };
    const chain = buildApprovalChain(engineNodes, ctx);
    if (chain.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_NO_AVAILABLE_NODE, message: '没有可用的审批节点' });
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

    // 重提后首个审批节点的「待审批」通知必须重建：驳回/撤回时该实例的通知已被
    // clearPendingNotifications 清空，若不重新创建，重提的审批将无人处理。
    // 先清理再创建，避免同一用户既是旧通知接收人又是新审批人时新通知被一并删掉。
    await this.clearPendingNotifications(instance.id);
    try {
      await this.notifyApproversForNode(
        firstNode.nodeKey,
        instance.workflowId,
        instance.id,
        instance.title,
        { applicantDepartmentId: instance.departmentId, applicantId: instance.applicantId },
      );
    } catch (err) {
      this.logger.error(
        `Failed to create approval-pending notifications for resubmitted instance ${instance.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

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
    if (!instance) throw new NotFoundException({ code: ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND, message: '审批实例不存在' });
    if (instance.status !== 'pending') {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID, message: `审批已${instance.status}` });
    }

    const currentRecord = instance.records.find(
      (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
    );
    if (!currentRecord) throw new BadRequestException({ code: ERROR_CODES.APPROVAL_NO_PENDING_NODE, message: '当前无待审批节点' });

    const canApprove = await this.canUserApprove(params.userId, currentRecord.nodeKey, instance.workflowId, {
      applicantDepartmentId: instance.departmentId,
      applicantId: instance.applicantId,
    });
    if (!canApprove && currentRecord.approverId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: params.targetUserId } });
    if (!targetUser) throw new NotFoundException({ code: ERROR_CODES.APPROVAL_USER_NOT_FOUND, message: '目标用户不存在' });

    const result = await this.prisma.approvalRecord.update({
      where: { id: currentRecord.id },
      data: {
        approverId: params.targetUserId,
        approverName: targetUser.realName,
        comment: params.comment ? `[转交] ${params.comment}` : null,
      },
    });

    // 先清掉原审批人的「待审批」通知，再给被转交人建新通知（顺序不可颠倒，
    // 否则新通知会被 removeByRelated 一并删除）。被转交人若无通知将完全无感。
    await this.clearPendingNotifications(params.instanceId);
    try {
      await this.notificationService.create({
        userId: params.targetUserId,
        title: `待审批：${instance.title}`,
        content: params.comment ? `有一条审批事项转交给您：${params.comment}` : '有一条审批事项转交给您处理',
        type: 'approval',
        relatedId: params.instanceId,
        relatedType: 'approval_instance',
      });
    } catch (err) {
      this.logger.error(
        `Failed to create transfer notification for instance ${params.instanceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

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
    if (!instance) throw new NotFoundException({ code: ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND, message: '审批实例不存在' });
    if (instance.status !== 'pending') {
      throw new BadRequestException({ code: ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID, message: `审批已${instance.status}` });
    }

    const currentRecord = instance.records.find(
      (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
    );
    if (!currentRecord) throw new BadRequestException({ code: ERROR_CODES.APPROVAL_NO_PENDING_NODE, message: '当前无待审批节点' });

    const canApprove = await this.canUserApprove(params.userId, currentRecord.nodeKey, instance.workflowId, {
      applicantDepartmentId: instance.departmentId,
      applicantId: instance.applicantId,
    });
    if (!canApprove && currentRecord.approverId !== params.userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: params.targetUserId } });
    if (!targetUser) throw new NotFoundException({ code: ERROR_CODES.APPROVAL_USER_NOT_FOUND, message: '目标用户不存在' });

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

    // 前加签会立即把当前节点切到加签记录上：先清掉原审批人的「待审批」通知，
    // 再给被加签人发新通知（顺序不可颠倒），否则被加签人收不到任何提醒。
    // 后加签不由本人立即处理，通知在该节点轮到时由 notifyApproversForNode 补发。
    if (params.position === 'before') {
      await this.clearPendingNotifications(params.instanceId);
      try {
        await this.notificationService.create({
          userId: params.targetUserId,
          title: `待审批：${instance.title}`,
          content: params.comment ? `有一条审批事项加签给您：${params.comment}` : '有一条审批事项加签给您处理',
          type: 'approval',
          relatedId: params.instanceId,
          relatedType: 'approval_instance',
        });
      } catch (err) {
        this.logger.error(
          `Failed to create add-sign notification for instance ${params.instanceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return result;
  }

  /**
   * 实例状态流转的 CAS：只允许从 pending 迁移。
   *
   * 撤回（withdraw，事务外）与审批（handleApproval，事务内）可能并发：
   * 双方读取到的实例都是 pending，若无条件写回，在途的审批会把已撤回的实例
   * 覆盖成 approved / 下一节点——申请人撤回了、业务单据也置为已撤销，审批却显示「已通过」。
   * 命中 0 行即说明实例已被并发改动，抛 6307 让事务整体回滚。
   */
  private async transitionInstance(tx: any, instanceId: number, data: Record<string, unknown>) {
    const result = await tx.approvalInstance.updateMany({
      where: { id: instanceId, status: 'pending' },
      data,
    });
    if (result.count === 0) {
      throw new ConflictException({
        code: ERROR_CODES.APPROVAL_INSTANCE_CONFLICT,
        message: '审批状态已变更，请刷新后重试',
      });
    }
    return tx.approvalInstance.findUnique({ where: { id: instanceId } });
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
      throw new NotFoundException({ code: ERROR_CODES.APPROVAL_USER_NOT_FOUND, message: '用户不存在' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const instance = await tx.approvalInstance.findUnique({
        where: { id: params.instanceId },
        include: { records: { orderBy: { order: 'asc' } } },
      });
      if (!instance) {
        throw new NotFoundException({ code: ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND, message: '审批实例不存在' });
      }
      if (instance.status !== 'pending') {
        throw new BadRequestException({ code: ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID, message: `审批已${instance.status}` });
      }

      const currentRecord = instance.records.find(
        (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
      );
      if (!currentRecord) {
        throw new BadRequestException({ code: ERROR_CODES.APPROVAL_NO_PENDING_NODE, message: '当前无待审批节点' });
      }

      const canApprove = await this.canUserApprove(params.userId, currentRecord.nodeKey, instance.workflowId, {
        applicantDepartmentId: instance.departmentId,
        applicantId: instance.applicantId,
      });
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
        throw new BadRequestException({ code: ERROR_CODES.APPROVAL_INSTANCE_CONFLICT, message: '审批状态已变更，请刷新后重试' });
      }

      if (action === 'rejected') {
        const updated = await this.transitionInstance(tx, params.instanceId, {
          status: 'rejected',
          currentNodeKey: null,
          currentNodeName: null,
        });
        return updated;
      }

      const nextRecord = instance.records.find(
        (r) => r.order > currentRecord.order && r.status === 'pending',
      );

      if (nextRecord) {
        const updated = await this.transitionInstance(tx, params.instanceId, {
          currentNodeKey: nextRecord.nodeKey,
          currentNodeName: nextRecord.nodeName,
        });
        return updated;
      } else {
        const updated = await this.transitionInstance(tx, params.instanceId, {
          status: 'approved',
          currentNodeKey: null,
          currentNodeName: null,
        });
        return updated;
      }
    });

    // 「待审批」通知随本次审批动作立即失效；必须先清理再创建下一节点的通知，
    // 否则同一用户既是上一节点又是下一节点审批人时，新通知会被一并删掉。
    await this.clearPendingNotifications(params.instanceId);

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
          { applicantDepartmentId: result.departmentId, applicantId: result.applicantId },
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

  /**
   * 判断用户是否可审批指定节点。
   *
   * role/group 型节点与实例无关，可直接按节点定义判定；
   * department_manager/initiator 型节点依赖实例上下文（申请部门、申请人），
   * 因此调用方必须传入 ctx，否则一律拒绝（fail-closed）。
   */
  private async canUserApprove(
    userId: number,
    nodeKey: string,
    workflowId: number,
    ctx: { applicantDepartmentId?: number | null; applicantId?: number | null } = {},
  ): Promise<boolean> {
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

    if (node.type === 'department_manager') {
      const managerUserId = await this.resolveDepartmentManagerUserId(ctx.applicantDepartmentId);
      return managerUserId !== null && managerUserId === userId;
    }

    if (node.type === 'initiator') {
      return ctx.applicantId !== undefined && ctx.applicantId !== null && ctx.applicantId === userId;
    }

    return false;
  }

  /**
   * 审批实例被处理或撤回后，其「待审批」通知立即失效。
   * 通知失败不应影响审批主流程，因此只在本地记日志。
   */
  private async clearPendingNotifications(instanceId: number): Promise<void> {
    try {
      await this.notificationService.removeByRelated('approval_instance', instanceId);
    } catch (err) {
      this.logger.error(
        `Failed to clear approval notifications for instance ${instanceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Resolves the approver user IDs for a given workflow node and creates
   * "pending approval" notifications for each of them.
   *
   * Supports `role`-based nodes (users with the matching role code),
   * `group`-based nodes (members of the specified approval group),
   * `department_manager` nodes (manager of the applicant's department) and
   * `initiator` nodes (the applicant themself).
   */
  private async notifyApproversForNode(
    nodeKey: string,
    workflowId: number,
    instanceId: number,
    title: string,
    ctx: { applicantDepartmentId?: number | null; applicantId?: number | null } = {},
  ): Promise<void> {
    const node = await this.prisma.approvalWorkflowNode.findUnique({
      where: { workflowId_nodeKey: { workflowId, nodeKey } },
    });
    if (!node) {
      // 加签节点的 nodeKey（xxx_addsign_时间戳）不在审批流节点表中，审批人只存在于
      // 记录本身；不回退查询的话被加签人轮到该节点时收不到任何通知。
      const record = await this.prisma.approvalRecord.findFirst({
        where: { instanceId, nodeKey, status: 'pending' },
        select: { approverId: true },
      });
      if (record?.approverId) {
        await this.notificationService.create({
          userId: record.approverId,
          title: `待审批：${title}`,
          content: '您有一条待审批事项',
          type: 'approval',
          relatedId: instanceId,
          relatedType: 'approval_instance',
        });
      }
      return;
    }

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
    } else if (node.type === 'department_manager') {
      const managerUserId = await this.resolveDepartmentManagerUserId(ctx.applicantDepartmentId);
      if (managerUserId !== null) userIds = [managerUserId];
    } else if (node.type === 'initiator') {
      if (ctx.applicantId !== undefined && ctx.applicantId !== null) userIds = [ctx.applicantId];
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

  /** 申请部门的负责人 userId；部门为空或未设置负责人时返回 null。 */
  private async resolveDepartmentManagerUserId(
    departmentId?: number | null,
  ): Promise<number | null> {
    if (departmentId === undefined || departmentId === null) return null;
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { manager: { select: { userId: true } } },
    });
    return dept?.manager?.userId ?? null;
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
  /**
   * 待办查询条件。listTodos（待办列表）与 countPendingTodos（首页「待审批」徽标）
   * 必须共用同一构造，否则两处口径漂移（徽标有数、列表为空）。
   */
  private async buildTodoWhere(userId: number) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const roleCodes = userRoles.map((ur) => ur.role.code);

    // 审批组型审批人同样可审批（见 canUserApprove），待办列表必须一并收集
    const groupMembers = await this.prisma.approvalGroupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = groupMembers.map((m) => m.groupId);

    // 部门主管型节点：只有「申请部门的负责人」才是待办人，故先取出本人负责的部门
    const managedDepartments = await this.prisma.department.findMany({
      where: { manager: { userId } },
      select: { id: true },
    });
    const managedDepartmentIds = managedDepartments.map((d) => d.id);

    // 加签产生的记录带显式 approverId，但其 nodeKey（xxx_addsign_时间戳）不在
    // approval_workflow_nodes 表中，按节点匹配会永久漏掉该待办 → 显式指派的待办单独成一支。
    const assignedRecords = await this.prisma.approvalRecord.findMany({
      where: { approverId: userId, status: 'pending', instance: { status: 'pending' } },
      select: { nodeKey: true },
    });
    const assignedNodeKeys = assignedRecords
      .map((r) => r.nodeKey)
      .filter((k): k is string => !!k);

    const pendingNodes = await this.prisma.approvalWorkflowNode.findMany({
      where: {
        OR: [
          { type: 'role', roleCode: { in: roleCodes } },
          { type: 'group', approvalGroupId: { in: groupIds } },
          { type: 'department_manager' },
          { type: 'initiator' },
        ],
      },
    });
    // role/group 节点与实例无关，可整体下推；department_manager / initiator 的审批人
    // 由实例（申请部门 / 申请人）决定，必须叠加实例条件，否则会把他人的节点算进本人待办。
    const isInstanceBound = (type: string) => type === 'department_manager' || type === 'initiator';
    const nodeKeyOf = (n: { nodeKey?: string | null; id: number }) => n.nodeKey || String(n.id);

    const nodeIds = pendingNodes.filter((n) => !isInstanceBound(n.type)).map((n) => n.id);
    // 建实例时链上所有节点的 record 都是 pending，故「节点审批人」≠「当前待办人」：
    // 必须叠加「实例当前节点 = 本节点」，否则后置节点审批人会提前看到待办
    // （点同意又被 currentNodeKey 校验挡回 403），且待办计数虚高。
    const nodeKeys = pendingNodes.filter((n) => !isInstanceBound(n.type)).map(nodeKeyOf);
    const departmentManagerNodeIds = pendingNodes
      .filter((n) => n.type === 'department_manager')
      .map((n) => n.id);
    const departmentManagerNodeKeys = pendingNodes
      .filter((n) => n.type === 'department_manager')
      .map(nodeKeyOf);
    const initiatorNodeIds = pendingNodes.filter((n) => n.type === 'initiator').map((n) => n.id);
    const initiatorNodeKeys = pendingNodes.filter((n) => n.type === 'initiator').map(nodeKeyOf);

    const clauses: any[] = [
      { nodeId: { in: nodeIds }, instance: { status: 'pending', currentNodeKey: { in: nodeKeys } } },
    ];
    if (departmentManagerNodeIds.length > 0 && managedDepartmentIds.length > 0) {
      clauses.push({
        nodeId: { in: departmentManagerNodeIds },
        instance: {
          status: 'pending',
          currentNodeKey: { in: departmentManagerNodeKeys },
          departmentId: { in: managedDepartmentIds },
        },
      });
    }
    if (initiatorNodeIds.length > 0) {
      clauses.push({
        nodeId: { in: initiatorNodeIds },
        instance: {
          status: 'pending',
          currentNodeKey: { in: initiatorNodeKeys },
          applicantId: userId,
        },
      });
    }
    if (assignedNodeKeys.length > 0) {
      clauses.push({
        nodeKey: { in: assignedNodeKeys },
        instance: { status: 'pending', currentNodeKey: { in: assignedNodeKeys } },
      });
    }

    const where: any = {
      status: 'pending',
      instance: { status: 'pending' },
    };
    // 只有 role/group 节点时保持原有 nodeId 形状，避免无谓地改变查询计划
    if (clauses.length === 1) {
      where.nodeId = clauses[0].nodeId;
      where.instance = clauses[0].instance;
    } else {
      where.OR = clauses;
    }

    return where;
  }

  async listTodos(userId: number, query: { page: number; pageSize: number }) {
    const where = await this.buildTodoWhere(userId);

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

  /** 待办数（首页「待审批」徽标）。与 listTodos 同口径，不得改用 approverId 直接计数。 */
  async countPendingTodos(userId: number): Promise<number> {
    return this.prisma.approvalRecord.count({ where: await this.buildTodoWhere(userId) });
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
      throw new NotFoundException({ code: ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND, message: '审批实例不存在' });
    }

    // IDOR fix: only the applicant, an approver, or admin/hr can view the detail
    if (instance.applicantId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const roleCodes = userRoles.map((ur) => ur.role.code);
      const isPrivileged = roleCodes.some((c) => c === 'admin' || c === 'hr');
      // approverId 是审计字段（仅加签 / 转交 / 实际处理时写入），建实例时链上记录
      // 的 approverId 恒为 null，因此还必须按节点语义判定审批人，
      // 否则角色型 / 审批组型审批人点开自己的待办详情会被判成无权查看。
      let isApprover = instance.records.some((r) => r.approverId === userId);
      if (!isPrivileged && !isApprover) {
        for (const record of instance.records.filter((r) => r.status === 'pending')) {
          const canApprove = await this.canUserApprove(userId, record.nodeKey, instance.workflowId, {
            applicantDepartmentId: instance.departmentId,
            applicantId: instance.applicantId,
          });
          if (canApprove) {
            isApprover = true;
            break;
          }
        }
      }
      if (!isPrivileged && !isApprover) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看该审批实例' });
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
