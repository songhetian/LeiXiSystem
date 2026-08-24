import { DashboardService } from './dashboard.service';

function createMockPrisma() {
  return {
    employee: { findFirst: jest.fn(), count: jest.fn() },
    attendanceDaily: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    approvalRecord: { count: jest.fn() },
    department: {
      findMany: jest.fn(),
    },
  };
}

describe('DashboardService — getStats 补真数据（替换前端 mock）', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DashboardService(prisma as any);
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 1 });
  });

  it('在职员工数来自 employee.count(active)', async () => {
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.approvalRecord.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });

    const result = await service.getStats(1);
    expect(result.employeeCount).toBe(12);
    expect(prisma.employee.count).toHaveBeenCalledWith({
      where: { status: 'active' },
    });
  });

  it('今日迟到数来自今日 attendanceDaily 中 late/late_early 的计数', async () => {
    prisma.employee.count.mockResolvedValue(12);
    // 第一次 count：今日出勤数；第二次 count：今日迟到数
    prisma.attendanceDaily.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);
    prisma.approvalRecord.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });

    const result = await service.getStats(1);
    expect(result.todayLateCount).toBe(3);
    // 迟到 count 必须限定今日 + late/late_early，作为独立统计
    expect(prisma.attendanceDaily.count).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['late', 'late_early'] },
        }),
      }),
    );
  });

  it('本月加班时长 = 当月 overtimeMinutes 总和换算为小时（小数 1 位）', async () => {
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.approvalRecord.count.mockResolvedValue(0);
    // 当月 390 分钟 ≥ 6.5 小时
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 390 } });

    const result = await service.getStats(1);
    expect(result.monthOvertimeHours).toBe(6.5);
    // 聚合必须限定当月范围
    expect(prisma.attendanceDaily.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workDate: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
        }),
        _sum: { overtimeMinutes: true },
      }),
    );
  });

  it('当月无加班时返回 0', async () => {
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.approvalRecord.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: null } });

    const result = await service.getStats(1);
    expect(result.monthOvertimeHours).toBe(0);
  });
});