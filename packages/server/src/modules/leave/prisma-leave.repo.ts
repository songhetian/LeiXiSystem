import type { Prisma, PrismaClient } from '@prisma/client';
import type { LeaveView } from '@leixi/shared';
import type { DepartmentScope } from './department-scope';

type LeaveRow = Prisma.LeaveGetPayload<{
  include: {
    applicant: { select: { realName: true } };
    department: { select: { name: true } };
  };
}>;

type LeavePrisma = Pick<PrismaClient, 'leave'>;

/** 把 scope 翻译成 Prisma where：隔离关键防线——subtree 强制限定 departmentId 集合 */
function scopeWhere(scope: DepartmentScope): Prisma.LeaveWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(l: LeaveRow): LeaveView {
  return {
    id: l.id,
    type: l.type,
    reason: l.reason,
    startAt: l.startAt.toISOString(),
    endAt: l.endAt.toISOString(),
    status: l.status,
    applicantId: l.applicantId,
    departmentId: l.departmentId,
    applicantName: l.applicant.realName,
    departmentName: l.department.name,
  };
}

/**
 * Prisma 实现的 LeaveRepo：所有查询都基于外部注入的 scope 过滤，
 * 调用方（路由层）必须先解析当前用户 scope 再传入，杜绝越权。
 */
export function createPrismaLeaveRepo(prisma: LeavePrisma) {
  return {
    async listLeaves(scope: DepartmentScope): Promise<LeaveView[]> {
      const rows = await prisma.leave.findMany({
        where: scopeWhere(scope),
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
        },
        orderBy: { id: 'desc' },
      });
      return rows.map(toView);
    },

    async createLeave(data: {
      type: string;
      reason: string;
      startAt: string;
      endAt: string;
      applicantId: number;
      departmentId: number;
    }): Promise<{ id: number }> {
      const row = await prisma.leave.create({
        data: {
          type: data.type,
          reason: data.reason,
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          applicantId: data.applicantId,
          departmentId: data.departmentId,
        },
      });
      return { id: row.id };
    },

    async getLeaveById(id: number): Promise<LeaveView | null> {
      const row = await prisma.leave.findUnique({
        where: { id },
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
        },
      });
      return row ? toView(row) : null;
    },

    async setStatus(id: number, status: string): Promise<void> {
      await prisma.leave.update({ where: { id }, data: { status } });
    },
  };
}