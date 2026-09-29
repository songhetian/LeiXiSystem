import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VacationService } from './vacation.service';
import { beijingNow } from '../common/date.util';

/**
 * 休假额度的调度入口。
 *
 * 背景：VacationService 的 initializeYearBalances / carryOverBalances 只是能力，
 * 若没有调用入口，年假（month=0）与月假（1~12 月）额度永不生成，员工请假一律 2201，
 * 跨年结转也永不执行。
 *
 * 调度约定：
 *  - 每年 1 月 1 日 00:30 执行跨年结转（内部含新年度额度初始化）
 *  - 每日 01:10 补齐当年度缺失额度（覆盖年中入职、新增假期类型、新增月份区间）
 *
 * 说明：刻意不在 onModuleInit 里跑全量初始化——启动即写库会与 e2e 测试的
 * 数据准备顺序竞争；需要立即初始化时走 POST /vacation/balances/initialize（同幂等）。
 */
@Injectable()
export class VacationBalanceSchedulerService {
  private readonly logger = new Logger(VacationBalanceSchedulerService.name);

  constructor(private readonly vacationService: VacationService) {}

  /** 每年 1 月 1 日 00:30：上一年余额结转到当年 */
  @Cron('0 30 0 1 1 *', { timeZone: 'Asia/Shanghai' })
  async handleYearlyCarryOver() {
    const toYear = beijingNow().year;
    const fromYear = toYear - 1;
    try {
      await this.vacationService.carryOverBalances(fromYear, toYear);
      this.logger.log(`假期余额跨年结转完成：${fromYear} → ${toYear}`);
    } catch (e) {
      this.logger.error(
        `假期余额跨年结转失败：${fromYear} → ${toYear}，${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** 每日 01:10：补齐当年度缺失额度 */
  @Cron('0 10 1 * * *', { timeZone: 'Asia/Shanghai' })
  async handleDailyEnsure() {
    const year = beijingNow().year;
    try {
      await this.vacationService.initializeYearBalances(year);
      this.logger.log(`假期余额初始化完成（每日补齐）：year=${year}`);
    } catch (e) {
      this.logger.error(
        `假期余额初始化失败（每日补齐）：year=${year}，${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}