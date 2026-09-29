/** @jest-environment ./jest-utc-environment */
// 生产容器未设置 TZ（即 UTC），而业务口径一律按北京时间；本文件统一在 UTC 下运行。
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmployeeTxService } from './employee-tx.service';
import { messageOf } from '../common/error-messages';
import { ERROR_CODES } from '../common/error-codes';

function createMockPrisma() {
  const mockPrisma: any = {
    onboarding: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    resignation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    probation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    certificateRequest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    attendanceAppeal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
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
      count: jest.fn(),
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
      count: jest.fn(),
    },
    attendanceDaily: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payrollAdjustment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    salaryAdjustment: {
      create: jest.fn(),
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

// 员工事务各域此前把「员工不存在」写成本域的记录码（9301/9501/9701/9801…），
// 中央文案会把它覆盖成「合同不存在」「证书不存在」等完全不相干的实体名。
describe('EmployeeTxService - 错误码语义（员工不存在不得复用本域记录码）', () => {
  let service: EmployeeTxService;
  let prisma: ReturnType<typeof createMockPrisma>;

  async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
    try {
      await fn();
    } catch (e: any) {
      return e.getResponse?.() ?? e.response ?? e;
    }
    throw new Error('预期抛出异常，但未抛出');
  }

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new EmployeeTxService(
      prisma as any,
      createMockApprovalService() as any,
      createMockDataScopeService() as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('个人档案：员工不存在时中央文案必须是「员工不存在」，而非「培训记录不存在」', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateMyProfile(7, { phone: '13800000000' }));

    expect(payload.code).toBe(1002);
    expect(messageOf(payload.code)).toBe('员工不存在');
  });

  it('证明申请：记录不存在时中央文案必须是「证明申请不存在」，而非「调岗调薪记录不存在」', async () => {
    prisma.certificateRequest.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.getCertRequest(999));

    expect(payload.code).toBe(9811);
    expect(messageOf(payload.code)).toBe('证明申请不存在');
  });

  it('奖惩提交：非草稿状态必须有已注册文案（不得留裸码 9602）', async () => {
    prisma.employeeReward.findUnique.mockResolvedValue({
      id: 1,
      status: 'pending',
      approvalInstanceId: 5,
      employee: { userId: 9 },
    });

    const payload = await catchPayload(() => service.submitReward(1, 9, 'reward'));

    expect(payload.code).toBe(9602);
    expect(messageOf(payload.code)).toBe('只有草稿状态可操作');
  });

  it('奖惩提交：已提交审批必须有已注册文案（不得留裸码 9603）', async () => {
    prisma.employeeReward.findUnique.mockResolvedValue({
      id: 1,
      status: 'draft',
      approvalInstanceId: 5,
      employee: { userId: 9 },
    });

    const payload = await catchPayload(() => service.submitReward(1, 9, 'reward'));

    expect(payload.code).toBe(9603);
    expect(messageOf(payload.code)).toBe('已提交审批');
  });
});

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

    it('审批通过后撤回，必须同步回滚薪资留痕（否则计薪仍按已作废的调薪基数）', async () => {
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

      prisma.employeeTransfer.findFirst.mockResolvedValue(transferRecord);
      prisma.employee.findUnique.mockResolvedValue({ id: 1, salary: 10000, departmentId: 2, positionId: 2 });
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 1, month: '2025-06' });

      await (service as any).handleApprovalWithdrawn({
        instanceId: 100,
        workflowCode: 'transfer',
      });

      expect(prisma.salaryAdjustment.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          employeeId: 1,
          effectiveMonth: '2025-06',
          remark: { startsWith: '调动调薪' },
        }),
      });
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

  describe('getPendingCounts - 各事务待处理数（draft+pending）', () => {
    beforeEach(() => {
      prisma.onboarding.count.mockResolvedValue(2);
      prisma.resignation.count.mockResolvedValue(3);
      prisma.probation.count.mockResolvedValue(4);
      prisma.contract.count.mockResolvedValue(1);
      prisma.attendanceAppeal.count.mockResolvedValue(5);
      prisma.employeeReward.count.mockResolvedValue(6);
      prisma.employeeTransfer.count.mockResolvedValue(7);
    });

    it('全量可见时，不附加部门/员工范围，返回各类型待处理数（证书/培训恒为 0）', async () => {
      const result = await service.getPendingCounts(1);

      expect(result).toEqual({
        onboardings: 2,
        resignations: 3,
        probations: 4,
        contracts: 1,
        'attendance-appeals': 5,
        certificates: 0,
        rewards: 6,
        trainings: 0,
        transfers: 7,
      });

      // 合同状态枚举无 pending，仅按 draft 统计
      expect(prisma.contract.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { in: ['draft'] } } }),
      );
      // 其余流程模型统计 draft + pending
      expect(prisma.resignation.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { in: ['draft', 'pending'] } } }),
      );
      // 证书/培训无状态字段，不发 count 查询
      expect(prisma.employeeCertificate.count).toBeUndefined();
      expect(prisma.trainingRecord.count).toBeUndefined();
    });

    it('按部门可见（scope.ids）时，员工类事务按可见员工集合过滤，入职按部门过滤', async () => {
      // 建一个只可见部门 1、2 的独立服务实例
      const scopedService = new EmployeeTxService(
        prisma as any,
        createMockApprovalService() as any,
        {
          visibleScope: jest.fn().mockResolvedValue({ all: false, ids: [1, 2], selfEmployeeId: null }),
        } as any,
      );
      prisma.employee.findMany.mockResolvedValue([
        { id: 11 },
        { id: 12 },
      ]);

      await scopedService.getPendingCounts(1);

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { departmentId: { in: [1, 2] } },
        select: { id: true },
      });
      expect(prisma.onboarding.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { in: ['draft', 'pending'] }, departmentId: { in: [1, 2] } } }),
      );
      expect(prisma.resignation.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { in: ['draft', 'pending'] }, employeeId: { in: [11, 12] } } }),
      );
    });
  });
});

