import { VacationBalanceSchedulerService } from './vacation-balance-scheduler.service';
import { beijingNow } from '../common/date.util';

function createMockVacationService() {
  return {
    initializeYearBalances: jest.fn().mockResolvedValue(undefined),
    carryOverBalances: jest.fn().mockResolvedValue(undefined),
  };
}

describe('VacationBalanceSchedulerService · 假期额度调度入口', () => {
  let service: VacationBalanceSchedulerService;
  let vacationService: ReturnType<typeof createMockVacationService>;

  beforeEach(() => {
    vacationService = createMockVacationService();
    service = new VacationBalanceSchedulerService(vacationService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('跨年结转：以上一年 → 当年调用 carryOverBalances', async () => {
    const currentYear = beijingNow().year;

    await service.handleYearlyCarryOver();

    expect(vacationService.carryOverBalances).toHaveBeenCalledWith(currentYear - 1, currentYear);
    expect(vacationService.initializeYearBalances).not.toHaveBeenCalled();
  });

  it('每日补齐：以当年调用 initializeYearBalances', async () => {
    const currentYear = beijingNow().year;

    await service.handleDailyEnsure();

    expect(vacationService.initializeYearBalances).toHaveBeenCalledWith(currentYear);
  });

  it('跨年结转失败时只记日志、不向上抛（定时任务不应因异常中断）', async () => {
    vacationService.carryOverBalances.mockRejectedValueOnce(new Error('db down'));

    await expect(service.handleYearlyCarryOver()).resolves.toBeUndefined();
  });

  it('每日补齐失败时只记日志、不向上抛', async () => {
    vacationService.initializeYearBalances.mockRejectedValueOnce(new Error('db down'));

    await expect(service.handleDailyEnsure()).resolves.toBeUndefined();
  });

  // @nestjs/schedule 默认按「服务器本地时区」触发，而生产容器未设置 TZ（实际为 UTC），
  // 不显式指定 timeZone 会让 01:10 的任务在北京时间 09:10 才跑。此处做静态断言守住。
  it('两个定时任务均显式声明 Asia/Shanghai 时区', () => {
    const yearly = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      VacationBalanceSchedulerService.prototype.handleYearlyCarryOver,
    );
    const daily = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      VacationBalanceSchedulerService.prototype.handleDailyEnsure,
    );

    expect(yearly).toMatchObject({ cronTime: '0 30 0 1 1 *', timeZone: 'Asia/Shanghai' });
    expect(daily).toMatchObject({ cronTime: '0 10 1 * * *', timeZone: 'Asia/Shanghai' });
  });
});