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
    notification: { findMany: jest.fn() },
    department: {
      findMany: jest.fn(),
    },
  };
}

function createMockApprovalClient() {
  return {
    countPendingForUser: jest.fn().mockResolvedValue(0),
    listTodoTop: jest.fn().mockResolvedValue([]),
    listMySubmissionsTop: jest.fn().mockResolvedValue([]),
  };
}

function createMockPermCache(permissions: string[] = []) {
  return { getUserPermissions: jest.fn().mockResolvedValue(new Set(permissions)) };
}

describe('DashboardService — getStats 补真数据（替换前端 mock）', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let approvalClient: ReturnType<typeof createMockApprovalClient>;
  let permCache: ReturnType<typeof createMockPermCache>;

  beforeEach(() => {
    prisma = createMockPrisma();
    approvalClient = createMockApprovalClient();
    permCache = createMockPermCache();
    service = new DashboardService(prisma as any, approvalClient as any, permCache as any);
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 1 });
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.attendanceDaily.findMany.mockResolvedValue([]);
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
    service = new DashboardService(
      prisma as any,
      createMockApprovalClient() as any,
      createMockPermCache() as any,
    );
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 1 });
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.approvalRecord.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });
    prisma.attendanceDaily.findMany.mockResolvedValue([]);
    prisma.notification.findMany.mockResolvedValue([]);
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
// ============================================================
// 工作台四区块接真数据（替换前端 TODO_ITEMS / NOTIFICATION_ITEMS /
// 本周考勤概览 / 我的申请进度 四处 mock）
// ============================================================
describe('DashboardService — 工作台四区块（notificationTop / mySubmissionsTop / todoTop / myWeek）', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let approvalClient: ReturnType<typeof createMockApprovalClient>;
  let permCache: ReturnType<typeof createMockPermCache>;

  beforeEach(() => {
    prisma = createMockPrisma();
    approvalClient = createMockApprovalClient();
    permCache = createMockPermCache();
    service = new DashboardService(prisma as any, approvalClient as any, permCache as any);
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 1 });
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });
    prisma.attendanceDaily.findMany.mockResolvedValue([]);
    prisma.notification.findMany.mockResolvedValue([]);
  });

  // ---- notificationTop ----

  it('notificationTop：当前用户最新 3 条通知，createdAt 倒序，最小字段集', async () => {
    const now = new Date('2026-10-05T02:00:00.000Z');
    // mock 模拟 DB 按 take 3 返回：查了 4 条里最新 3 条（更早的 id:0 不会返回）
    prisma.notification.findMany.mockResolvedValue([
      { id: 3, title: '通知C', type: 'system', read: true, createdAt: now },
      { id: 2, title: '通知B', type: 'approval', read: false, createdAt: now },
      { id: 1, title: '通知A', type: 'system', read: false, createdAt: now },
    ]);

    const result = await service.getStats(1);

    // 查询必须限定当前用户 + createdAt 倒序 + take 3
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, type: true, read: true, createdAt: true },
    });
    expect(result.notificationTop).toHaveLength(3);
    expect(result.notificationTop[0]).toEqual({
      id: 3, title: '通知C', type: 'system', read: true, createdAt: now,
    });
  });

  it('notificationTop：无通知返回 []', async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    const result = await service.getStats(1);

    expect(result.notificationTop).toEqual([]);
  });

  // ---- mySubmissionsTop ----

  it('mySubmissionsTop：最近 3 条我的申请，走审批跨模块只读接口（ADR-0013），不直连 approvalInstance 表', async () => {
    approvalClient.listMySubmissionsTop.mockResolvedValue([
      { id: 31, title: '年假申请（2天）', status: 'approved', createdAt: new Date('2026-10-04T01:00:00.000Z') },
      { id: 32, title: '加班申请（3小时）', status: 'pending', createdAt: new Date('2026-10-04T02:00:00.000Z') },
    ]);

    const result = await service.getStats(1);

    expect(approvalClient.listMySubmissionsTop).toHaveBeenCalledWith(1, 3);
    expect(result.mySubmissionsTop).toHaveLength(2);
    expect(result.mySubmissionsTop[0].status).toBe('approved');
  });

  it('mySubmissionsTop：无提交返回 []', async () => {
    approvalClient.listMySubmissionsTop.mockResolvedValue([]);

    const result = await service.getStats(1);

    expect(result.mySubmissionsTop).toEqual([]);
  });

  // ---- todoTop ----

  it('todoTop：有 approval:todo:view 权限时取前 4 条待办', async () => {
    permCache.getUserPermissions.mockResolvedValue(new Set(['approval:todo:view']));
    approvalClient.listTodoTop.mockResolvedValue([
      { id: 11, instanceId: 3, title: '张三的请假申请', createdAt: new Date('2026-10-04T01:00:00.000Z') },
      { id: 12, instanceId: 4, title: '李四的报销申请', createdAt: new Date('2026-10-04T02:00:00.000Z') },
    ]);

    const result = await service.getStats(1);

    expect(permCache.getUserPermissions).toHaveBeenCalledWith(1);
    expect(approvalClient.listTodoTop).toHaveBeenCalledWith(1, 4);
    expect(result.todoTop).toHaveLength(2);
    expect(result.todoTop[0].title).toBe('张三的请假申请');
  });

  it('todoTop：无 approval:todo:view 权限时返回 []，且不触发待办查询（服务端静默降级，杜绝 403 噪音）', async () => {
    permCache.getUserPermissions.mockResolvedValue(new Set(['attendance:view']));

    const result = await service.getStats(1);

    expect(result.todoTop).toEqual([]);
    expect(approvalClient.listTodoTop).not.toHaveBeenCalled();
  });

  it('todoTop：权限判断本身异常时静默降级 []，stats 整体不 500', async () => {
    permCache.getUserPermissions.mockRejectedValue(new Error('redis down'));

    const result = await service.getStats(1);

    expect(result.todoTop).toEqual([]);
    expect(result.employeeCount).toBe(12);
  });

  it('通知/待办/申请/日报查询异常时各自降级，stats 其余字段照常返回', async () => {
    prisma.notification.findMany.mockRejectedValue(new Error('db error'));
    approvalClient.listMySubmissionsTop.mockRejectedValue(new Error('db error'));
    prisma.attendanceDaily.findMany.mockRejectedValue(new Error('db error'));
    permCache.getUserPermissions.mockResolvedValue(new Set(['approval:todo:view']));
    approvalClient.listTodoTop.mockRejectedValue(new Error('db error'));

    const result = await service.getStats(1);

    expect(result.notificationTop).toEqual([]);
    expect(result.mySubmissionsTop).toEqual([]);
    expect(result.todoTop).toEqual([]);
    expect(result.myWeek).toBeNull();
    expect(result.employeeCount).toBe(12);
  });

  // ---- myWeek ----

  it('myWeek：按本周日报聚合 workDays / lateDays / absentDays / avgWorkHours（1 位小数）', async () => {
    prisma.attendanceDaily.findMany.mockResolvedValue([
      // 周一：正常 + 打卡跨度 8h（01:00Z=北京 09:00 → 09:00Z=北京 17:00），班次休息 60min → 计 7h
      { status: 'normal', firstPunch: new Date('2026-10-05T01:00:00.000Z'), lastPunch: new Date('2026-10-05T09:00:00.000Z'), shift: { restDuration: 60 } },
      // 周二：迟到（算出勤 + 算迟到）+ 打卡跨度 9h，班次休息 60min → 计 8h
      { status: 'late', firstPunch: new Date('2026-10-06T01:30:00.000Z'), lastPunch: new Date('2026-10-06T10:30:00.000Z'), shift: { restDuration: 60 } },
      // 周三：早退（算出勤，不算迟到），无打卡对
      { status: 'early', firstPunch: null, lastPunch: null, shift: { restDuration: 60 } },
      // 周四：缺勤
      { status: 'absent', firstPunch: null, lastPunch: null, shift: null },
      // 周五：周末态（既不算出勤也不算缺勤）
      { status: 'weekend', firstPunch: null, lastPunch: null, shift: null },
    ]);

    const result = await service.getStats(1);

    // workDays=3（normal/late/early），lateDays=1，absentDays=1
    // 平均工时 = 打卡跨度扣除班次休息：(8-1 + 9-1) / 2 = 7.5
    expect(result.myWeek).toEqual({ workDays: 3, lateDays: 1, absentDays: 1, avgWorkHours: 7.5 });
  });

  it('myWeek：无班次记录不扣休息；打卡跨度小于休息时长时单日截 0 不为负', async () => {
    prisma.attendanceDaily.findMany.mockResolvedValue([
      // 无班次（如休息日加班到岗）：跨度 4h 全额计入
      { status: 'normal', firstPunch: new Date('2026-10-05T01:00:00.000Z'), lastPunch: new Date('2026-10-05T05:00:00.000Z'), shift: null },
      // 有班次休息 60min，但打卡跨度仅 0.5h（异常短卡）→ 单日按 0 计，不得拉出负数
      { status: 'normal', firstPunch: new Date('2026-10-06T01:00:00.000Z'), lastPunch: new Date('2026-10-06T01:30:00.000Z'), shift: { restDuration: 60 } },
    ]);

    const result = await service.getStats(1);

    // 平均工时 = (4 + 0) / 2 = 2
    expect(result.myWeek).toEqual({ workDays: 2, lateDays: 0, absentDays: 0, avgWorkHours: 2 });
  });

  it('myWeek：本周无日报时返回全 0（有员工档案、仅是没数据，与「无档案 null」区分）', async () => {
    const result = await service.getStats(1);

    expect(result.myWeek).toEqual({ workDays: 0, lateDays: 0, absentDays: 0, avgWorkHours: 0 });
  });

  it('myWeek：用户无员工档案时返回 null（无考勤概念，前端显示 —）', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    const result = await service.getStats(1);

    expect(result.myWeek).toBeNull();
  });

  it('myWeek：聚合限定当前用户 employeeId + 本周 [weekStart, weekEnd) 区间', async () => {
    // 北京 2026-10-07 20:00（周三）= UTC 2026-10-07 12:00
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T12:00:00.000Z'));

    await service.getStats(1);

    expect(prisma.attendanceDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeId: 1,
          workDate: {
            gte: new Date('2026-10-05T00:00:00.000Z'), // 周一 00:00 北京 = UTC 午夜
            lt: new Date('2026-10-12T00:00:00.000Z'),
          },
        },
      }),
    );
  });
});

