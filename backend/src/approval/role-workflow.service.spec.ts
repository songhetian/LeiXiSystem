import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoleWorkflowService } from './role-workflow.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  role: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  approvalWorkflow: {
    findUnique: jest.fn(),
  },
  roleWorkflow: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
  },
};

describe('RoleWorkflowService 职责授权', () => {
  let service: RoleWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoleWorkflowService(mockPrisma as unknown as PrismaService);
  });

  describe('listRoleWorkflows - 列出角色及其绑定流程', () => {
    it('返回每个角色的绑定流程信息（未绑定为 null）', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        { id: 1, code: 'admin', name: '超管', description: null, workflow: null },
        {
          id: 2,
          code: 'manager',
          name: '主管',
          description: null,
          workflow: { workflowId: 10, workflow: { name: '报销流程', status: 'active' } },
        },
      ]);

      const result = await service.listRoleWorkflows();

      expect(result).toEqual([
        { id: 1, code: 'admin', name: '超管', description: null, workflowId: null, workflowName: null, workflowStatus: null },
        {
          id: 2,
          code: 'manager',
          name: '主管',
          description: null,
          workflowId: 10,
          workflowName: '报销流程',
          workflowStatus: 'active',
        },
      ]);
      expect(mockPrisma.role.findMany).toHaveBeenCalled();
    });
  });

  describe('setRoleWorkflow - 绑定/解除角色流程', () => {
    it('角色不存在时抛出 NotFoundException', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.setRoleWorkflow(99, 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockPrisma.roleWorkflow.upsert).not.toHaveBeenCalled();
    });

    it('绑定的流程不存在时抛出 NotFoundException', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue(null);

      await expect(service.setRoleWorkflow(1, 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('绑定的流程未启用时抛出 BadRequestException', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({
        id: 10,
        status: 'draft',
      });

      await expect(service.setRoleWorkflow(1, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('绑定有效流程时 upsert', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({
        id: 10,
        status: 'active',
      });
      mockPrisma.roleWorkflow.upsert.mockResolvedValue({});

      const result = await service.setRoleWorkflow(1, 10);

      expect(mockPrisma.roleWorkflow.upsert).toHaveBeenCalledWith({
        where: { roleId: 1 },
        update: { workflowId: 10 },
        create: { roleId: 1, workflowId: 10 },
      });
      expect(result).toEqual({ success: true });
    });

    it('workflowId 为 null 时解除绑定（删除）', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.roleWorkflow.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.setRoleWorkflow(1, null);

      expect(mockPrisma.roleWorkflow.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 1 },
      });
      expect(mockPrisma.roleWorkflow.upsert).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('resolveWorkflowForUser - 按申请人角色解析绑定流程', () => {
    it('无绑定流程时返回 null', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        { role: { workflow: null } },
      ]);

      expect(await service.resolveWorkflowForUser(1)).toBeNull();
    });

    it('返回首个角色绑定的已激活流程', async () => {
      const workflow = {
        id: 10,
        code: 'reimburse',
        name: '报销流程',
        status: 'active',
        deletedAt: null,
      };
      mockPrisma.userRole.findMany.mockResolvedValue([
        { role: { workflow: { workflow } } },
      ]);

      expect(await service.resolveWorkflowForUser(1)).toEqual(workflow);
    });

    it('跳过未激活或已删除的绑定流程', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            workflow: { workflow: { id: 1, status: 'draft', deletedAt: null } },
          },
        },
        {
          role: {
            workflow: {
              workflow: { id: 2, status: 'active', deletedAt: new Date() },
            },
          },
        },
        {
          role: {
            workflow: {
              workflow: { id: 3, status: 'active', deletedAt: null },
            },
          },
        },
      ]);

      expect((await service.resolveWorkflowForUser(1))?.id).toBe(3);
    });
  });
});