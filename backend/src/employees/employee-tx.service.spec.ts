import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeeTxService } from './employee-tx.service';

function createMockPrisma() {
  const mockPrisma: any = {
    onboarding: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    resignation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    probation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attendanceAppeal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employeeCertificate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employeeReward: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    trainingRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employeeTransfer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payrollAdjustment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    payrollRun: {
      findUnique: jest.fn(),
    },
    sequence: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      return fn(mockPrisma);
    }),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };
  return mockPrisma;
}

function createMockApprovalService() {
  return {
    startInstance: jest.fn(),
  };
}

function createMockDataScopeService() {
  return {
    visibleScope: jest.fn().mockResolvedValue({ all: true, ids: [], selfEmployeeId: null }),
  };
}

describe('EmployeeTxService - DTO 白名单校验', () => {
  let service: EmployeeTxService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const approvalService = createMockApprovalService();
    const dataScope = createMockDataScopeService();
    service = new EmployeeTxService(prisma as any, approvalService as any, dataScope as any);
  });

  describe('createOnboarding - 字段白名单', () => {
    it('只允许白名单字段，剥离 status 等非法字段', async () => {
      prisma.onboarding.create.mockResolvedValue({ id: 1, name: '张三' });

      const maliciousDto = {
        name: '张三',
        phone: '13800138000',
        departmentId: 1,
        hireDate: '2025-01-01',
        status: 'approved',
        approvalInstanceId: 999,
        createdBy: 666,
      };

      await service.createOnboarding(maliciousDto as any, 1);

      const calledData = prisma.onboarding.create.mock.calls[0][0].data;
      expect(calledData.status).toBeUndefined();
      expect(calledData.approvalInstanceId).toBeUndefined();
      expect(calledData.createdBy).toBe(1);
      expect(calledData.name).toBe('张三');
    });

    it('必填字段缺失时抛出 BadRequestException', async () => {
      await expect(
        service.createOnboarding({ name: '', phone: '' } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateOnboarding - 字段白名单', () => {
    it('只允许白名单字段，剥离 status 等非法字段', async () => {
      prisma.onboarding.findUnique.mockResolvedValue({
        id: 1,
        status: 'draft',
      });
      prisma.onboarding.update.mockResolvedValue({ id: 1 });

      const maliciousDto = {
        name: '李四',
        status: 'approved',
        approvalInstanceId: 999,
      };

      await service.updateOnboarding(1, maliciousDto as any);

      const calledData = prisma.onboarding.update.mock.calls[0][0].data;
      expect(calledData.status).toBeUndefined();
      expect(calledData.approvalInstanceId).toBeUndefined();
      expect(calledData.name).toBe('李四');
    });

    it('非草稿状态不可编辑', async () => {
      prisma.onboarding.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
      });

      await expect(service.updateOnboarding(1, { name: 'x' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createResignation - 字段白名单', () => {
    it('只允许白名单字段，剥离 status 等非法字段', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        name: '张三',
      });
      prisma.resignation.create.mockResolvedValue({ id: 1 });

      const maliciousDto = {
        employeeId: 1,
        reason: '个人原因',
        resignDate: '2025-06-01',
        status: 'approved',
        approvalInstanceId: 999,
      };

      await service.createResignation(maliciousDto as any, 1);

      const calledData = prisma.resignation.create.mock.calls[0][0].data;
      expect(calledData.status).toBeUndefined();
      expect(calledData.approvalInstanceId).toBeUndefined();
      expect(calledData.reason).toBe('个人原因');
    });
  });

  describe('createContract - 字段白名单', () => {
    it('只允许白名单字段，剥离 status 等非法字段', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.contract.create.mockResolvedValue({ id: 1 });

      const maliciousDto = {
        employeeId: 1,
        contractNo: 'CT001',
        type: 'labor',
        startDate: '2025-01-01',
        status: 'terminated',
      };

      await service.createContract(maliciousDto as any);

      const calledData = prisma.contract.create.mock.calls[0][0].data;
      expect(calledData.status).toBeUndefined();
      expect(calledData.contractNo).toBe('CT001');
    });
  });

  describe('createReward - 字段白名单', () => {
    it('只允许白名单字段，剥离 handledBy 等非法字段', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.employeeReward.create.mockResolvedValue({ id: 1 });

      const maliciousDto = {
        employeeId: 1,
        type: 'reward',
        category: 'performance',
        reason: '表现优秀',
        amount: 1000,
        rewardDate: '2025-06-01',
        handledBy: 999,
      };

      await service.createReward(maliciousDto as any);

      const calledData = prisma.employeeReward.create.mock.calls[0][0].data;
      expect(calledData.handledBy).toBeUndefined();
      expect(calledData.reason).toBe('表现优秀');
    });
  });
});

