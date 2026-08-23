import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 本地日期转 `YYYY-MM-DD`（不使用 UTC，避免跨时区日期错位） */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { id: true, departmentId: true },
    });

    const employeeCount = await this.prisma.employee.count({
      where: { status: 'active' },
    });

    const today = new Date();
    // Prisma DateTime 字段必须传 Date，而非 `YYYY-MM-DD` 字符串
    const todayStr = localDateStr(today);

    const attendanceCount = await this.prisma.attendanceDaily.count({
      where: { workDate: new Date(todayStr), status: { not: 'absent' } },
    });

    const pendingApprovals = await this.prisma.approvalRecord.count({
      where: { approverId: userId, status: 'pending' },
    });

    return {
      employeeCount,
      attendanceCount,
      pendingApprovals,
      monthlySalary: null,
      employeeId: employee?.id || null,
    };
  }

  async getAttendanceTrend(days: number = 7) {
    const result: { date: string; present: number; absent: number; late: number; leave: number }[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = localDateStr(d);

      const records = await this.prisma.attendanceDaily.findMany({
        where: { workDate: new Date(dateStr) },
        select: { status: true },
      });

      result.push({
        date: dateStr,
        present: records.filter((r) => r.status === 'normal' || r.status === 'late' || r.status === 'early' || r.status === 'late_early').length,
        absent: records.filter((r) => r.status === 'absent' || r.status === 'half_absent').length,
        late: records.filter((r) => r.status === 'late' || r.status === 'late_early').length,
        leave: records.filter((r) => r.status === 'leave').length,
      });
    }

    return result;
  }

  async getDepartmentStats() {
    const depts = await this.prisma.department.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { employees: { where: { status: 'active' } } } },
      },
      orderBy: { id: 'asc' },
    });

    return depts.map((d) => ({
      id: d.id,
      name: d.name,
      count: d._count.employees,
    }));
  }
}
