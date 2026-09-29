import { AttendanceDailyRecalcService } from './attendance-daily-recalc.service';

function createMocks() {
  return {
    prisma: {
      attendanceDailyRecalcTask: {
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { findFirst: jest.fn() },
    },
    dailyService: { recalculate: jest.fn() },
  };
}

describe('AttendanceDailyRecalcService.runDailyRecalc - 业务日口径', () => {
  let service: AttendanceDailyRecalcService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    // 定时任务按北京时间 02:00 触发 = UTC 18:00（前一天）
    jest.useFakeTimers().setSystemTime(new Date('2026-09-26T18:00:00Z'));
    mocks = createMocks();
    mocks.prisma.attendanceDailyRecalcTask.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 1, ...data }),
    );
    mocks.prisma.attendanceDailyRecalcTask.update.mockResolvedValue({});
    mocks.prisma.user.findFirst.mockResolvedValue({ id: 1 });
    mocks.dailyService.recalculate.mockResolvedValue({ count: 3 });
    service = new AttendanceDailyRecalcService(
      mocks.prisma as any,
      mocks.dailyService as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('重算范围取北京时间的「昨天」：UTC 宿主机不得多退一天', async () => {
    // 该用例在 Asia/Shanghai 宿主机上与旧实现同解；须以 TZ=UTC（生产容器默认）运行才呈负例。
    await service.runDailyRecalc();

    expect(mocks.dailyService.recalculate).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-09-26', endDate: '2026-09-26' }),
    );
  });
});