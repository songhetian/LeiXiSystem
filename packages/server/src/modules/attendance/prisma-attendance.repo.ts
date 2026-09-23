import type { Prisma, PrismaClient } from '@prisma/client';
import type { AttendanceView } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';

type AttendanceRow = Prisma.AttendanceGetPayload<{
  include: {
    attendanceUser: { select: { realName: true } };
    attendanceDepartment: { select: { name: true } };
  };
}>;

type AttendancePrisma = Pick<PrismaClient, 'attendance'>;

/** 把 scope 翻译成 Prisma where：隔离关键防线——subtree 强制限定 departmentId 集合 */
function scopeWhere(scope: DepartmentScope): Prisma.AttendanceWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(l: AttendanceRow): AttendanceView {
  return {
    id: l.id,
    date: l.date.toISOString().slice(0, 10),
    checkIn: l.checkIn,
    checkOut: l.checkOut,
    note: l.note,
    userId: l.userId,
    departmentId: l.departmentId,
    applicantName: l.attendanceUser.realName,
    departmentName: l.attendanceDepartment.name,
  };
}

/**
 * Prisma 实现的 AttendanceRepo：无审批流，仅打卡记录。
 * 所有查询都基于外部注入的 scope 过滤，调用方（路由层）必须先解析 scope 再传入，杜绝越权。
 */
export function createPrismaAttendanceRepo(prisma: AttendancePrisma) {
  return {
    async listAttendances(scope: DepartmentScope): Promise<AttendanceView[]> {
      const rows = await prisma.attendance.findMany({
        where: scopeWhere(scope),
        include: {
          attendanceUser: { select: { realName: true } },
          attendanceDepartment: { select: { name: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toView);
    },

    async createAttendance(data: {
      date: string; // YYYY-MM-DD
      checkIn?: string | null; // HH:mm
      checkOut?: string | null; // HH:mm
      note?: string;
      userId: number;
      departmentId: number;
    }): Promise<{ id: number }> {
      const row = await prisma.attendance.create({
        data: {
          date: new Date(data.date + 'T00:00:00Z'),
          checkIn: data.checkIn ?? null,
          checkOut: data.checkOut ?? null,
          note: data.note ?? '',
          userId: data.userId,
          departmentId: data.departmentId,
        },
      });
      return { id: row.id };
    },
  };
}