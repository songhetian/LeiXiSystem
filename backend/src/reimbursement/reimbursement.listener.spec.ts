import { ReimbursementListener } from './reimbursement.listener';

function createMockPrisma() {
  const mockPrisma: any = {
    reimbursement: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    reimbursementPayment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      return fn(mockPrisma);
    }),
  };
  return mockPrisma;
}

describe('ReimbursementListener', () => {
  let listener: ReimbursementListener;
  let prisma: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    listener = new ReimbursementListener(prisma);
    jest.clearAllMocks();
  });

  describe('handleApprovalWithdrawn - 报销审批撤回', () => {
    it('已通过的报销撤回后，付款记录变为 cancelled', async () => {
      const reimbursement = {
        id: 1,
        status: 'approved',
        totalAmount: 1000,
        applicantId: 1,
        approvalInstanceId: 100,
      };
      const payment = {
        id: 1,
        reimbursementId: 1,
        amount: 1000,
        status: 'pending',
      };

      prisma.reimbursement.findFirst.mockResolvedValue(reimbursement);
      prisma.reimbursementPayment.findUnique.mockResolvedValue(payment);

      await listener.handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'reimbursement',
      });

      expect(prisma.reimbursement.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.reimbursementPayment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'cancelled',
          remark: '报销撤回，付款取消',
        },
      });
    });

    it('approving 状态的报销撤回后，不影响付款（还没生成）', async () => {
      const reimbursement = {
        id: 2,
        status: 'approving',
        totalAmount: 500,
        applicantId: 2,
        approvalInstanceId: 200,
      };

      prisma.reimbursement.findFirst.mockResolvedValue(reimbursement);

      await listener.handleApprovalWithdrawn({
        instanceId: 200,
        workflowCode: 'reimbursement',
      });

      expect(prisma.reimbursement.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.reimbursementPayment.findUnique).not.toHaveBeenCalled();
      expect(prisma.reimbursementPayment.update).not.toHaveBeenCalled();
    });

    it('幂等性：付款已经是 cancelled 状态不再处理', async () => {
      const reimbursement = {
        id: 3,
        status: 'approved',
        totalAmount: 800,
        applicantId: 3,
        approvalInstanceId: 300,
      };
      const payment = {
        id: 3,
        reimbursementId: 3,
        amount: 800,
        status: 'cancelled',
        remark: '报销撤回，付款取消',
      };

      prisma.reimbursement.findFirst.mockResolvedValue(reimbursement);
      prisma.reimbursementPayment.findUnique.mockResolvedValue(payment);

      await listener.handleApprovalWithdrawn({
        instanceId: 300,
        workflowCode: 'reimbursement',
      });

      expect(prisma.reimbursement.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.reimbursementPayment.update).not.toHaveBeenCalled();
    });

    it('非报销 workflowCode 直接返回', async () => {
      await listener.handleApprovalWithdrawn({
        instanceId: 400,
        workflowCode: 'other',
      });

      expect(prisma.reimbursement.findFirst).not.toHaveBeenCalled();
    });

    it('报销记录不存在直接返回', async () => {
      prisma.reimbursement.findFirst.mockResolvedValue(null);

      await listener.handleApprovalWithdrawn({
        instanceId: 500,
        workflowCode: 'reimbursement',
      });

      expect(prisma.reimbursement.update).not.toHaveBeenCalled();
      expect(prisma.reimbursementPayment.update).not.toHaveBeenCalled();
    });

    it('状态既不是 approving 也不是 approved 直接返回', async () => {
      const reimbursement = {
        id: 4,
        status: 'draft',
        approvalInstanceId: null,
      };

      prisma.reimbursement.findFirst.mockResolvedValue(reimbursement);

      await listener.handleApprovalWithdrawn({
        instanceId: 600,
        workflowCode: 'reimbursement',
      });

      expect(prisma.reimbursement.update).not.toHaveBeenCalled();
      expect(prisma.reimbursementPayment.update).not.toHaveBeenCalled();
    });
  });
});
