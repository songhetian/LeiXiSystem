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
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

describe('RoleWorkflowService 职责授权（流程 → 角色）', () => {
  let service: RoleWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
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

    it('角色已绑定同模块的另一条启用流程时，点名冲突且不写入', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 102, module: 'attendance' });
      mockPrisma.role.findMany.mockResolvedValue([{ id: 207 }]);
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([
        { role: { name: '普通员工' }, workflow: { name: '请假审批' } },
      ]);

      await expect(service.setWorkflowRoles(102, [207])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // 文案要能让管理员直接找到该改哪一行，而不是只说「保存失败」
      await expect(service.setWorkflowRoles(102, [207])).rejects.toMatchObject({
        response: {
          code: 6317,
          detail: '「普通员工」已绑定「请假审批」，请先在对应流程中取消该角色',
        },
      });
      expect(mockPrisma.roleWorkflow.deleteMany).not.toHaveBeenCalled();
    });

    it('冲突检查只看启用的同模块流程（停用的历史绑定不阻塞保存）', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 102, module: 'attendance' });
      mockPrisma.role.findMany.mockResolvedValue([{ id: 207 }]);
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([]);

      await service.setWorkflowRoles(102, [207]);

      expect(mockPrisma.roleWorkflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowId: { not: 102 },
            workflow: { module: 'attendance', status: 'active', deletedAt: null },
          }),
        }),
      );
    });

    it('保存时先清空该流程的旧绑定再写入新集合（覆盖式，不是增量）', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ id: 101, module: 'attendance' });
      mockPrisma.role.findMany.mockResolvedValue([{ id: 205 }, { id: 207 }]);
      mockPrisma.roleWorkflow.findMany.mockResolvedValue([]);

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
      // 多个角色都绑定同模块时结果必须稳定，否则同一张单刷新两次可能走不同审批链
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
