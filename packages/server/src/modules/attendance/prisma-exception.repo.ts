import type { Prisma, PrismaClient } from '@prisma/client';
import type { AttendanceExceptionView } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';
import type { ExceptionCandidate } from './exception-detect.pure';

type ExceptionRow = Prisma.AttendanceExceptionGetPayload<{
  include: {
    exceptionUser: { select: { realName: true } };
    exceptionDepartment: { select: { name: true } };
  };
}>;

type ExceptionPrisma = Pick<PrismaClient, 'attendanceException'>;

/** 把 scope 翻译成 Prisma where：subtree 强制限定 departmentId 集合 */
function scopeWhere(scope: DepartmentScope): Prisma.AttendanceExceptionWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(e: ExceptionRow): AttendanceExceptionView {
  return {
    id: e.id,
    type: e.type as AttendanceExceptionView['type'],
    date: e.date,
    minutes: e.minutes,
    status: e.status as AttendanceExceptionView['status'],
    remark: e.remark,
    userId: e.userId,
    departmentId: e.departmentId,
    userName: e.exceptionUser.realName,
    departmentName: e.exceptionDepartment.name,
    updatedAt: e.updatedAt.toISOString(),
  };
}

/**
 * Prisma 实现的考勤异常仓库：列表(scope 隔离) + 扫描落库(upsert) + 人工确认/驳回。
 * 所有查询须先由路由层解析 scope 再传入，杜绝越权。
 */
export function createPrismaExceptionRepo(prisma: ExceptionPrisma) {
  return {
    /** 列表：按 scope 过滤，可按状态/类型筛选，按日期倒序 */
    async listExceptions(
      scope: DepartmentScope,
      filters: { status?: string; type?: string } = {},
    ): Promise<AttendanceExceptionView[]> {
      const rows = await prisma.attendanceException.findMany({
        where: {
          ...scopeWhere(scope),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.type ? { type: filters.type } : {}),
        },
        include: {
          exceptionUser: { select: { realName: true } },
          exceptionDepartment: { select: { name: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toView);
    },

    /** 扫描落库：按 (userId,date,type) 唯一键 upsert。新建计 created，更新计 updated。 */
    async scanUpsert(candidates: ExceptionCandidate[]): Promise<{ created: number; updated: number }> {
      let created = 0;
      let updated = 0;
      for (const c of candidates) {
        const existing = await prisma.attendanceException.findUnique({
          where: { userId_date_type: { userId: c.userId, date: c.date, type: c.type } },
        });
        if (existing) {
          await prisma.attendanceException.update({
            where: { id: existing.id },
            data: { minutes: c.minutes, departmentId: c.departmentId },
          });
          updated++;
        } else {
          await prisma.attendanceException.create({
            data: {
              type: c.type,
              date: c.date,
              minutes: c.minutes,
              status: 'pending',
              userId: c.userId,
              departmentId: c.departmentId,
            },
          });
          created++;
        }
      }
      return { created, updated };
    },

    /** 人工确认/驳回：仅当记录在 scope 内才可操作。返回 'ok' | 'not_found' | 'out_of_scope' */
    async setStatus(
      scope: DepartmentScope,
      id: number,
      status: 'confirmed' | 'dismissed',
      remark?: string | null,
    ): Promise<'ok' | 'not_found' | 'out_of_scope'> {
      const existing = await prisma.attendanceException.findUnique({ where: { id } });
      if (!existing) return 'not_found';
      if (scope.kind === 'subtree' && !scope.departmentIds.includes(existing.departmentId)) {
        return 'out_of_scope';
      }
      await prisma.attendanceException.update({
        where: { id },
        data: { status, remark: remark ?? null },
      });
      return 'ok';
    },
  };
}