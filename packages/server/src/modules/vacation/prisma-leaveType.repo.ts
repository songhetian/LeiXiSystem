import type { PrismaClient } from '@prisma/client';
import type { LeaveTypeView } from '@leixi/shared';

type LTPrisma = Pick<PrismaClient, 'leaveType' | 'leaveQuota'>;

function toView(t: {
  id: number;
  name: string;
  unit: string;
  allowance: unknown;
  isActive: boolean;
  description: string | null;
}): LeaveTypeView {
  return {
    id: t.id,
    name: t.name,
    unit: t.unit,
    allowance: Number(t.allowance),
    isActive: t.isActive,
    description: t.description,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';
}

/** Prisma 实现的 LeaveTypeRepo：系统级请假类型配置 CRUD。 */
export function createPrismaLeaveTypeRepo(prisma: LTPrisma) {
  return {
    async listLeaveTypes(): Promise<LeaveTypeView[]> {
      const rows = await prisma.leaveType.findMany({ orderBy: [{ id: 'asc' }] });
      return rows.map(toView);
    },

    async createLeaveType(data: {
      name: string;
      unit: string;
      allowance: number;
      description?: string | null;
    }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }> {
      try {
        const row = await prisma.leaveType.create({
          data: { ...data, allowance: data.allowance, description: data.description ?? null },
        });
        return { ok: true, id: row.id };
      } catch (err) {
        return isUniqueViolation(err) ? { ok: false, reason: 'dup' } : Promise.reject(err);
      }
    },

    async updateLeaveType(
      id: number,
      data: { name?: string; unit?: string; allowance?: number; isActive?: boolean; description?: string | null },
    ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }> {
      try {
        await prisma.leaveType.update({ where: { id }, data });
        return { ok: true };
      } catch (err) {
        if (isNotFound(err)) return { ok: false, reason: 'not_found' };
        if (isUniqueViolation(err)) return { ok: false, reason: 'dup' };
        return Promise.reject(err);
      }
    },

    async deleteLeaveType(id: number): Promise<'ok' | 'not_found' | 'in_use'> {
      // 先探测是否被年度额度占用，避免裸外键报错
      const used = await prisma.leaveQuota.findFirst({ where: { leaveTypeId: id }, select: { id: true } });
      if (used) return 'in_use';
      try {
        await prisma.leaveType.delete({ where: { id } });
        return 'ok';
      } catch (err) {
        if (isNotFound(err)) return 'not_found';
        // 并发占用：当作 in_use
        return 'in_use';
      }
    },
  };
}