/**
 * 时区铁律（仓库规约）：业务日期以 UTC 午夜存储，「本周」边界按北京时间计算
 * （周一 00:00 北京时间 = UTC 周日 16:00），取值一律 getUTC*。
 * 用固定日期 mock 验证跨周边界两侧。
 */
describe('DashboardService — myWeek 本周边界（北京时间周一 00:00 = UTC 周日 16:00）', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 1 });
    prisma.employee.count.mockResolvedValue(12);
    prisma.attendanceDaily.count.mockResolvedValue(0);
    prisma.attendanceDaily.aggregate.mockResolvedValue({ _sum: { overtimeMinutes: 0 } });
    prisma.attendanceDaily.findMany.mockResolvedValue([]);
    prisma.notification.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService(): DashboardService {
    return new DashboardService(
      prisma as any,
      createMockApprovalClient() as any,
      createMockPermCache() as any,
    );
  }

  it('北京时间周一 00:00 整（UTC 周日 16:00）：本周从当天开始（2026-10-05 周一）', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T16:00:00.000Z'));

    await createService().getStats(1);

    expect(prisma.attendanceDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workDate: {
            gte: new Date('2026-10-05T00:00:00.000Z'),
            lt: new Date('2026-10-12T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('北京时间周日 23:59（UTC 周日 15:59）：仍在上周区间（2026-09-28 起）', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T15:59:00.000Z'));

    await createService().getStats(1);

    expect(prisma.attendanceDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workDate: {
            gte: new Date('2026-09-28T00:00:00.000Z'),
            lt: new Date('2026-10-05T00:00:00.000Z'),
          },
        }),
      }),
    );
  });
});
