import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../common/redis/redis.service';
import { RoleWorkflowService } from './role-workflow.service';

function buildService(): any {
  const mockPrisma: any = {
    user: { findUnique: jest.fn() },
    approvalWorkflow: { findUnique: jest.fn() },
    department: { findMany: jest.fn() },
    approvalInstance: { create: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  const mockNotificationService: any = { create: jest.fn(), createMany: jest.fn() };
  const mockEventEmitter: any = { emit: jest.fn() };
  const mockRedis: any = { isEnabled: false, get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const roleWorkflowService: any = { resolveWorkflowForUser: jest.fn() };

  const svc = new ApprovalService(
    mockPrisma as unknown as PrismaService,
    mockNotificationService as unknown as NotificationService,
    mockEventEmitter as unknown as EventEmitter2,
    mockRedis as unknown as RedisService,
    roleWorkflowService as unknown as RoleWorkflowService,
  );
  return { prisma: mockPrisma, roleWorkflowService, svc };
}

describe('ApprovalService.startInstance 职责授权解析', () => {
  let prisma: any;
  let roleWorkflowService: any;
  let svc: ApprovalService;

  const baseWorkflow = {
    id: 2,
    code: 'bound_flow',
    name: '角色绑定流程',
    module: 'reimbursement',
    status: 'active',
    maxResubmits: 3,
    nodes: [
      { id: 1, nodeKey: 'start', name: '开始', type: 'start', order: 0 },
      { id: 2, nodeKey: 'a', name: '审批', type: 'role', roleCode: 'approver', order: 1 },
      { id: 3, nodeKey: 'end', name: '结束', type: 'end', order: 2 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildService();
    prisma = built.prisma;
    roleWorkflowService = built.roleWorkflowService;
    svc = built.svc;
  });

  it('业务已配置流程时，即使角色绑定了流程也使用业务配置的流程（ADR-0020）', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
    roleWorkflowService.resolveWorkflowForUser.mockResolvedValue({
      id: 2,
      code: 'leave',
      module: 'attendance',
      status: 'active',
      deletedAt: null,
    });
    prisma.approvalWorkflow.findUnique.mockResolvedValue({
      ...baseWorkflow,
      code: 'reimbursement',
    });
    prisma.department.findMany.mockResolvedValue([]);
    prisma.approvalInstance.create.mockResolvedValue({ id: 10 });

    await svc.startInstance({
      workflowCode: 'reimbursement',
      title: '报销申请',
      userId: 1,
      userName: '',
    });

    // 业务配置优先：既不查询职责授权，也不会去取绑定流程（避免跨业务串流）
    expect(roleWorkflowService.resolveWorkflowForUser).not.toHaveBeenCalled();
    const callArgs = prisma.approvalWorkflow.findUnique.mock.calls[0][0] as any;
    expect(callArgs.where.code).toBe('reimbursement');
  });

  it('业务未配置流程时，用同 module 的角色绑定流程兜底，并携带 module 过滤条件', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
    roleWorkflowService.resolveWorkflowForUser.mockResolvedValue({
      id: 2,
      code: 'bound_flow',
      module: 'reimbursement',
      status: 'active',
      deletedAt: null,
    });
    prisma.approvalWorkflow.findUnique
      .mockResolvedValueOnce(null) // 请求的 reimbursement 未配置
      .mockResolvedValueOnce(baseWorkflow); // 绑定流程存在
    prisma.department.findMany.mockResolvedValue([]);
    prisma.approvalInstance.create.mockResolvedValue({ id: 10 });

    await svc.startInstance({
      workflowCode: 'reimbursement',
      title: '报销申请',
      userId: 1,
      userName: '',
    });

    expect(roleWorkflowService.resolveWorkflowForUser).toHaveBeenCalledWith(1, {
      module: 'reimbursement',
    });
    const calls = prisma.approvalWorkflow.findUnique.mock.calls as any[];
    expect(calls[0][0].where.code).toBe('reimbursement');
    expect(calls[1][0].where.code).toBe('bound_flow');
  });

  it('申请人角色无绑定流程时，使用入参流程编码', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
    roleWorkflowService.resolveWorkflowForUser.mockResolvedValue(null);
    prisma.approvalWorkflow.findUnique.mockResolvedValue({
      ...baseWorkflow,
      code: 'other_flow',
    });
    prisma.department.findMany.mockResolvedValue([]);
    prisma.approvalInstance.create.mockResolvedValue({ id: 10 });

    await svc.startInstance({
      workflowCode: 'other_flow',
      title: '报销申请',
      userId: 1,
      userName: '',
    });

    const callArgs = prisma.approvalWorkflow.findUnique.mock.calls[0][0] as any;
    expect(callArgs.where.code).toBe('other_flow');
  });
});