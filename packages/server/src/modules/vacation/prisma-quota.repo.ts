import type { PrismaClient } from '@prisma/client';
import type { LeaveQuotaView, LeaveTrendPoint } from '@leixi/shared';

type QPrisma = Pick<PrismaClient, 'leaveQuota' | 'leaveType' | 'user' | 'leave'>;

/** 覆盖 [start,end] 整月/整年的时间边界查询：用 startAt 所在年的整年窗口。 */
function yearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(`${year}-01-01T00:00:00.000Z`),
    end: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
}

/** Prisma 实现的 QuotaRepo：年度额度按员工 scope 解析后的 userIds 过滤；趋势由 leave 数据按月聚合。 */
export function createPrismaQuotaRepo(prisma: QPrisma) {
  return {
    async listQuotas(year: number, userIds: number[]): Promise<LeaveQuotaView[]> {
      const rows = await prisma.leaveQuota.findMany({
        where: { year, userId: { in: userIds } },
        include: { quotaType: { select: { name: true } } },
        orderBy: [{ userId: 'asc' }, { leaveTypeId: 'asc' }],
      });
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        year: r.year,
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: r.quotaType.name,
        allowance: Number(r.allowance),
        used: Number(r.used),
        remaining: Number(r.allowance) - Number(r.used),
      }));
    },

    async upsertQuota(data: {
      userId: number;
      year: number;
      leaveTypeId: number;
      allowance: number;
      used: number;
    }): Promise<{ ok: true } | { ok: false; reason: 'bad_user' | 'bad_type' }> {
      const [user, type] = await Promise.all([
        prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } }),
        prisma.leaveType.findUnique({ where: { id: data.leaveTypeId }, select: { id: true } }),
      ]);
      if (!user) return { ok: false, reason: 'bad_user' };
      if (!type) return { ok: false, reason: 'bad_type' };
      await prisma.leaveQuota.upsert({
        where: {
          userId_year_leaveTypeId: {
            userId: data.userId,
            year: data.year,
            leaveTypeId: data.leaveTypeId,
          },
        },
        update: { allowance: data.allowance, used: data.used },
        create: {
          userId: data.userId,
          year: data.year,
          leaveTypeId: data.leaveTypeId,
          allowance: data.allowance,
          used: data.used,
        },
      });
      return { ok: true };
    },

    async batchUpsertQuotas(rows: {
      userId: number;
      year: number;
      leaveTypeId: number;
      allowance: number;
    }[]): Promise<number> {
      let count = 0;
      for (const r of rows) {
        await prisma.leaveQuota.upsert({
          where: {
            userId_year_leaveTypeId: { userId: r.userId, year: r.year, leaveTypeId: r.leaveTypeId },
          },
          update: { allowance: r.allowance },
          create: { ...r },
        });
        count++;
      }
      return count;
    },

    async getTrend(year: number, userIds: number[]): Promise<LeaveTrendPoint[]> {
      const { start, end } = yearRange(year);
      const leaves = await prisma.leave.findMany({
        where: {
          applicantId: { in: userIds },
          status: 'approved',
          startAt: { gte: start, lt: end },
        },
        select: { startAt: true },
      });
      const byMonth = new Map<number, number>();
      for (const l of leaves) {
        const m = l.startAt.getUTCMonth() + 1; // 1-12
        byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
      }
      const points: LeaveTrendPoint[] = [];
      for (let m = 1; m <= 12; m++) {
        const count = byMonth.get(m) ?? 0;
        if (count > 0) points.push({ month: m, count });
      }
      return points;
    },
  };
}