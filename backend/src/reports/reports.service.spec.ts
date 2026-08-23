import { ReportsService } from './reports.service';
import { EmployeeStatus } from '@prisma/client';

const mockPrisma: any = {
  employee: {
    findMany: jest.fn(),
  },
  approvalInstance: {
    findMany: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
  },
};

const mockDataScope: any = {
  visibleScope: jest.fn(),
};

const mockRedis: any = {
  isEnabled: false,
  get: jest.fn(),
  set: jest.fn(),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(mockPrisma, mockDataScope, mockRedis);
  });

  describe('employeeStructure', () => {
    it('试用期人数应使用 status=probation 判断，而非入职3个月估算', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      const now = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 1,
          education: '本科',
          departmentId: 1,
          department: { id: 1, name: '技术部' },
          hireDate: oneMonthAgo,
          status: EmployeeStatus.active,
          gender: 'male',
        },
        {
          id: 2,
          education: '硕士',
          departmentId: 1,
          department: { id: 1, name: '技术部' },
          hireDate: sixMonthsAgo,
          status: EmployeeStatus.probation,
          gender: 'female',
        },
        {
          id: 3,
          education: '本科',
          departmentId: 2,
          department: { id: 2, name: '产品部' },
          hireDate: oneMonthAgo,
          status: EmployeeStatus.probation,
          gender: 'male',
        },
      ]);

      const result = await service.employeeStructure(1);

      const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
      expect(callArgs.select.status).toBe(true);

      expect(result.onProbation).toBe(2);

      const activeOneMonthAgo = result.onProbation === 1;
      expect(activeOneMonthAgo).toBe(false);
    });

    it('应包含 byGender 性别统计维度', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 1,
          education: '本科',
          departmentId: 1,
          department: { id: 1, name: '技术部' },
          hireDate: oneYearAgo,
          status: EmployeeStatus.active,
          gender: 'male',
        },
        {
          id: 2,
          education: '硕士',
          departmentId: 1,
          department: { id: 1, name: '技术部' },
          hireDate: oneYearAgo,
          status: EmployeeStatus.active,
          gender: 'female',
        },
        {
          id: 3,
          education: '本科',
          departmentId: 2,
          department: { id: 2, name: '产品部' },
          hireDate: oneYearAgo,
          status: EmployeeStatus.active,
          gender: 'male',
        },
        {
          id: 4,
          education: '博士',
          departmentId: 2,
          department: { id: 2, name: '产品部' },
          hireDate: oneYearAgo,
          status: EmployeeStatus.active,
          gender: null,
        },
      ]);

      const result = await service.employeeStructure(1);

      const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
      expect(callArgs.select.gender).toBe(true);

      expect(result.byGender).toBeDefined();
      expect(Array.isArray(result.byGender)).toBe(true);

      const maleItem = result.byGender.find((g: any) => g.name === 'male');
      const femaleItem = result.byGender.find((g: any) => g.name === 'female');
      const unknownItem = result.byGender.find((g: any) => g.name === 'unknown');

      expect(maleItem).toBeDefined();
      expect(maleItem.count).toBe(2);
      expect(femaleItem).toBeDefined();
      expect(femaleItem.count).toBe(1);
      expect(unknownItem).toBeDefined();
      expect(unknownItem.count).toBe(1);
    });

    it('总人数统计应正确', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 1,
          education: '本科',
          departmentId: 1,
          department: { id: 1, name: '技术部' },
          hireDate: oneYearAgo,
          status: EmployeeStatus.active,
          gender: 'male',
        },
        {
          id: 2,
          education: '硕士',
          departmentId: 1,
          department: { id: 1, name: '技术部' },
          hireDate: oneYearAgo,
          status: EmployeeStatus.active,
          gender: 'female',
        },
      ]);

      const result = await service.employeeStructure(1);

      expect(result.total).toBe(2);
      expect(result.byDepartment.length).toBe(1);
      expect(result.byDepartment[0].count).toBe(2);
    });
  });

  describe('getApprovalEfficiency', () => {
    const baseParams = {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      userId: 1,
    };

    function createInstance(id: number, status: string, hoursSinceCreation: number, workflowId = 1, departmentId = 1) {
      const createdAt = new Date('2026-06-01T00:00:00Z');
      const updatedAt = new Date(createdAt.getTime() + hoursSinceCreation * 60 * 60 * 1000);
      return {
        id,
        workflowId,
        workflowCode: 'leave',
        title: `申请 ${id}`,
        applicantId: 1,
        applicantName: '张三',
        departmentId,
        status,
        createdAt,
        updatedAt,
        workflow: { id: workflowId, name: '请假审批', code: 'leave' },
        records: status === 'approved' || status === 'rejected'
          ? [{ status: 'approved', handledAt: updatedAt, order: 1 }]
          : [],
      };
    }

    beforeEach(() => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
    });

    it('撤回的实例不计入 completedCount', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        createInstance(1, 'approved', 24),
        createInstance(2, 'rejected', 12),
        createInstance(3, 'cancelled', 1),
        createInstance(4, 'pending', 100),
      ]);

      const result = await service.getApprovalEfficiency(baseParams);

      expect(result.summary.totalInstances).toBe(4);
      expect(result.summary.completedCount).toBe(2);
      expect(result.summary.approvedCount).toBe(1);
      expect(result.summary.rejectedCount).toBe(1);
    });

    it('通过率计算使用 completedCount 做分母，不是 totalInstances', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        createInstance(1, 'approved', 24),
        createInstance(2, 'approved', 24),
        createInstance(3, 'rejected', 12),
        createInstance(4, 'cancelled', 1),
        createInstance(5, 'cancelled', 1),
      ]);

      const result = await service.getApprovalEfficiency(baseParams);

      expect(result.summary.totalInstances).toBe(5);
      expect(result.summary.completedCount).toBe(3);
      expect(result.summary.approveRate).toBeCloseTo(66.7, 1);
    });

    it('平均时长只计算 approved + rejected 的，不包含 cancelled', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        createInstance(1, 'approved', 24),
        createInstance(2, 'rejected', 12),
        createInstance(3, 'cancelled', 1),
      ]);

      const result = await service.getApprovalEfficiency(baseParams);

      expect(result.summary.avgDurationHours).toBeCloseTo(18.0, 1);
    });

    it('积压数只统计 pending 状态的，超过3天算积压', async () => {
      const mockNow = new Date('2026-06-10T00:00:00Z');
      jest.useFakeTimers().setSystemTime(mockNow);

      const oldPending = {
        id: 1,
        workflowId: 1,
        workflowCode: 'leave',
        title: '申请 1',
        applicantId: 1,
        applicantName: '张三',
        departmentId: 1,
        status: 'pending',
        createdAt: new Date('2026-06-01T00:00:00Z'),
        updatedAt: new Date('2026-06-01T00:00:00Z'),
        workflow: { id: 1, name: '请假审批', code: 'leave' },
        records: [],
      };
      const newPending = {
        id: 2,
        workflowId: 1,
        workflowCode: 'leave',
        title: '申请 2',
        applicantId: 1,
        applicantName: '张三',
        departmentId: 1,
        status: 'pending',
        createdAt: new Date('2026-06-09T00:00:00Z'),
        updatedAt: new Date('2026-06-09T00:00:00Z'),
        workflow: { id: 1, name: '请假审批', code: 'leave' },
        records: [],
      };
      const cancelledOld = {
        id: 3,
        workflowId: 1,
        workflowCode: 'leave',
        title: '申请 3',
        applicantId: 1,
        applicantName: '张三',
        departmentId: 1,
        status: 'cancelled',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
        workflow: { id: 1, name: '请假审批', code: 'leave' },
        records: [],
      };

      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        oldPending,
        newPending,
        cancelledOld,
      ]);

      const result = await service.getApprovalEfficiency(baseParams);

      expect(result.summary.backlogCount).toBe(1);
      expect(result.summary.pendingCount).toBe(2);

      jest.useRealTimers();
    });

    it('按工作流分组时，撤回实例不计入效率统计', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        createInstance(1, 'approved', 24, 1),
        createInstance(2, 'cancelled', 1, 1),
        createInstance(3, 'approved', 48, 2),
        createInstance(4, 'rejected', 24, 2),
        createInstance(5, 'cancelled', 2, 2),
      ]);

      const result = await service.getApprovalEfficiency({ ...baseParams, groupBy: 'workflow' });

      const wf1 = result.byWorkflow!.find((w: any) => w.workflowId === 1)!;
      expect(wf1.totalInstances).toBe(2);
      expect(wf1.completedCount).toBe(1);
      expect(wf1.approveRate).toBeCloseTo(100.0, 1);
      expect(wf1.avgDurationHours).toBeCloseTo(24.0, 1);

      const wf2 = result.byWorkflow!.find((w: any) => w.workflowId === 2)!;
      expect(wf2.totalInstances).toBe(3);
      expect(wf2.completedCount).toBe(2);
      expect(wf2.approveRate).toBeCloseTo(50.0, 1);
      expect(wf2.avgDurationHours).toBeCloseTo(36.0, 1);
    });

    it('按部门分组时，撤回实例不计入效率统计', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        createInstance(1, 'approved', 24, 1, 10),
        createInstance(2, 'cancelled', 1, 1, 10),
        createInstance(3, 'approved', 48, 1, 20),
        createInstance(4, 'rejected', 24, 1, 20),
      ]);
      mockPrisma.department.findMany.mockResolvedValue([
        { id: 10, name: '研发部' },
        { id: 20, name: '市场部' },
      ]);

      const result = await service.getApprovalEfficiency({ ...baseParams, groupBy: 'department' });

      const dept10 = result.byDepartment!.find((d: any) => d.departmentId === 10)!;
      expect(dept10.totalInstances).toBe(2);
      expect(dept10.completedCount).toBe(1);
      expect(dept10.approveRate).toBeCloseTo(100.0, 1);
      expect(dept10.avgDurationHours).toBeCloseTo(24.0, 1);

      const dept20 = result.byDepartment!.find((d: any) => d.departmentId === 20)!;
      expect(dept20.totalInstances).toBe(2);
      expect(dept20.completedCount).toBe(2);
      expect(dept20.approveRate).toBeCloseTo(50.0, 1);
      expect(dept20.avgDurationHours).toBeCloseTo(36.0, 1);
    });

    it('全部为撤回实例时，完成数为0，通过率为0，平均时长为0', async () => {
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        createInstance(1, 'cancelled', 1),
        createInstance(2, 'cancelled', 2),
      ]);

      const result = await service.getApprovalEfficiency(baseParams);

      expect(result.summary.totalInstances).toBe(2);
      expect(result.summary.completedCount).toBe(0);
      expect(result.summary.approveRate).toBe(0);
      expect(result.summary.avgDurationHours).toBe(0);
    });
  });
});
