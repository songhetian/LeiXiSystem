import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';

/**
 * 职责授权：管理「审批流程 ↔ 适用角色」（`role_workflows`）。
 *
 * 方向是 **流程 → 角色**：一条流程适用于哪些角色，而不是「一个角色绑哪条流程」。
 * 前者才能表达「请假流程适用于员工+主管」「报销流程适用于员工」这类事实，
 * 而后者受主键 `(workflow_id, role_id)` 支持的多对多关系约束：
 * 同一个角色可以在请假、报销等不同模块各绑一条流程。
 *
 * 发起审批时的解析口径（ADR-0020 + ADR-0024）：
 * 1. 业务编码已配置流程 → 用业务配置的那条（职责授权不覆盖，避免跨业务串流）；
 * 2. 业务未配置流程 → 按申请人角色在**同一 module** 内找绑定的启用流程兜底；
 * 3. 都没有 → 报「审批流不存在」。
 */
@Injectable()
export class RoleWorkflowService {
  constructor(private prisma: PrismaService) {}

  /** 可分配角色（页面多选、审批节点「按角色审批」下拉共用） */
  async listAssignableRoles() {
    return this.prisma.role.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  /** 流程 + 各自适用的角色（`roles` 为空表示该流程还没绑定任何角色） */
  async listWorkflowBindings() {
    const [workflows, roles] = await Promise.all([
      this.prisma.approvalWorkflow.findMany({
        where: { deletedAt: null },
        // 按业务模块聚合展示：同模块的流程在页面上相邻，便于看出「这组角色在这组业务上的分工」
        orderBy: [{ module: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          module: true,
          status: true,
          roleBindings: {
            select: { role: { select: { id: true, code: true, name: true } } },
            orderBy: { roleId: 'asc' },
          },
        },
      }),
      this.listAssignableRoles(),
    ]);

    return {
      roles,
      workflows: workflows.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        module: w.module,
        status: w.status,
        roles: w.roleBindings.map((b) => b.role),
      })),
    };
  }

  /**
   * 覆盖式保存某条流程的适用角色（传空数组 = 该流程不绑定任何角色）。
   *
   * 同一 module 内一个角色只允许绑一条流程：否则发起审批时哪条都「匹配」，
   * 结果取决于查询顺序，配置看起来生效了实际随机。冲突时点名冲突的角色与流程，
   * 让管理员知道该去改哪一行，而不是只丢一句「保存失败」。
   */
  async setWorkflowRoles(workflowId: number, roleIds: number[]) {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId, deletedAt: null },
      select: { id: true, module: true },
    });
    if (!workflow) {
      throw new NotFoundException({
        code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND,
        message: '审批流程不存在',
      });
    }

    // 去重 + 过滤非法值：前端多选理论上不会给脏数据，但接口是公开边界
    const uniqueRoleIds = Array.from(new Set(roleIds)).filter(
      (id) => Number.isInteger(id) && id > 0,
    );

    if (uniqueRoleIds.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: uniqueRoleIds } },
        select: { id: true },
      });
      if (roles.length !== uniqueRoleIds.length) {
        throw new NotFoundException({
          code: ERROR_CODES.SYSTEM_ROLE_NOT_FOUND,
          message: '角色不存在',
        });
      }

      // 只把「启用的同模块流程」算作冲突：停用流程本来就不参与解析，
      // 阻止保存只会让管理员没法清理历史绑定
      const conflicts = await this.prisma.roleWorkflow.findMany({
        where: {
          roleId: { in: uniqueRoleIds },
          workflowId: { not: workflowId },
          workflow: { module: workflow.module, status: 'active', deletedAt: null },
        },
        select: {
          role: { select: { name: true } },
          workflow: { select: { name: true } },
        },
      });
      if (conflicts.length > 0) {
        const detail = `${conflicts
          .map((c) => `「${c.role.name}」已绑定「${c.workflow.name}」`)
          .join('、')}，请先在对应流程中取消该角色`;
        // 明细走 detail：异常过滤器会拼成「中央文案（明细）」，既统一文案又点出该改哪一行
        throw new BadRequestException({
          code: ERROR_CODES.APPROVAL_ROLE_WORKFLOW_CONFLICT,
          message: '同一业务下每个角色只能绑定一条流程',
          detail,
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.roleWorkflow.deleteMany({ where: { workflowId } }),
      this.prisma.roleWorkflow.createMany({
        data: uniqueRoleIds.map((roleId) => ({ workflowId, roleId })),
        skipDuplicates: true,
      }),
    ]);

    return { success: true, roleCount: uniqueRoleIds.length };
  }

  /**
   * 解析申请人角色绑定的启用流程（业务未配置流程时兜底）。
   * 未绑定或绑定流程不可用时返回 null（走调用方的默认流程/报错）。
   *
   * `module` 用于限制兜底范围：只有与请求业务同 module 的绑定流程才可用，
   * 避免绑定流程跨业务串流（ADR-0020）。不传则不限制。
   */
  async resolveWorkflowForUser(userId: number, options: { module?: string } = {}) {
    const bindings = await this.prisma.roleWorkflow.findMany({
      where: {
        role: { users: { some: { userId } } },
        workflow: {
          status: 'active',
          deletedAt: null,
          ...(options.module ? { module: options.module } : {}),
        },
      },
      select: { workflow: true },
      // 一个用户有多个角色且都绑定同模块时取 id 最小的一条：
      // 结果必须稳定，否则同一个申请刷新两次可能落到不同审批链
      orderBy: { workflowId: 'asc' },
      take: 1,
    });

    return bindings[0]?.workflow ?? null;
  }
}
