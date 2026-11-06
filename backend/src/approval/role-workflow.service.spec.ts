import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoleWorkflowService } from './role-workflow.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  role: { findMany: jest.fn() },
  approvalWorkflow: { findMany: jest.fn(), findUnique: jest.fn() },
  roleWorkflow: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  // 单条保存走数组式事务、批量走回调式事务，两种都要能跑
  $transaction: jest.fn(async (arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma),
  ),
};

describe('RoleWorkflowService 职责授权（流程 → 角色）', () => {
  let service: RoleWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    // 写操作都要读 .count 回来（批量接口会把它当成 affected 返给前端）
    mockPrisma.roleWorkflow.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.roleWorkflow.createMany.mockResolvedValue({ count: 0 });
    service = new RoleWorkflowService(mockPrisma as unknown as PrismaService);
  });

  describe('listWorkflowBindings - 列出流程及其适用角色', () => {
    it('按流程组织，roles 为该流程绑定的角色数组（未绑定为空数组）', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([
        {
          id: 101,
          code: 'leave',
          name: '请假审批',
          module: 'attendance',
          status: 'active',
          roleBindings: [
            { role: { id: 205, code: 'hr', name: 'HR' } },
            { role: { id: 207, code: 'staff', name: '普通员工' } },
          ],
        },
        {
          id: 104,
          code: 'reimbursement',
          name: '报销审批',
          module: 'reimbursement',
          status: 'active',
          roleBindings: [],
        },
      ]);
      mockPrisma.role.findMany.mockResolvedValue([
        { id: 205, code: 'hr', name: 'HR' },
        { id: 206, code: 'admin', name: '管理员' },
        { id: 207, code: 'staff', name: '普通员工' },
      ]);

      const result = await service.listWorkflowBindings();

      expect(result.workflows).toEqual([
        {
          id: 101,
          code: 'leave',
          name: '请假审批',
          module: 'attendance',
          status: 'active',
          roles: [
            { id: 205, code: 'hr', name: 'HR' },
            { id: 207, code: 'staff', name: '普通员工' },
          ],
        },
        {
          id: 104,
          code: 'reimbursement',
          name: '报销审批',
          module: 'reimbursement',
          status: 'active',
          roles: [],
        },
      ]);
      // 角色全集随列表一起下发：页面多选框不必再单独请求 /system/roles（那需要另一套权限）
      expect(result.roles).toHaveLength(3);
      // 只列未删除的流程；按 module 聚合，同模块的流程相邻
      expect(mockPrisma.approvalWorkflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          orderBy: [{ module: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('setWorkflowRoles - 覆盖式保存流程的适用角色', () => {
    it('流程不存在时抛出 NotFoundException', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue(null);

      await expect(service.setWorkflowRoles(999, [1])).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
    });

    it('角色不存在时抛出 NotFoundException', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 101, module: 'attendance' });
      mockPrisma.role.findMany.mockResolvedValue([{ id: 205 }]);

      await expect(service.setWorkflowRoles(101, [205, 999])).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
    });

    it('同一 module 下允许同一角色出现在多条流程里（不再拦截冲突）', async () => {
      // 「普通员工」既走请假审批也走加班审批是常态；旧实现会在这里抛 6317，
      // 导致「一键把同一组角色套用到全部考勤流程」永远失败（ADR-0025）
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 102, module: 'attendance' });
      mockPrisma.role.findMany.mockResolvedValue([{ id: 207 }]);

      const result = await service.setWorkflowRoles(102, [207]);

      expect(result).toEqual({ success: true, roleCount: 1 });
      expect(mockPrisma.roleWorkflow.createMany).toHaveBeenCalledWith({
        data: [{ workflowId: 102, roleId: 207 }],
        skipDuplicates: true,
      });
      // 冲突查询整段删掉了，不该再为它多打一次库
      expect(mockPrisma.roleWorkflow.findMany).not.toHaveBeenCalled();
    });

    it('保存时先清空该流程的旧绑定再写入新集合（覆盖式，不是增量）', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 101, module: 'attendance' });
      mockPrisma.role.findMany.mockResolvedValue([{ id: 205 }, { id: 207 }]);

      const result = await service.setWorkflowRoles(101, [205, 207, 205]);

      expect(mockPrisma.roleWorkflow.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: 101 },
      });
      // 去重后写入
      expect(mockPrisma.roleWorkflow.createMany).toHaveBeenCalledWith({
        data: [
          { workflowId: 101, roleId: 205 },
          { workflowId: 101, roleId: 207 },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ success: true, roleCount: 2 });
    });

    it('传空数组即解除该流程的全部角色（不删除流程本身）', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 101, module: 'attendance' });

      const result = await service.setWorkflowRoles(101, []);

      expect(mockPrisma.roleWorkflow.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: 101 },
      });
      expect(mockPrisma.roleWorkflow.createMany).toHaveBeenCalledWith({
        data: [],
        skipDuplicates: true,
      });
      // 角色列表都不用查
      expect(mockPrisma.role.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, roleCount: 0 });
    });
  });

  describe('setRolesForWorkflows - 批量设置（页面一键覆盖）', () => {
    beforeEach(() => {
      // 存在性校验用「库里有哪几条」的真实口径模拟：请求里带不存在的 id 就少一条
      const knownWorkflows = new Set([101, 102, 104]);
      const knownRoles = new Set([205, 207]);
      mockPrisma.approvalWorkflow.findMany.mockImplementation(async (args: any) =>
        (args?.where?.id?.in ?? [])
          .filter((id: number) => knownWorkflows.has(id))
          .map((id: number) => ({ id })),
      );
      mockPrisma.role.findMany.mockImplementation(async (args: any) =>
        (args?.where?.id?.in ?? [])
          .filter((id: number) => knownRoles.has(id))
          .map((id: number) => ({ id })),
      );
    });

    it('replace：一次事务清空这批流程的旧绑定，再写入流程×角色笛卡尔积', async () => {
      mockPrisma.roleWorkflow.createMany.mockResolvedValue({ count: 6 });

      const result = await service.setRolesForWorkflows({
        workflowIds: [101, 102, 104],
        roleIds: [205, 207],
        mode: 'replace',
      });

      expect(mockPrisma.roleWorkflow.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: { in: [101, 102, 104] } },
      });
      expect(mockPrisma.roleWorkflow.createMany).toHaveBeenCalledWith({
        data: [
          { workflowId: 101, roleId: 205 },
          { workflowId: 101, roleId: 207 },
          { workflowId: 102, roleId: 205 },
          { workflowId: 102, roleId: 207 },
          { workflowId: 104, roleId: 205 },
          { workflowId: 104, roleId: 207 },
        ],
        skipDuplicates: true,
      });
      // affected = 实际写进去的行数，前端拿它出文案（不拿请求参数冒充结果）
      expect(result).toEqual({
        success: true,
        workflowCount: 3,
        roleCount: 2,
        affected: 6,
      });
    });

    it('replace + 空角色：清空这批流程的全部角色（不写空行）', async () => {
      mockPrisma.roleWorkflow.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.setRolesForWorkflows({
        workflowIds: [101, 102],
        roleIds: [],
        mode: 'replace',
      });

      expect(mockPrisma.roleWorkflow.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: { in: [101, 102] } },
      });
      expect(mockPrisma.roleWorkflow.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        workflowCount: 2,
        roleCount: 0,
        affected: 0,
      });
    });

    it('append：只追加，不清空既有绑定', async () => {
      await service.setRolesForWorkflows({
        workflowIds: [101],
        roleIds: [207],
        mode: 'append',
      });

      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.roleWorkflow.createMany).toHaveBeenCalledWith({
        data: [{ workflowId: 101, roleId: 207 }],
        skipDuplicates: true,
      });
    });

    it('remove：只删「这批流程 × 这批角色」的交集，不动其它角色', async () => {
      await service.setRolesForWorkflows({
        workflowIds: [101, 102],
        roleIds: [207],
        mode: 'remove',
      });

      expect(mockPrisma.roleWorkflow.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: { in: [101, 102] }, roleId: { in: [207] } },
      });
      expect(mockPrisma.roleWorkflow.createMany).not.toHaveBeenCalled();
    });

    it('未选择流程时拒绝（避免误清空全库绑定）', async () => {
      await expect(
        service.setRolesForWorkflows({ workflowIds: [], roleIds: [205], mode: 'replace' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
    });

    it('append/remove 未选角色时拒绝', async () => {
      await expect(
        service.setRolesForWorkflows({ workflowIds: [101], roleIds: [], mode: 'append' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.setRolesForWorkflows({ workflowIds: [101], roleIds: [], mode: 'remove' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('流程列表里有已被删除的流程时整体拒绝，并在 detail 里说明差了几条', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([{ id: 101 }]);

      await expect(
        service.setRolesForWorkflows({
          workflowIds: [101, 999],
          roleIds: [205],
          mode: 'replace',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ detail: expect.stringContaining('1 条流程已被删除') }),
      });
      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
    });

    it('角色不存在时整体拒绝，不做半截写入', async () => {
      mockPrisma.role.findMany.mockResolvedValue([{ id: 205 }]);

      await expect(
        service.setRolesForWorkflows({ workflowIds: [101], roleIds: [205, 999], mode: 'append' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.roleWorkflow.createMany).not.toHaveBeenCalled();
    });

    it('方式非法时拒绝', async () => {
      await expect(
        service.setRolesForWorkflows({
          workflowIds: [101],
          roleIds: [205],
          mode: 'merge' as any,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('未指定方式时也拒绝（replace 是破坏性语义，不能靠默认值兜底）', async () => {
      await expect(
        service.setRolesForWorkflows({ workflowIds: [101], roleIds: [205] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.roleWorkflow.createMany).not.toHaveBeenCalled();
    });

    it('id 非法时拒绝，不静默丢弃（丢弃会变成「提示成功但没写进去」）', async () => {
      await expect(
        service.setRolesForWorkflows({
          workflowIds: [101],
          roleIds: [205, '6' as any],
          mode: 'append',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ detail: expect.stringContaining('正整数') }),
      });
      // 0 / 负数同样拒绝
      await expect(
        service.setRolesForWorkflows({ workflowIds: [101, 0], roleIds: [205], mode: 'append' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.roleWorkflow.createMany).not.toHaveBeenCalled();
    });

    it('affected 取实际落库行数：append 跳过已存在的绑定时会小于 流程×角色', async () => {
      // 2 条流程 × 1 个角色，但库里已有 1 条绑定 → 只新增 1 行
      mockPrisma.roleWorkflow.createMany.mockResolvedValue({ count: 1 });

      const result = await service.setRolesForWorkflows({
        workflowIds: [101, 102],
        roleIds: [207],
        mode: 'append',
      });

      expect(result).toMatchObject({ workflowCount: 2, roleCount: 1, affected: 1 });
    });

    it('affected 取实际删除行数：remove 只算真实存在的绑定', async () => {
      mockPrisma.roleWorkflow.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.setRolesForWorkflows({
        workflowIds: [101, 102, 104],
        roleIds: [207],
        mode: 'remove',
      });

      expect(result).toMatchObject({ workflowCount: 3, roleCount: 1, affected: 1 });
    });
  });

  describe('resolveWorkflowForUser - 业务未配置流程时按角色兜底', () => {
    it('无绑定流程时返回 null', async () => {
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([]);

      expect(await service.resolveWorkflowForUser(1)).toBeNull();
    });

    it('返回角色绑定的启用流程', async () => {
      const workflow = {
        id: 10,
        code: 'reimburse',
        name: '报销流程',
        status: 'active',
        deletedAt: null,
      };
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([{ workflow }]);

      expect(await service.resolveWorkflowForUser(1)).toEqual(workflow);
    });

    it('过滤条件下推到数据库：只认启用、未删除、同 module 的流程（ADR-0020）', async () => {
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([]);

      await service.resolveWorkflowForUser(1, { module: 'reimbursement' });

      const args = mockPrisma.roleWorkflow.findMany.mock.calls[0][0] as any;
      expect(args.where.role).toEqual({ users: { some: { userId: 1 } } });
      expect(args.where.workflow).toEqual({
        status: 'active',
        deletedAt: null,
        module: 'reimbursement',
      });
      // 同一角色可能绑了同模块的多条流程（ADR-0025）：结果必须稳定，
      // 否则同一张单刷新两次可能走不同审批链
      expect(args.orderBy).toEqual({ workflowId: 'asc' });
      expect(args.take).toBe(1);
    });

    it('不传 module 时不限制模块', async () => {
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([]);

      await service.resolveWorkflowForUser(1);

      const args = mockPrisma.roleWorkflow.findMany.mock.calls[0][0] as any;
      expect(args.where.workflow).toEqual({ status: 'active', deletedAt: null });
    });
  });
});
