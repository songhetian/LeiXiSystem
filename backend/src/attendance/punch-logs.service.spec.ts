/** @jest-environment ./jest-utc-environment */
import { PunchLogsService } from './punch-logs.service';

function createMockPrisma() {
  return {
    punchLog: { findMany: jest.fn(), count: jest.fn() },
  };
}

function createMockDataScope() {
  return { visibleScope: jest.fn() };
}

// punch_time 是真实时刻列（@db.DateTime），前端按【北京时间业务日】传 'YYYY-MM-DD'。
// 生产容器 TZ=UTC，若用服务器本地时区的 `new Date('YYYY-MM-DD 00:00:00')` 解析，
// 会把「北京当日 00:00~08:00」的打卡整体排除、并混入次日凌晨记录。
const BEIJING_DAY_START = '2026-09-27T16:00:00.000Z'; // 北京 2026-09-28 00:00
const BEIJING_NEXT_DAY_START = '2026-09-28T16:00:00.000Z'; // 北京 2026-09-29 00:00

describe('PunchLogsService.list 打卡记录业务日区间（UTC 容器）', () => {
  let service: PunchLogsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: ReturnType<typeof createMockDataScope>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrisma();
    dataScope = createMockDataScope();
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
    prisma.punchLog.findMany.mockResolvedValue([]);
    prisma.punchLog.count.mockResolvedValue(0);
    service = new PunchLogsService(prisma as any, dataScope as any);
  });

  it('startDate/endDate 必须按北京时间整日换算，不得按服务器本地时区解析', async () => {
    await service.list(1, {
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      page: 1,
      pageSize: 20,
    });

    const where = (prisma.punchLog.findMany.mock.calls[0][0] as any).where;
    expect(where.punchTime.gte.toISOString()).toBe(BEIJING_DAY_START);
    // 左闭右开：次日北京 00:00（lt），而非本地时区的 lte 23:59:59
    expect(where.punchTime.lt.toISOString()).toBe(BEIJING_NEXT_DAY_START);
    expect(where.punchTime.lte).toBeUndefined();
  });

  it('仅传 startDate 时按北京当日 00:00 起，无上界', async () => {
    await service.list(1, { startDate: '2026-09-28', page: 1, pageSize: 20 });

    const where = (prisma.punchLog.findMany.mock.calls[0][0] as any).where;
    expect(where.punchTime.gte.toISOString()).toBe(BEIJING_DAY_START);
    expect(where.punchTime.lt).toBeUndefined();
  });

  it('不传日期时不过滤 punchTime', async () => {
    await service.list(1, { page: 1, pageSize: 20 });

    const where = (prisma.punchLog.findMany.mock.calls[0][0] as any).where;
    expect(where.punchTime).toBeUndefined();
  });
});
