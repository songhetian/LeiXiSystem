/**
 * 以 UTC（=生产容器时区）运行：开发机 GMT+8 下「服务器本地日期」恰好等于北京日期，
 * 会把「北京时间业务日」的时区 bug 掩盖掉，只有非北京时区才能暴露。
 *
 * @jest-environment ./jest-utc-environment
 */
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

function createMockApprovalClient() {
  return { countPendingForUser: jest.fn().mockResolvedValue(0) };
}

describe('DashboardService — getStats 补真数据（替换前端 mock）', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let approvalClient: ReturnType<typeof createMockApprovalClient>;

  beforeEach(() => {
    prisma = createMockPrisma();
    approvalClient = createMockApprovalClient();
    service = new DashboardService(prisma as any, approvalClient as any);
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

  /**
   * 建实例时把审批链每个节点的 record 一次性写成 pending，全部不带 approverId
   * （approverId 只在「加签 / 转交 / 实际处理」时才写，是审计字段而非路由字段）。
   * 旧实现直接 count(approverId = userId)，对角色型/审批组型节点永远为 0，
   * 首页「待审批」徽标长期显示 0，与待办列表（listTodos 按节点语义匹配）不一致。
   */
  it('待审批数与待办列表同口径：走审批模块的待办统计，而非 approverId 直接计数', async () => {
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    approvalClient.countPendingForUser.mockResolvedValue(2);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });

    const result = await service.getStats(1);

    expect(result.pendingApprovals).toBe(2);
    expect(approvalClient.countPendingForUser).toHaveBeenCalledWith(1);
    // 不得再退回基于 approverId 的直连计数
    expect(prisma.approvalRecord.count).not.toHaveBeenCalled();
  });
});

// 生产容器 TZ=UTC，而考勤业务日以「北京时间」为准且以 UTC 午夜存储。
// 若用服务器本地日期（localDateStr(new Date())）取「今天」，北京时间 00:00~08:00
// 会退回前一天，首页「今日出勤/今日迟到」显示的是昨天的数据；跨月时「本月加班」也会落到上个月。
describe('DashboardService — 业务日/月口径按北京时间（生产容器 TZ=UTC）', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;

  // 北京 2026-10-01 01:00 === UTC 2026-09-30 17:00（跨日 + 跨月）
  const BEIJING_CROSS_DAY = new Date('2026-09-30T17:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(BEIJING_CROSS_DAY);
    prisma = createMockPrisma();
    service = new DashboardService(prisma as any, createMockApprovalClient() as any);
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 1 });
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.approvalRecord.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });
    prisma.attendanceDaily.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('今日出勤/迟到统计落在北京业务日（2026-10-01），而非服务器本地日期（2026-09-30）', async () => {
    await service.getStats(1);

    const today = new Date('2026-10-01T00:00:00.000Z');
    expect(prisma.attendanceDaily.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workDate: today }) }),
    );
  });

  it('本月加班聚合区间取北京时间所在月（2026-10）', async () => {
    await service.getStats(1);

    expect(prisma.attendanceDaily.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workDate: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lt: new Date('2026-11-01T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('近 7 天出勤趋势以北京业务日收尾', async () => {
    const trend = await service.getAttendanceTrend(7);

    expect(trend).toHaveLength(7);
    expect(trend[6].date).toBe('2026-10-01');
    expect(trend[0].date).toBe('2026-09-25');
    expect(prisma.attendanceDaily.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { workDate: new Date('2026-10-01T00:00:00.000Z') },
      }),
    );
  });
});