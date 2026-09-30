// 节假日日历读取 —— 把 `holidays` 表读成 resolveDayType 需要的 Map。
//
// 单独抽出来是因为有三处调用方（日报生成 / 月报 / 审批回调重算），
// 且必须共用同一份「键 = UTC 日期」的口径，否则一处用本地日期键就会整天错位。
import type { Prisma } from '@prisma/client';
import { holidayKey, type HolidayDayType } from './engine/workday-calendar';

/** 只要能访问 holiday 委托即可（PrismaService 与事务客户端都满足） */
type HolidayReader = Pick<Prisma.TransactionClient, 'holiday'>;

/**
 * 读取 [startDate, endDate] 闭区间内的日历登记，键为 UTC 日期 'YYYY-MM-DD'。
 * 未登记的日子不在此 Map 中，由 resolveDayType 退回「周六周日 = 休息日」的默认口径。
 */
export async function loadHolidayCalendar(
  client: HolidayReader,
  startDate: Date,
  endDate: Date,
): Promise<Map<string, HolidayDayType>> {
  const rows = await client.holiday.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { date: true, dayType: true },
  });
  const map = new Map<string, HolidayDayType>();
  for (const row of rows) {
    map.set(holidayKey(row.date), row.dayType as HolidayDayType);
  }
  return map;
}
