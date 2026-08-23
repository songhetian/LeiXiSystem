import { ApprovalReconcilerService } from './approval-reconciler.service';

const mockPrisma: any = {
  approvalInstance: {
    findMany: jest.fn(),
  },
};

const mockEventEmitter: any = {
  emit: jest.fn(),
};

describe('ApprovalReconcilerService', () => {
  let service: ApprovalReconcilerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApprovalReconcilerService(mockPrisma, mockEventEmitter);
  });

  describe('reconcileRecent', () => {
    it('应扫描最近 N 小时内的终态审批单并重发事件', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        { id: 1, status: 'approved', workflowId: 10, workflowCode: 'reimbursement', workflow: { module: 'reimbursement' }, applicantId: 1, title: '报销申请' },
        { id: 2, status: 'rejected', workflowId: 11, workflowCode: 'onboarding', workflow: { module: 'employees' }, applicantId: 2, title: '入职申请' },
        { id: 3, status: 'cancelled', workflowId: 12, workflowCode: 'leave', workflow: { module: 'leave' }, applicantId: 3, title: '请假申请' },
      ]);

      await service.reconcileRecent(1);

      expect(mockPrisma.approvalInstance.findMany).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(3);

      const calls = mockEventEmitter.emit.mock.calls;
      expect(calls[0][0]).toBe('approval.approved');
      expect(calls[0][1].instanceId).toBe(1);
      expect(calls[0][1].workflowCode).toBe('reimbursement');
      expect(calls[0][1]._reconciled).toBe(true);

      expect(calls[1][0]).toBe('approval.rejected');
      expect(calls[1][1].instanceId).toBe(2);

      expect(calls[2][0]).toBe('approval.withdrawn');
      expect(calls[2][1].instanceId).toBe(3);
    });

    it('空结果时不发事件', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([]);

      await service.reconcileRecent(1);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('pending 状态的不处理', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        { id: 1, status: 'pending', workflowId: 10, workflowCode: 'reimbursement', workflow: { module: 'reimbursement' }, applicantId: 1, title: '报销申请' },
      ]);

      await service.reconcileRecent(1);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
