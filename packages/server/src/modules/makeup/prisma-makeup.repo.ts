import type { Prisma, PrismaClient } from '@prisma/client';
import type { MakeupView } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';

type MakeupRow = Prisma.MakeupGetPayload<{
  include: {
    applicant: { select: { realName: true } };
    department: { select: { name: true } };
  };
}>;

type MakeupPrisma = Pick<PrismaClient, 'makeup'>;

function scopeWhere(scope: DepartmentScope): Prisma.MakeupWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(m: MakeupRow): MakeupView {
  return {
    id: m.id,
    recordDate: m.recordDate.toISOString().slice(0, 10),
    clockType: m.clockType,
    clockTime: m.clockTime,
    reason: m.reason,
    status: m.status,
    applicantId: m.applicantId,
    departmentId: m.departmentId,
    applicantName: m.applicant.realName,
    departmentName: m.department.name,
  };
}

/** Prisma 实现的 MakeupRepo：审批流（pending/approved/rejected）+ 部门数据隔离 */
export function createPrismaMakeupRepo(prisma: MakeupPrisma) {
  return {
    async listMakeups(scope: DepartmentScope): Promise<MakeupView[]> {
      const rows = await prisma.makeup.findMany({
        where: scopeWhere(scope),
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
        },
        orderBy: { id: 'desc' },
      });
      return rows.map(toView);
    },

    async createMakeup(data: {
      recordDate: string;
      clockType: string;
      clockTime: string;
      reason: string;
      applicantId: number;
      departmentId: number;
    }): Promise<{ id: number }> {
      const row = await prisma.makeup.create({
        data: {
          recordDate: new Date(data.recordDate + 'T00:00:00Z'),
          clockType: data.clockType,
          clockTime: data.clockTime,
          reason: data.reason,
          applicantId: data.applicantId,
          departmentId: data.departmentId,
        },
      });
      return { id: row.id };
    },

    async getMakeupById(id: number): Promise<MakeupView | null> {
      const row = await prisma.makeup.findUnique({
        where: { id },
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
        },
      });
      return row ? toView(row) : null;
    },

    async setStatus(id: number, status: string): Promise<void> {
      await prisma.makeup.update({ where: { id }, data: { status } });
    },
  };
}