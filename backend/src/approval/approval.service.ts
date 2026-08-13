import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildApprovalChain, type WorkflowNode, type RoutingContext } from './engine/routing-engine';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  // ===== 审批流配置 =====
  async listWorkflows(module?: string) {
    const where: any = {};
    if (module) where.module = module;
    return this.prisma.approvalWorkflow.findMany({
      where,
      include: { nodes: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'asc' },
    });
  }

  async createWorkflow(params: {
    code: string;
    name: string;
    module: string;
    status?: string;
    nodes: Array<{
      nodeKey: string;
      name: string;
      type: string;
      roleCode?: string;
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
          nodes: {
            create: params.nodes.map((n) => ({
              nodeKey: n.nodeKey,
              name: n.name,
              type: n.type,
              roleCode: n.roleCode,
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

  // ===== 发起审批 =====
  async startInstance(params: {
    workflowCode: string;
    title: string;
    formData?: Record<string, any>;
    userId: number;
    userName: string;
    departmentId?: number;
  }) {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { code: params.workflowCode },
      include: { nodes: { orderBy: { order: 'asc' } } },
    });
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

    const ctx: RoutingContext = {
      applicantDepartmentId: params.departmentId || 0,
      applicantRoleCodes: [],
      formData: params.formData || {},
    };
    const chain = buildApprovalChain(engineNodes, ctx);
    if (chain.length === 0) {
      throw new BadRequestException({ code: 6304, message: '没有可用的审批节点' });
    }

    const firstNode = chain[0];
    const firstNodeEntity = workflow.nodes.find((n) => n.nodeKey === firstNode.nodeKey);

    try {
      return this.prisma.$transaction(async (tx) => {
        const instance = await tx.approvalInstance.create({
          data: {
            workflowId: workflow.id,
            workflowCode: workflow.code,
            title: params.title,
            applicantId: params.userId,
            applicantName: user.name,
            departmentId: params.departmentId,
            formData: params.formData ? JSON.stringify(params.formData) : undefined,
            status: 'pending',
            currentNodeKey: firstNode.nodeKey,
            currentNodeName: firstNode.nodeName,
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

  private async handleApproval(
    params: {
      instanceId: number;
      userId: number;
      userName: string;
      comment?: string;
    },
    action: 'approved' | 'rejected',
  ) {
    const instance = await this.prisma.approvalInstance.findUnique({
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
    if (!canApprove) {
      throw new ForbiddenException({ code: 5003, message: '无审批权限' });
    }

    const approver = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!approver) {
      throw new NotFoundException({ code: 6308, message: '用户不存在' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.approvalRecord.update({
        where: { id: currentRecord.id },
        data: {
          status: action,
          approverId: params.userId,
          approverName: approver.name,
          comment: params.comment,
          handledAt: new Date(),
        },
      });

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
    return false;
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

  // ===== 审批详情 =====
  async getInstanceDetail(id: number) {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id },
      include: {
        records: { orderBy: { order: 'asc' } },
      },
    });
    if (!instance) {
      throw new NotFoundException({ code: 6305, message: '审批实例不存在' });
    }
    return instance;
  }
}
