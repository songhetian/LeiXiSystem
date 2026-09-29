import { Injectable } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalClientInterface } from './approval-client.interface';

/**
 * ApprovalClientImpl — concrete implementation of ApprovalClientInterface.
 *
 * Delegates startInstance / approve / reject to the existing ApprovalService,
 * and provides getInstanceStatus / listPendingForUser via Prisma read queries
 * so that consumer modules never touch the approvalInstance table directly.
 */
@Injectable()
export class ApprovalClientImpl implements ApprovalClientInterface {
  constructor(
    private readonly approvalService: ApprovalService,
    private readonly prisma: PrismaService,
  ) {}

  async startInstance(params: {
    workflowCode: string;
    title: string;
    formData?: Record<string, any>;
    userId: number;
    userName: string;
    departmentId?: number;
  }): Promise<{ id: number; status: string; [key: string]: any }> {
    return this.approvalService.startInstance(params);
  }

  async approve(params: {
    instanceId: number;
    userId: number;
    userName: string;
    comment?: string;
  }): Promise<{ status: string; [key: string]: any }> {
    return this.approvalService.approve(params);
  }

  async reject(params: {
    instanceId: number;
    userId: number;
    userName: string;
    comment?: string;
  }): Promise<void> {
    await this.approvalService.reject(params);
  }

  async withdraw(params: {
    instanceId: number;
    userId: number;
    reason?: string;
  }): Promise<void> {
    await this.approvalService.withdraw(params);
  }

  async getInstanceStatus(
    instanceId: number,
  ): Promise<{ status: string; id: number; [key: string]: any } | null> {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        status: true,
        currentNodeKey: true,
        workflowId: true,
      },
    });
    return instance;
  }

  async listPendingForUser(
    userId: number,
    workflowCode: string,
  ): Promise<number[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const roleCodes = userRoles.map((ur) => ur.role.code);

    if (roleCodes.length === 0) return [];

    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { code: workflowCode },
      select: { id: true },
    });
    if (!workflow) return [];

    const roleNodes = await this.prisma.approvalWorkflowNode.findMany({
      where: { workflowId: workflow.id, type: 'role', roleCode: { in: roleCodes } },
      select: { id: true, nodeKey: true },
    });
    if (roleNodes.length === 0) return [];
    const nodeKeys = roleNodes.map((n) => n.nodeKey || String(n.id));

    // 必须叠加「实例当前节点 = 本节点」：建实例时链上所有节点的记录都是 pending，
    // 只按节点角色匹配会把后置节点的审批人提前算成当前待办人
    // （列表里出现轮到别人处理的单据，点同意又被 currentNodeKey 校验挡回 403）。
    const pendingInstances = await this.prisma.approvalInstance.findMany({
      where: {
        status: 'pending',
        workflowCode,
        currentNodeKey: { in: nodeKeys },
      },
      select: { id: true },
    });

    return pendingInstances.map((i) => i.id);
  }

  async countPendingForUser(userId: number): Promise<number> {
    return this.approvalService.countPendingTodos(userId);
  }
}