describe('EmployeeTxService - 审批撤回业务数据回滚', () => {
  let service: EmployeeTxService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const approvalService = createMockApprovalService();
    const dataScope = createMockDataScopeService();
    service = new EmployeeTxService(prisma as any, approvalService as any, dataScope as any);
  });

  describe('handleApprovalWithdrawn - 入职审批撤回', () => {
    it('审批通过后撤回，应删除 Employee 记录', async () => {
      const onboardingRecord = {
        id: 1,
        name: '张三',
        phone: '13800138000',
        status: 'approved',
        approvalInstanceId: 100,
      };
      const employeeRecord = {
        id: 1,
        name: '张三',
        userId: 1,
        status: 'probation',
      };

      prisma.onboarding.findFirst.mockResolvedValue(onboardingRecord);
      prisma.employee.findFirst.mockResolvedValue(employeeRecord);
      prisma.employee.delete.mockResolvedValue(employeeRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'onboarding',
      });

      expect(prisma.onboarding.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('pending 状态撤回，不删除 Employee', async () => {
      const onboardingRecord = {
        id: 1,
        name: '张三',
        phone: '13800138000',
        status: 'pending',
        approvalInstanceId: 100,
      };

      prisma.onboarding.findFirst.mockResolvedValue(onboardingRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'onboarding',
      });

      expect(prisma.onboarding.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.delete).not.toHaveBeenCalled();
    });

    it('幂等性：已经是 draft 状态直接返回', async () => {
      const onboardingRecord = {
        id: 1,
        status: 'draft',
        approvalInstanceId: null,
      };

      prisma.onboarding.findFirst.mockResolvedValue(onboardingRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'onboarding',
      });

      expect(prisma.onboarding.update).not.toHaveBeenCalled();
      expect(prisma.employee.delete).not.toHaveBeenCalled();
    });
  });

  describe('handleApprovalWithdrawn - 转正审批撤回', () => {
    it('审批通过后撤回，员工状态恢复为 probation', async () => {
      const probationRecord = {
        id: 1,
        employeeId: 1,
        status: 'approved',
        approvalInstanceId: 100,
      };
      const employeeRecord = {
        id: 1,
        name: '张三',
        status: 'active',
      };

      prisma.probation.findFirst.mockResolvedValue(probationRecord);
      prisma.employee.findUnique.mockResolvedValue(employeeRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'probation',
      });

      expect(prisma.probation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'probation' },
      });
    });

    it('pending 状态撤回，不修改员工状态', async () => {
      const probationRecord = {
        id: 1,
        employeeId: 1,
        status: 'pending',
        approvalInstanceId: 100,
      };

      prisma.probation.findFirst.mockResolvedValue(probationRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'probation',
      });

      expect(prisma.probation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('handleApprovalWithdrawn - 离职审批撤回', () => {
    it('审批通过后撤回，员工状态恢复为 active', async () => {
      const resignationRecord = {
        id: 1,
        employeeId: 1,
        status: 'approved',
        approvalInstanceId: 100,
      };
      const employeeRecord = {
        id: 1,
        name: '张三',
        status: 'resigned',
      };

      prisma.resignation.findFirst.mockResolvedValue(resignationRecord);
      prisma.employee.findUnique.mockResolvedValue(employeeRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'resignation',
      });

      expect(prisma.resignation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'active', resignDate: null },
      });
    });

    it('pending 状态撤回，不修改员工状态', async () => {
      const resignationRecord = {
        id: 1,
        employeeId: 1,
        status: 'pending',
        approvalInstanceId: 100,
      };

      prisma.resignation.findFirst.mockResolvedValue(resignationRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'resignation',
      });

      expect(prisma.resignation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('handleApprovalWithdrawn - 调岗审批撤回', () => {
    it('审批通过后撤回，部门和岗位恢复原状', async () => {
      const transferRecord = {
        id: 1,
        employeeId: 1,
        fromDepartmentId: 1,
        toDepartmentId: 2,
        fromPositionId: 1,
        toPositionId: 2,
        fromSalary: 8000,
        toSalary: 10000,
        effectiveDate: new Date('2025-06-01'),
        status: 'approved',
        approvalInstanceId: 100,
      };
      const employeeRecord = {
        id: 1,
        name: '张三',
        departmentId: 2,
        positionId: 2,
        salary: 10000,
      };

      prisma.employeeTransfer.findFirst.mockResolvedValue(transferRecord);
      prisma.employee.findUnique.mockResolvedValue(employeeRecord);
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 1, month: '2025-06' });

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'transfer',
      });

      expect(prisma.employeeTransfer.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          departmentId: 1,
          positionId: 1,
          salary: 8000,
        },
      });
      expect(prisma.payrollAdjustment.deleteMany).toHaveBeenCalled();
    });

    it('pending 状态撤回，不修改员工信息', async () => {
      const transferRecord = {
        id: 1,
        employeeId: 1,
        status: 'pending',
        approvalInstanceId: 100,
      };

      prisma.employeeTransfer.findFirst.mockResolvedValue(transferRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'transfer',
      });

      expect(prisma.employeeTransfer.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('handleApprovalWithdrawn - 奖惩审批撤回', () => {
    it('审批通过后撤回，删除薪资调整记录', async () => {
      const rewardRecord = {
        id: 1,
        employeeId: 1,
        type: 'reward',
        amount: 1000,
        rewardDate: new Date('2025-06-01'),
        status: 'approved',
        approvalInstanceId: 100,
      };
      const adjustments = [
        { id: 1, employeeId: 1, itemCode: 'bonus', amount: 1000 },
      ];

      prisma.employeeReward.findFirst.mockResolvedValue(rewardRecord);
      prisma.payrollAdjustment.findMany.mockResolvedValue(adjustments);
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 1, month: '2025-06' });

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'reward_punishment',
      });

      expect(prisma.employeeReward.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.payrollAdjustment.deleteMany).toHaveBeenCalled();
    });

    it('pending 状态撤回，不删除薪资调整记录', async () => {
      const rewardRecord = {
        id: 1,
        employeeId: 1,
        status: 'pending',
        approvalInstanceId: 100,
      };

      prisma.employeeReward.findFirst.mockResolvedValue(rewardRecord);

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'reward_punishment',
      });

      expect(prisma.employeeReward.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft', approvalInstanceId: null },
      });
      expect(prisma.payrollAdjustment.deleteMany).not.toHaveBeenCalled();
    });
  });
});
