import { AttendanceAuditService, AttendanceAuditQuery } from './attendance-audit.service';
import { Prisma } from '@prisma/client';

function createMockPrisma() {
  return {
    leaveRecord: { findMany: jest.fn() },
    overtimeRecord: { findMany: jest.fn() },
  };
}

function createMockDataScope() {
  return { visibleScope: jest.fn() };
}

describe('AttendanceAuditService（批次六 · 考勤申请聚合审计）', () => {
  let service: AttendanceAuditService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: ReturnType<typeof createMockDataScope>;

  const leaveRow = {
    id: 1,
    employeeId: 7,
    vacationTypeId: 2,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-01'),
    days: new Prisma.Decimal(1),
    reason: '家中有事',
    status: 'approving',
    approvalInstanceId: 51,
    approvalNote: null,
    createdAt: new Date('2026-08-10T00:00:00Z'),
    employee: {
      id: 7,
      name: '张三',
      employeeNo: 'E007',
      department: { id: 1, name: '研发部' },
    },
    vacationType: { name: '事假' },
  };
  const overtimeRow = {
    id: 2,
    employeeId: 8,
    overtimeDate: new Date('2026-08-03'),
    hours: new Prisma.Decimal(3),
    reason: '项目上线',
    status: 'approving',
    approvalInstanceId: 52,
    approvalNote: null,
    createdAt: new Date('2026-08-11T00:00:00Z'),
    employee: {
      id: 8,
      name: '李四',
      employeeNo: 'E008',
      department: { id: 2, name: '市场部' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrisma();
    dataScope = createMockDataScope();
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
    service = new AttendanceAuditService(prisma as any, dataScope as any);
  });

  const q = (over: Partial<AttendanceAuditQuery> = {}): AttendanceAuditQuery => ({
    page: 1,
    pageSize: 10,
    ...over,
  });

  describe('list（聚合请假 + 加班）', () => {
    it('全量合并两类、按创建时间倒序并内存分页、字段归一化', async () => {
      prisma.leaveRecord.findMany.mockResolvedValue([leaveRow]);
      prisma.overtimeRecord.findMany.mockResolvedValue([overtimeRow]);
      const res = await service.list(1, q());
      expect(res.total).toBe(2);
      expect(res.list[0].recordType).toBe('overtime');
      expect(res.list[1]).toMatchObject({
        recordType: 'leave',
        employeeName: '张三',
        employeeNo: 'E007',
        departmentName: '研发部',
        businessTypeName: '事假',
        approvalInstanceId: 51,
        status: 'approving',
        hours: null,
      });
      expect(res.list[0]).toMatchObject({
        recordType: 'overtime',
        employeeName: '李四',
        businessTypeName: '加班',
        hours: 3,
        approvalInstanceId: 52,
      });
    });

    it('非 all 数据范围：对 leave/overtime 均按 employee.departmentId in ids 过滤', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [1, 2] });
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.overtimeRecord.findMany.mockResolvedValue([]);
      await service.list(1, q());
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: expect.objectContaining({ departmentId: { in: [1, 2] } }),
          }),
        }),
      );
      expect(prisma.overtimeRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: expect.objectContaining({ departmentId: { in: [1, 2] } }),
          }),
        }),
      );
    });

    it('员工本人模式只查自己记录（employeeId）', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: 7 });
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.overtimeRecord.findMany.mockResolvedValue([]);
      await service.list(7, q());
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: 7 }) }),
      );
      expect(prisma.overtimeRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: 7 }) }),
      );
    });

    it('部门过滤越权（不在可视 ids）时置空部门 [-1]，杜绝越权', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [1] });
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.overtimeRecord.findMany.mockResolvedValue([]);
      await service.list(1, q({ departmentId: 99 }));
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: expect.objectContaining({ departmentId: { in: [-1] } }),
          }),
        }),
      );
    });

    it('recordType=leave 只查请假表', async () => {
      prisma.leaveRecord.findMany.mockResolvedValue([leaveRow]);
      await service.list(1, q({ recordType: 'leave' }));
      expect(prisma.leaveRecord.findMany).toHaveBeenCalled();
      expect(prisma.overtimeRecord.findMany).not.toHaveBeenCalled();
    });

    it('status 与假期类型过滤传递到对应表', async () => {
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.overtimeRecord.findMany.mockResolvedValue([]);
      await service.list(1, q({ recordType: 'all', status: 'approved', vacationTypeId: 2 }));
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved', vacationTypeId: 2 }),
        }),
      );
      expect(prisma.overtimeRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
      );
    });

    it('关键字过滤：按姓名/工号 OR', async () => {
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.overtimeRecord.findMany.mockResolvedValue([]);
      await service.list(1, q({ recordType: 'leave', keyword: '张' }));
      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: expect.objectContaining({
              OR: [{ name: { contains: '张' } }, { employeeNo: { contains: '张' } }],
            }),
          }),
        }),
      );
    });

    it('分页：按分页切片并返回 total', async () => {
      prisma.leaveRecord.findMany.mockResolvedValue([leaveRow]);
      prisma.overtimeRecord.findMany.mockResolvedValue([
        { ...overtimeRow },
        { ...overtimeRow, id: 3, createdAt: new Date('2026-08-05T00:00:00Z') },
      ]);
      const res = await service.list(1, q({ page: 2, pageSize: 2 }));
      expect(res.total).toBe(3);
      expect(res.list).toHaveLength(1);
      expect(res.page).toBe(2);
      expect(res.pageSize).toBe(2);
    });
  });
});