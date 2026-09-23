import type { Prisma, PrismaClient } from '@prisma/client';
import type { OvertimeStats, OvertimeView } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';

type OvertimeRow = Prisma.OvertimeGetPayload<{
  include: {
    applicant: { select: { realName: true } };
    department: { select: { name: true } };
  };
}>;

type OvertimePrisma = Pick<PrismaClient, 'overtime'>;

function scopeWhere(scope: DepartmentScope): Prisma.OvertimeWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(o: OvertimeRow): OvertimeView {
  return {
    id: o.id,
    date: o.date.toISOString().slice(0, 10),
    startTime: o.startTime,
    endTime: o.endTime,
    hours: o.hours,
    reason: o.reason,
    status: o.status,
    applicantId: o.applicantId,
    departmentId: o.departmentId,
    applicantName: o.applicant.realName,
    departmentName: o.department.name,
  };
}

/** Prisma 实现的 OvertimeRepo：审批流（pending/approved/rejected）+ 部门数据隔离 */
export function createPrismaOvertimeRepo(prisma: OvertimePrisma) {
  return {
    async listOvertimes(scope: DepartmentScope): Promise<OvertimeView[]> {
      const rows = await prisma.overtime.findMany({
        where: scopeWhere(scope),
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
        },
        orderBy: { id: 'desc' },
      });
      return rows.map(toView);
    },

    async createOvertime(data: {
      date: string;
      startTime: string;
      endTime: string;
      hours: number;
      reason: string;
      applicantId: number;
      departmentId: number;
    }): Promise<{ id: number }> {
      const row = await prisma.overtime.create({
        data: {
          date: new Date(data.date + 'T00:00:00Z'),
          startTime: data.startTime,
          endTime: data.endTime,
          hours: data.hours,
          reason: data.reason,
          applicantId: data.applicantId,
          departmentId: data.departmentId,
        },
      });
      return { id: row.id };
    },

    async getOvertimeById(id: number): Promise<OvertimeView | null> {
      const row = await prisma.overtime.findUnique({
        where: { id },
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
        },
      });
      return row ? toView(row) : null;
    },

    async setStatus(id: number, status: string): Promise<void> {
      await prisma.overtime.update({ where: { id }, data: { status } });
    },

    // 加班统计：按月份聚合，totalHours/approvedCount 只统计 approved；pendingCount 统计待审批
    async getStats(scope: DepartmentScope, month: string): Promise<OvertimeStats> {
      const rows = await prisma.overtime.findMany({ where: scopeWhere(scope) });
      const inMonth = rows.filter((r) => r.date.toISOString().slice(0, 7) === month);
      const approvedHours = inMonth
        .filter((r) => r.status === 'approved')
        .reduce((sum, r) => sum + r.hours, 0);
      return {
        totalHours: Math.round(approvedHours * 10) / 10,
        approvedCount: inMonth.filter((r) => r.status === 'approved').length,
        pendingCount: inMonth.filter((r) => r.status === 'pending').length,
        month,
      };
    },
  };
}