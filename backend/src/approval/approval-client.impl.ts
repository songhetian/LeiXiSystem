import { Injectable } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApprovalClientInterface,
  ApprovalSubmissionTopItem,
  ApprovalTodoTopItem,
} from './approval-client.interface';

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

    // 按业务码取在途实例（instance.workflowCode 就是发起时的业务码，见 startInstance），
    // 再拿**每个实例自己的 workflowId** 去解析节点。
    // 不能用业务码反查流程定义：该业务未配置流程、走角色兜底时 workflowId 指向的是
    // 兜底流程（如 leave），按 code 查 reimbursement 会查不到流程 → 待办恒为空。
    const pendingInstances = await this.prisma.approvalInstance.findMany({
      where: { status: 'pending', workflowCode },
      select: { id: true, workflowId: true, currentNodeKey: true },
    });
    if (pendingInstances.length === 0) return [];

    const workflowIds = Array.from(new Set(pendingInstances.map((i) => i.workflowId)));
    const roleNodes = await this.prisma.approvalWorkflowNode.findMany({
      where: { workflowId: { in: workflowIds }, type: 'role', roleCode: { in: roleCodes } },
      select: { workflowId: true, id: true, nodeKey: true },
    });
    if (roleNodes.length === 0) return [];

    // 必须叠加「实例当前节点 = 本节点」：建实例时链上所有节点的记录都是 pending，
    // 只按节点角色匹配会把后置节点的审批人提前算成当前待办人
    // （列表里出现轮到别人处理的单据，点同意又被 currentNodeKey 校验挡回 403）。
    // 节点键按「流程 + 节点」组合，避免不同流程的同名 nodeKey 串到一起。
    const approvable = new Set(roleNodes.map((n) => `${n.workflowId}:${n.nodeKey ?? n.id}`));
    return pendingInstances
      .filter((i) => approvable.has(`${i.workflowId}:${i.currentNodeKey ?? ''}`))
      .map((i) => i.id);
  }

  async countPendingForUser(userId: number): Promise<number> {
    return this.approvalService.countPendingTodos(userId);
  }

  /** 首页待办卡片：复用 listTodos（buildTodoWhere 同口径），投影为最小字段集 */
  async listTodoTop(userId: number, take: number): Promise<ApprovalTodoTopItem[]> {
    const { list } = await this.approvalService.listTodos(userId, { page: 1, pageSize: take });
    return list.map((r) => ({
      id: r.id,
      instanceId: r.instanceId,
      title: r.title,
      createdAt: r.createdAt,
    }));
  }

  /** 首页「我的申请」卡片：复用 listMySubmissions，投影为最小字段集 */
  async listMySubmissionsTop(
    userId: number,
    take: number,
  ): Promise<ApprovalSubmissionTopItem[]> {
    const { list } = await this.approvalService.listMySubmissions(userId, {
      page: 1,
      pageSize: take,
    });
    return list.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}
