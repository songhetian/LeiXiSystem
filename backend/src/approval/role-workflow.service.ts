import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';

/**
 * 职责授权：管理「角色 ↔ 审批流程」绑定。
 *
 * 参考旧项目 `RoleWorkflowConfig` / `role_workflows` 表：角色可显式绑定一个已启用的
 * 审批流，未绑定的角色走通用/默认流程。发起审批时按申请人角色优先解析绑定流程。
 */
@Injectable()
export class RoleWorkflowService {
  constructor(private prisma: PrismaService) {}

  /** 角色 + 绑定流程列表（未绑定为 null） */
  async listRoleWorkflows() {
    const roles = await this.prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        workflow: { include: { workflow: true } },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      workflowId: r.workflow?.workflowId ?? null,
      workflowName: r.workflow?.workflow?.name ?? null,
      workflowStatus: r.workflow?.workflow?.status ?? null,
    }));
  }

  /** 绑定/解除角色流程（workflowId = null 解除绑定走默认流程） */
  async setRoleWorkflow(roleId: number, workflowId: number | null) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException({
        code: ERROR_CODES.SYSTEM_ROLE_NOT_FOUND,
        message: '角色不存在',
      });
    }

    if (workflowId !== null) {
      const workflow = await this.prisma.approvalWorkflow.findUnique({
        where: { id: workflowId, deletedAt: null },
      });
      if (!workflow) {
        throw new NotFoundException({
          code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND,
          message: '审批流程不存在',
        });
      }
      if (workflow.status !== 'active') {
        throw new BadRequestException({
          code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_ACTIVE,
          message: '只能绑定已启用的审批流程',
        });
      }

      await this.prisma.roleWorkflow.upsert({
        where: { roleId },
        update: { workflowId },
        create: { roleId, workflowId },
      });
    } else {
      await this.prisma.roleWorkflow.deleteMany({ where: { roleId } });
    }

    return { success: true };
  }

  /**
   * 解析申请人角色绑定的首个已激活流程。
   * 未绑定或绑定流程不可用时返回 null（走通用流程）。
   */
  async resolveWorkflowForUser(userId: number) {
    const bindings = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: { workflow: { include: { workflow: true } } },
        },
      },
    });

    for (const ur of bindings) {
      const workflow = ur.role.workflow?.workflow;
      if (workflow && workflow.status === 'active' && !workflow.deletedAt) {
        return workflow;
      }
    }
    return null;
  }
}