describe('EmployeeTxService - 合同管理增强（到期/续签/终止/附件）', () => {
  let service: EmployeeTxService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const FIXED_NOW = new Date('2026-08-27T00:00:00.000Z');

  const mockContract = (over: any = {}) => ({
    id: 1,
    employeeId: 1,
    contractNo: 'CT001',
    type: 'fixed_term',
    startDate: new Date('2025-08-01'),
    endDate: new Date('2026-09-30'),
    status: 'active' as const,
    renewalCount: 0,
    ...over,
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
    prisma = createMockPrisma();
    const approvalService = createMockApprovalService();
    const dataScope = createMockDataScopeService();
    service = new EmployeeTxService(prisma as any, approvalService as any, dataScope as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('listContracts - 到期预警计算', () => {
    it('即将到期（30天内）返回 expiringSoon=true 与正数 daysToExpire', async () => {
      prisma.contract.findMany.mockResolvedValue([
        mockContract({ id: 1, endDate: new Date('2026-09-10') }), // 距今天 14 天
        mockContract({ id: 2, endDate: new Date('2026-09-26') }), // 距今天 30 天，边界视为预警
      ]);
      prisma.contract.count.mockResolvedValue(2);

      const res = await service.listContracts({ page: 1, pageSize: 10, userId: 1 });

      const [a, b] = res.list;
      expect(a.daysToExpire).toBe(14);
      expect(a.expiringSoon).toBe(true);
      expect(b.daysToExpire).toBe(30);
      expect(b.expiringSoon).toBe(true);
    });

    it('无结束日期或已终止的合同，daysToExpire 为 null 且不预警', async () => {
      prisma.contract.findMany.mockResolvedValue([
        mockContract({ id: 1, endDate: null, status: 'active' }),
        mockContract({ id: 2, endDate: new Date('2026-01-01'), status: 'terminated' }),
      ]);
      prisma.contract.count.mockResolvedValue(2);

      const res = await service.listContracts({ page: 1, pageSize: 10, userId: 1 });

      expect(res.list[0].daysToExpire).toBeNull();
      expect(res.list[0].expiringSoon).toBe(false);
      expect(res.list[1].daysToExpire).toBeNull();
      expect(res.list[1].expiringSoon).toBe(false);
    });

    it('长期未到期（超过30天）不预警，daysToExpire 为实际天数', async () => {
      prisma.contract.findMany.mockResolvedValue([
        mockContract({ id: 1, endDate: new Date('2027-01-01') }),
      ]);
      prisma.contract.count.mockResolvedValue(1);

      const res = await service.listContracts({ page: 1, pageSize: 10, userId: 1 });

      expect(res.list[0].daysToExpire).toBe(127);
      expect(res.list[0].expiringSoon).toBe(false);
    });
  });

  describe('renewContract - 续签', () => {
    it('原合同置为 expired、renewalCount+1，并创建新合同返回', async () => {
      const old = mockContract({ id: 1 });
      prisma.contract.findUnique.mockResolvedValue(old);
      prisma.contract.create.mockResolvedValue({ ...old, id: 2, contractNo: 'CT002', renewalCount: 1 });

      const dto = {
        contractNo: 'CT002',
        type: 'fixed_term',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
        salary: 20000,
      };

      const result = await service.renewContract(1, dto as any);

      // 原合同在事务内被更新为 expired 且续签次数 +1
      expect(prisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'expired' }),
        }),
      );
      expect(prisma.contract.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ renewalCount: 1 }) }),
      );
      // 新合同复用原员工并记录续签来源
      expect(prisma.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 1,
            contractNo: 'CT002',
            renewalCount: 1,
          }),
        }),
      );
      expect(result.id).toBe(2);
    });
  });

  describe('terminateContract - 终止/解除', () => {
    it('将合同置为 terminated，写入终止日期与操作人', async () => {
      const c = mockContract({ id: 1 });
      prisma.contract.findUnique.mockResolvedValue(c);
      prisma.contract.update.mockResolvedValue({ ...c, status: 'terminated' });

      const dto = { terminationDate: '2026-08-27', remark: '协商解除', terminatedBy: 'HR' };

      await service.terminateContract(1, dto as any);

      expect(prisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: 'terminated',
            terminatedBy: 'HR',
            terminationDate: new Date('2026-08-27T00:00:00.000Z'),
          }),
        }),
      );
    });

    it('已终止或已过期的合同不可重复终止', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockContract({ status: 'terminated' }));

      await expect(
        service.terminateContract(1, { terminationDate: '2026-08-27' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createContract / updateContract - 附件回填', () => {
    it('createContract 允许 attachmentUrl 字段入库', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.contract.create.mockResolvedValue({ id: 1 });

      await service.createContract({
        employeeId: 1,
        contractNo: 'CT001',
        type: 'fixed_term',
        startDate: '2025-01-01',
        attachmentUrl: '/uploads/contracts/ct001.pdf',
      } as any);

      expect(prisma.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attachmentUrl: '/uploads/contracts/ct001.pdf' }),
        }),
      );
    });

    it('createContract 未传 contractNo 时自动生成 CT-YYYY-XXXX', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.contract.create.mockResolvedValue({ id: 1 });
      prisma.sequence.findUnique.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([{ next_val: 7 }]);

      await service.createContract({
        employeeId: 1,
        type: 'fixed_term',
        startDate: '2025-01-01',
      } as any);

      const called = prisma.contract.create.mock.calls[0][0] as any;
      expect(called.data.contractNo).toMatch(/^CT-2026-0007$/);
    });

    it('自动生成合同编号的年份按北京时间推导：北京 1/1 02:00（UTC 仍是上一年 12/31）应为 CT-2027-xxxx', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.contract.create.mockResolvedValue({ id: 1 });
      prisma.sequence.findUnique.mockResolvedValue(null);
      prisma.sequence.create.mockResolvedValue({ id: 1, name: 'contract_no_2027', currentValue: 0, step: 1 });
      prisma.$queryRaw.mockResolvedValue([{ next_val: 1 }]);

      const RealDate: any = Date;
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation(function (
        this: Date,
        ...args: any[]
      ) {
        return (args.length === 0
          ? new RealDate('2026-12-31T18:00:00.000Z')
          : new RealDate(...args)) as any;
      });

      try {
        await service.createContract({
          employeeId: 1,
          type: 'fixed_term',
          startDate: '2025-01-01',
        } as any);
      } finally {
        dateSpy.mockRestore();
      }

      const called = prisma.contract.create.mock.calls[0][0] as any;
      // 用本地年份会取到 2026（UTC 日期），合同编号年份与序列名都会错位一年
      expect(called.data.contractNo).toMatch(/^CT-2027-/);
      expect(prisma.sequence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'contract_no_2027' }),
        }),
      );
    });

    it('创建时显式传入 contractNo 则不再自动生成', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.contract.create.mockResolvedValue({ id: 1 });

      await service.createContract({
        employeeId: 1,
        contractNo: 'CT-2026-9999',
        type: 'fixed_term',
        startDate: '2025-01-01',
      } as any);

      const called = prisma.contract.create.mock.calls[0][0] as any;
      expect(called.data.contractNo).toBe('CT-2026-9999');
    });

    it('updateContract 允许 attachmentUrl 字段更新且剥离 status', async () => {
      prisma.contract.findUnique.mockResolvedValue(mockContract({ id: 1 }));
      prisma.contract.update.mockResolvedValue({ id: 1 });

      await service.updateContract(1, {
        attachmentUrl: '/uploads/contracts/ct001-new.pdf',
        status: 'terminated',
      } as any);

      expect(prisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attachmentUrl: '/uploads/contracts/ct001-new.pdf' }),
        }),
      );
    });
  });

  describe('renewContract - 失败分支', () => {
    it('合同不存在时抛出 NotFoundException', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.renewContract(99, { contractNo: 'CT2', type: 'fixed_term', startDate: '2026-09-01' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

describe('EmployeeTxService - 入职自动建试用期', () => {
  let service: EmployeeTxService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const approvalService = createMockApprovalService();
    const dataScope = createMockDataScopeService();
    service = new EmployeeTxService(prisma as any, approvalService as any, dataScope as any);

    prisma.onboarding.findFirst.mockResolvedValue({
      id: 1,
      status: 'pending',
      approvalInstanceId: 100,
      name: '张三',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      departmentId: 5,
      positionId: 6,
      hireDate: new Date('2026-01-31T00:00:00.000Z'),
      salary: 10000,
      probationMonths: 1,
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 11 });
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue({ id: 21 });
    prisma.probation.findFirst.mockResolvedValue(null);
    prisma.sequence.findUnique.mockResolvedValue({ currentValue: 0, step: 1 });
    prisma.$queryRaw.mockResolvedValue([{ next_val: 1 }]);
  });

  // 1/31 加 1 个月：setMonth 直接加会让 2 月溢出到 3/3，结束日必须收敛到当月最后一天
  it('入职日为月末（1/31）时，试用期结束日应落在 2 月末而非溢出到 3/3', async () => {
    await (service as any).handleOnboardingApproved(100);

    const data = prisma.probation.create.mock.calls[0][0].data;
    expect(data.probationStartDate.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(data.probationEndDate.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('普通入职日（9/15）试用期 3 个月仍应精确加 3 个月', async () => {
    prisma.onboarding.findFirst.mockResolvedValue({
      id: 1,
      status: 'pending',
      approvalInstanceId: 100,
      name: '李四',
      phone: '13900139000',
      email: 'lisi@example.com',
      departmentId: 5,
      positionId: 6,
      hireDate: new Date('2026-09-15T00:00:00.000Z'),
      salary: 10000,
      probationMonths: 3,
    });

    await (service as any).handleOnboardingApproved(100);

    const data = prisma.probation.create.mock.calls[0][0].data;
    expect(data.probationEndDate.toISOString()).toBe('2026-12-15T00:00:00.000Z');
  });
});

// ------------------------------------------------------------------
// getTimeline - 数据范围隔离
// 显式传入 employeeId 时，原实现用 `employeeId ? { id: employeeId } : scopeWhere('id')`
// 的二选一写法，会让 employeeId 分支彻底跳过 scope 过滤 → 任意持 transfer:view 的
// 受限用户（含部门管理员）都能读取其他部门员工的完整履历（IDOR）。
// ------------------------------------------------------------------
describe('EmployeeTxService - getTimeline 数据范围隔离', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  const outOfScopeEmployee = {
    id: 999,
    name: '外部员工',
    employeeNo: 'E999',
    status: 'active',
    hireDate: new Date('2020-01-01T00:00:00.000Z'),
    resignDate: null,
    departmentId: 2,
    department: { id: 2, name: '其他部门' },
    position: null,
  };
  const inScopeEmployee = {
    id: 11,
    name: '本部门员工',
    employeeNo: 'E011',
    status: 'active',
    hireDate: new Date('2021-01-01T00:00:00.000Z'),
    resignDate: null,
    departmentId: 1,
    department: { id: 1, name: '本部门' },
    position: null,
  };

  function buildService(scope: any): EmployeeTxService {
    prisma = createMockPrisma();
    (prisma.employeeTransfer as any).findMany = jest.fn().mockResolvedValue([]);
    (prisma.resignation as any).findMany = jest.fn().mockResolvedValue([]);
    return new EmployeeTxService(
      prisma as any,
      createMockApprovalService() as any,
      { visibleScope: jest.fn().mockResolvedValue(scope) } as any,
    );
  }

  it('部门管理员查询非本部门员工履历：应抛 FORBIDDEN（不得放行）', async () => {
    const service = buildService({ all: false, ids: [1], selfEmployeeId: null });
    // 第一次 findMany 取可见员工集合，第二次取目标员工
    prisma.employee.findMany
      .mockResolvedValueOnce([{ id: 11, departmentId: 1 }])
      .mockResolvedValueOnce([outOfScopeEmployee]);

    await expect(
      service.getTimeline({ employeeId: 999, userId: 7 }),
    ).rejects.toMatchObject({
      response: { code: ERROR_CODES.DATA_NO_PERMISSION },
    });
  });

  it('部门管理员查询本部门员工履历：允许并返回该员工履历', async () => {
    const service = buildService({ all: false, ids: [1], selfEmployeeId: null });
    prisma.employee.findMany
      .mockResolvedValueOnce([{ id: 11, departmentId: 1 }])
      .mockResolvedValueOnce([inScopeEmployee]);

    const result = await service.getTimeline({ employeeId: 11, userId: 7 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.list.every((r) => r.employeeId === 11)).toBe(true);
  });

  it('普通员工查询他人履历：应抛 FORBIDDEN', async () => {
    const service = buildService({ all: false, ids: [], selfEmployeeId: 11 });

    await expect(
      service.getTimeline({ employeeId: 999, userId: 8 }),
    ).rejects.toMatchObject({
      response: { code: ERROR_CODES.DATA_NO_PERMISSION },
    });
  });
});

// 申诉审批通过后需要重算 attendance_daily.status。此前 employees 侧自带一份简版实现，
// 缺了「打卡次数为 0 → 缺勤」「打卡 > 4 次 → 异常」两条口径（attendance-approval.listener
// 已修过同类 bug），会把缺勤日洗成 normal。此处锁定与引擎/监听器一致的唯一口径。
describe('EmployeeTxService - 申诉审批通过后的日报状态重算（口径须与考勤监听器一致）', () => {
  let service: EmployeeTxService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const appeal = {
    id: 7,
    employeeId: 3,
    appealType: 'absent',
    appealDate: new Date('2026-09-10T00:00:00.000Z'),
    status: 'pending',
    approvalInstanceId: 200,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new EmployeeTxService(
      prisma as any,
      createMockApprovalService() as any,
      createMockDataScopeService() as any,
    );
    prisma.attendanceAppeal.findFirst.mockResolvedValue(appeal);
  });

  it('缺勤申诉通过：当天打卡次数为 0，清零缺勤分钟后仍应判为 absent（不得洗成 normal）', async () => {
    prisma.attendanceDaily.findUnique.mockResolvedValue({
      id: 11,
      employeeId: 3,
      workDate: new Date('2026-09-10T00:00:00.000Z'),
      punchCount: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      absentMinutes: 480,
      leaveDays: new Prisma.Decimal(0),
      status: 'absent',
    });

    await (service as any).handleApprovalApproved({ instanceId: 200, workflowCode: 'attendance_appeal' });

    expect(prisma.attendanceDaily.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { absentMinutes: 0 },
    });
  });

  it('迟到申诉通过：当天确有打卡，清零迟到分钟后应改判 normal', async () => {
    prisma.attendanceAppeal.findFirst.mockResolvedValue({ ...appeal, appealType: 'late' });
    prisma.attendanceDaily.findUnique.mockResolvedValue({
      id: 12,
      employeeId: 3,
      workDate: new Date('2026-09-10T00:00:00.000Z'),
      punchCount: 2,
      lateMinutes: 25,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(0),
      status: 'late',
    });

    await (service as any).handleApprovalApproved({ instanceId: 200, workflowCode: 'attendance_appeal' });

    expect(prisma.attendanceDaily.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { lateMinutes: 0, status: 'normal' },
    });
  });

  it('单日打卡 5 次（>4）视为异常：申诉通过后应为 abnormal 而非 normal', async () => {
    prisma.attendanceAppeal.findFirst.mockResolvedValue({ ...appeal, appealType: 'late' });
    prisma.attendanceDaily.findUnique.mockResolvedValue({
      id: 13,
      employeeId: 3,
      workDate: new Date('2026-09-10T00:00:00.000Z'),
      punchCount: 5,
      lateMinutes: 10,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(0),
      status: 'late',
    });

    await (service as any).handleApprovalApproved({ instanceId: 200, workflowCode: 'attendance_appeal' });

    expect(prisma.attendanceDaily.update).toHaveBeenCalledWith({
      where: { id: 13 },
      data: { lateMinutes: 0, status: 'abnormal' },
    });
  });

  it('休假当天（leaveDays > 0）：申诉通过后应保持 leave，不得被判成 leave 之外的其它状态', async () => {
    prisma.attendanceAppeal.findFirst.mockResolvedValue({ ...appeal, appealType: 'late' });
    prisma.attendanceDaily.findUnique.mockResolvedValue({
      id: 14,
      employeeId: 3,
      workDate: new Date('2026-09-10T00:00:00.000Z'),
      punchCount: 0,
      lateMinutes: 30,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(1),
      status: 'leave',
    });

    await (service as any).handleApprovalApproved({ instanceId: 200, workflowCode: 'attendance_appeal' });

    expect(prisma.attendanceDaily.update).toHaveBeenCalledWith({
      where: { id: 14 },
      data: { lateMinutes: 0 },
    });
  });
});
