import type { PrismaClient } from '@prisma/client';
import type { HolidayView } from '@leixi/shared';

type HolidayPrisma = Pick<PrismaClient, 'workHoliday'>;

function toView(h: { id: number; year: number; date: string; name: string; type: string }): HolidayView {
  return { id: h.id, year: h.year, date: h.date, name: h.name, type: h.type };
}

/**
 * Prisma 实现的 HolidayRepo：节假日按具体日期独立建模，按年管理；系统级配置，无部门隔离。
 * date 全局唯一（@unique）：重复日期 → 抛 P2002，捕获后返回 dup。
 */
export function createPrismaHolidayRepo(prisma: HolidayPrisma) {
  return {
    async listHolidays(year?: number): Promise<HolidayView[]> {
      const rows = await prisma.workHoliday.findMany({
        where: year ? { year } : {},
        orderBy: [{ date: 'asc' }],
      });
      return rows.map(toView);
    },

    async createHoliday(data: {
      year: number;
      date: string;
      name: string;
      type: string;
    }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }> {
      try {
        const row = await prisma.workHoliday.create({ data });
        return { ok: true, id: row.id };
      } catch (err) {
        return isUniqueViolation(err) ? { ok: false, reason: 'dup' } : Promise.reject(err);
      }
    },

    async updateHoliday(
      id: number,
      data: { year?: number; date?: string; name?: string; type?: string },
    ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }> {
      try {
        await prisma.workHoliday.update({ where: { id }, data });
        return { ok: true };
      } catch (err) {
        if (isNotFound(err)) return { ok: false, reason: 'not_found' };
        if (isUniqueViolation(err)) return { ok: false, reason: 'dup' };
        return Promise.reject(err);
      }
    },

    async deleteHoliday(id: number): Promise<'ok' | 'not_found'> {
      try {
        await prisma.workHoliday.delete({ where: { id } });
        return 'ok';
      } catch (err) {
        if (isNotFound(err)) return 'not_found';
        return Promise.reject(err);
      }
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';
}