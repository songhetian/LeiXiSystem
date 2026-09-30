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
    // 重提改为 CAS：状态 + 次数上限在同一条 updateMany 里条件判定
    updateMany: jest.fn(),
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
  removeByRelated: jest.fn(),
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
    // 默认 CAS 抢占成功（需要模拟并发超限的用例单独覆写为 { count: 0 }）
    mockPrisma.approvalInstance.updateMany.mockResolvedValue({ count: 1 });
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
      // 6305 = APPROVAL_RESUBMIT_LIMIT（原误用 6312「审批实例状态无效」，
      // 中央文案会把提示覆盖成「审批实例状态无效」，用户看不到真正的超限原因）
      expect(e.response.code).toBe(6305);
      expect(e.response.message).toContain('3 次');
    }
  });

  it('当 resubmitCount 小于 maxResubmits 时可以重新提交', async () => {
    mockPrisma.approvalInstance.findUnique.mockResolvedValue(mockInstance(2, 'rejected'));
    mockPrisma.department.findMany.mockResolvedValue([]);
    mockPrisma.approvalRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalRecord.createMany.mockResolvedValue({ count: 3 });

    const result = await approvalService.resubmit({ instanceId: 1, userId: 1 });
    expect(result).toBeDefined();
    expect(mockPrisma.approvalInstance.updateMany).toHaveBeenCalled();
  });

  it('重新提交时 resubmitCount 递增', async () => {
    mockPrisma.approvalInstance.findUnique.mockResolvedValue(mockInstance(0, 'rejected'));
    mockPrisma.department.findMany.mockResolvedValue([]);
    mockPrisma.approvalRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalRecord.createMany.mockResolvedValue({ count: 3 });

    await approvalService.resubmit({ instanceId: 1, userId: 1 });

    const updateArgs = mockPrisma.approvalInstance.updateMany.mock.calls[0][0] as any;
    expect(updateArgs.data.resubmitCount).toEqual({ increment: 1 });
  });

  it('重新提交后必须重新通知首个审批节点的审批人，否则审批将无人处理', async () => {
    mockPrisma.approvalInstance.findUnique.mockResolvedValue(mockInstance(0, 'rejected'));
    mockPrisma.department.findMany.mockResolvedValue([]);
    mockPrisma.approvalRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.approvalRecord.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.approvalWorkflowNode.findUnique.mockResolvedValue({
      id: 2,
      nodeKey: 'approve1',
      type: 'role',
      roleCode: 'approver',
    });
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 9 }]);
    mockNotificationService.createMany.mockResolvedValue({ count: 1 });

    await approvalService.resubmit({ instanceId: 1, userId: 1 });

    expect(mockPrisma.approvalWorkflowNode.findUnique).toHaveBeenCalledWith({
      where: { workflowId_nodeKey: { workflowId: 1, nodeKey: 'approve1' } },
    });
    expect(mockNotificationService.createMany).toHaveBeenCalledWith(
      [9],
      expect.objectContaining({
        type: 'approval',
        relatedId: 1,
        relatedType: 'approval_instance',
      }),
    );
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
