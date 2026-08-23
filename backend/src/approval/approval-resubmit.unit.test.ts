import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../common/redis/redis.service';

const mockPrisma: any = {
  approvalInstance: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  approvalRecord: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  approvalWorkflow: {
    findUnique: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  approvalWorkflowNode: {
    findUnique: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
  },
  employee: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockNotificationService: any = {
  create: jest.fn(),
  createMany: jest.fn(),
};

const mockEventEmitter: any = {
  emit: jest.fn(),
};

const mockRedis: any = {
  isEnabled: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('ApprovalService resubmit 次数限制', () => {
  let approvalService: ApprovalService;

  beforeEach(() => {
    jest.clearAllMocks();
    approvalService = new ApprovalService(
      mockPrisma as unknown as PrismaService,
      mockNotificationService as unknown as NotificationService,
      mockEventEmitter as unknown as EventEmitter2,
      mockRedis as unknown as RedisService,
    );
  });

  const mockWorkflow = {
    id: 1,
    code: 'test',
    name: '测试审批流',
    module: 'test',
    status: 'active',
    maxResubmits: 3,
    nodes: [
      { id: 1, nodeKey: 'start', name: '开始', type: 'start', order: 0 },
      { id: 2, nodeKey: 'approve1', name: '审批', type: 'role', roleCode: 'approver', order: 1 },
      { id: 3, nodeKey: 'end', name: '结束', type: 'end', order: 2 },
    ],
  };

  const mockInstance = (resubmitCount: number, status: string = 'rejected') => ({
    id: 1,
    workflowId: 1,
    workflowCode: 'test',
    title: '测试申请',
    applicantId: 1,
    applicantName: '测试人',
    departmentId: 1,
    formData: JSON.stringify({ reason: 'test' }),
    status,
    currentNodeKey: null,
    currentNodeName: null,
    resubmitCount,
    workflow: mockWorkflow,
    records: [],
  });

  it('当 resubmitCount 达到 maxResubmits 时抛出错误', async () => {
    mockPrisma.approvalInstance.findUnique.mockResolvedValue(mockInstance(3, 'rejected'));
    mockPrisma.department.findMany.mockResolvedValue([]);

    await expect(
      approvalService.resubmit({ instanceId: 1, userId: 1 }),
    ).rejects.toThrow(BadRequestException);

    try {
      await approvalService.resubmit({ instanceId: 1, userId: 1 });
    } catch (e: any) {
      expect(e.response.code).toBe(6312);
      expect(e.response.message).toContain('3 次');
    }
  });

  it('当 resubmitCount 小于 maxResubmits 时可以重新提交', async () => {
    mockPrisma.approvalInstance.findUnique.mockResolvedValue(mockInstance(2, 'rejected'));
    mockPrisma.department.findMany.mockResolvedValue([]);
    mockPrisma.approvalRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalRecord.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.approvalInstance.update.mockResolvedValue({ ...mockInstance(2, 'pending'), resubmitCount: 3 });

    const result = await approvalService.resubmit({ instanceId: 1, userId: 1 });
    expect(result).toBeDefined();
    expect(mockPrisma.approvalInstance.update).toHaveBeenCalled();
  });

  it('重新提交时 resubmitCount 递增', async () => {
    mockPrisma.approvalInstance.findUnique.mockResolvedValue(mockInstance(0, 'rejected'));
    mockPrisma.department.findMany.mockResolvedValue([]);
    mockPrisma.approvalRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalRecord.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.approvalInstance.update.mockResolvedValue({ ...mockInstance(0, 'pending'), resubmitCount: 1 });

    await approvalService.resubmit({ instanceId: 1, userId: 1 });

    const updateArgs = mockPrisma.approvalInstance.update.mock.calls[0][0] as any;
    expect(updateArgs.data.resubmitCount).toEqual({ increment: 1 });
  });

  it('不同工作流可有不同的 maxResubmits', async () => {
    const workflowWith5 = { ...mockWorkflow, maxResubmits: 5 };
    mockPrisma.approvalInstance.findUnique.mockResolvedValue({
      ...mockInstance(4, 'rejected'),
      workflow: workflowWith5,
    });
    mockPrisma.department.findMany.mockResolvedValue([]);
    mockPrisma.approvalRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalRecord.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.approvalInstance.update.mockResolvedValue({ ...mockInstance(4, 'pending'), resubmitCount: 5 });

    await expect(
      approvalService.resubmit({ instanceId: 1, userId: 1 }),
    ).resolves.toBeDefined();

    mockPrisma.approvalInstance.findUnique.mockResolvedValue({
      ...mockInstance(5, 'rejected'),
      workflow: workflowWith5,
    });

    await expect(
      approvalService.resubmit({ instanceId: 1, userId: 1 }),
    ).rejects.toThrow(BadRequestException);
  });
});
