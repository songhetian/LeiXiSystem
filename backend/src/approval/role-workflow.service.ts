import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';

/** 批量写入方式：覆盖整组角色 / 只追加 / 只移除选中角色 */
export type RoleBindMode = 'replace' | 'append' | 'remove';

/**
 * 职责授权：管理「审批流程 ↔ 适用角色」（`role_workflows`）。
 *
 * 方向是 **流程 → 角色**：一条流程适用于哪些角色，而不是「一个角色绑哪条流程」。
 * 同一条角色可以出现在多条流程里（请假、加班、报销各自适用「普通员工」是常态），
 * 页面因此可以「一键把同一组角色套用到全部流程」。
 *
 * 发起审批时的解析口径（ADR-0020 + ADR-0024 + ADR-0025）：
 * 1. 业务编码已配置流程 → 用业务配置的那条（职责授权不覆盖，避免跨业务串流）；
 * 2. 业务未配置流程 → 按申请人角色找绑定的启用流程兜底，按 workflowId 升序取第一条；
 * 3. 都没有 → 报「审批流不存在」。
 *
 * 第 2 步的「取第一条」是显式的确定性规则（不是随机）：兜底只在业务未配置流程时触发，
 * 且此处按 id 升序 + take 1，同一申请重复发起始终落到同一条流程。
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
   * 这里**不做**「同一 module 内一个角色只能绑一条流程」的拦截：那条约束会让
   * 「一键把同一组角色套用到全部流程」永远失败（考勤 4 条、员工事务 6 条流程
   * 同属一个 module），而它想防的「随机解析」其实已经由
   * `resolveWorkflowForUser` 的 orderBy workflowId + take 1 固化成确定性规则。
   */
  async setWorkflowRoles(workflowId: number, roleIds: number[]) {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId, deletedAt: null },
      select: { id: true },
    });
    if (!workflow) {
      throw new NotFoundException({
        code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND,
        message: '审批流程不存在',
      });
    }

    const uniqueRoleIds = await this.normalizeAndAssertRoles(roleIds);

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
   * 批量设置多条流程的适用角色（页面「批量设置 / 一键全部覆盖」的落点）。
   *
   * 做成一个事务而不是前端循环调单条接口：13 条流程各发一次请求时，
   * 中途失败会留下一半流程是新角色、一半是旧角色，管理员无从判断该重试哪些；
   * 且每次都要跑一遍角色校验，N 次往返叠加后点一次「保存」要等好几秒。
   *
   * `remove` 只删「这批流程 × 这批角色」的交集，不会误清其它角色的绑定。
   */
  async setRolesForWorkflows(params: {
    workflowIds: number[];
    roleIds: number[];
    mode: RoleBindMode;
  }) {
    const mode = params.mode;
    if (mode !== 'replace' && mode !== 'append' && mode !== 'remove') {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: '批量设置方式无效',
        detail: '只支持覆盖、追加、移除三种方式',
      });
    }

    const workflowIds = this.normalizeIds(params.workflowIds);
    if (workflowIds.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: '请先选择要设置的流程',
        detail: '未指定流程时批量设置会作用到全库，已拦截',
      });
    }

    const roleIds = this.normalizeIds(params.roleIds);
    if (mode !== 'replace' && roleIds.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: mode === 'remove' ? '请选择要移除的角色' : '请选择要添加的角色',
        detail: mode === 'remove' ? '移除方式必须指明角色，否则等同于清空' : '追加方式必须指明角色',
      });
    }

    const found = await this.prisma.approvalWorkflow.findMany({
      where: { id: { in: workflowIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== workflowIds.length) {
      throw new NotFoundException({
        code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND,
        message: '审批流程不存在',
        detail: `有 ${workflowIds.length - found.length} 条流程已被删除，请刷新后重试`,
      });
    }

    // replace 允许空集合（= 清空这批流程的全部角色），其余两种方式上面已拦掉空集合
    const uniqueRoleIds = await this.normalizeAndAssertRoles(roleIds);

    const rows = workflowIds.flatMap((workflowId) =>
      uniqueRoleIds.map((roleId) => ({ workflowId, roleId })),
    );

    await this.prisma.$transaction(async (tx) => {
      if (mode === 'replace') {
        await tx.roleWorkflow.deleteMany({ where: { workflowId: { in: workflowIds } } });
        if (rows.length > 0) {
          await tx.roleWorkflow.createMany({ data: rows, skipDuplicates: true });
        }
        return;
      }
      if (mode === 'append') {
        await tx.roleWorkflow.createMany({ data: rows, skipDuplicates: true });
        return;
      }
      await tx.roleWorkflow.deleteMany({
        where: { workflowId: { in: workflowIds }, roleId: { in: uniqueRoleIds } },
      });
    });

    return {
      success: true,
      workflowCount: workflowIds.length,
      roleCount: uniqueRoleIds.length,
    };
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

  /** 去重 + 过滤非正整数：接口是公开边界，前端多选理论上不会给脏数据 */
  private normalizeIds(ids: number[] | undefined | null): number[] {
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
  }

  private async assertRolesExist(roleIds: number[]) {
    if (roleIds.length === 0) return;
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException({
        code: ERROR_CODES.SYSTEM_ROLE_NOT_FOUND,
        message: '角色不存在',
      });
    }
  }

  private async normalizeAndAssertRoles(roleIds: number[] | undefined | null) {
    const unique = this.normalizeIds(roleIds);
    await this.assertRolesExist(unique);
    return unique;
  }
}
