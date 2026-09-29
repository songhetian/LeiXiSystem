import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { beijingBusinessDate, beijingNow, monthRangeUtc } from '../common/date.util';
import { ApprovalClientInterface } from '../approval/approval-client.interface';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject('APPROVAL_CLIENT') private approvalClient: ApprovalClientInterface,
  ) {}

  async getStats(userId: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { id: true, departmentId: true },
    });

    const employeeCount = await this.prisma.employee.count({
      where: { status: 'active' },
    });

    // 考勤「今天」是北京业务日（生产容器 TZ=UTC，用服务器本地日期会在北京 00:00~08:00 退回前一天）
    const todayWorkDate = beijingBusinessDate();

    const attendanceCount = await this.prisma.attendanceDaily.count({
      where: { workDate: todayWorkDate, status: { not: 'absent' } },
    });

    // 今日迟到：今日 attendanceDaily 中状态为迟到/迟到早退的条数
    const todayLateCount = await this.prisma.attendanceDaily.count({
      where: { workDate: todayWorkDate, status: { in: ['late', 'late_early'] } },
    });

    // 本月加班：当月 overtimeMinutes 总和换算为小时（保留 1 位小数）；月份同样以北京时间为准
    const { year, month } = beijingNow();
    const { start: monthStart, end: monthEnd } = monthRangeUtc(
      `${year}-${String(month).padStart(2, '0')}`,
    );
    const overtimeAgg = await this.prisma.attendanceDaily.aggregate({
      where: { workDate: { gte: monthStart, lt: monthEnd } },
      _sum: { overtimeMinutes: true },
    });
    const monthOvertimeHours = Math.round((((overtimeAgg._sum.overtimeMinutes ?? 0) / 60) * 10)) / 10;

    // 待审批数必须与待办列表（listTodos）同口径：建实例时写入的审批记录不带
    // approverId（该字段只在加签/转交/实际处理时写入），旧的 count(approverId=userId)
    // 对角色型/审批组型节点恒为 0，首页徽标长期不显示。
    const pendingApprovals = await this.approvalClient.countPendingForUser(userId);

    return {
      employeeCount,
      attendanceCount,
      todayLateCount,
      monthOvertimeHours,
      pendingApprovals,
      monthlySalary: null,
      employeeId: employee?.id || null,
    };
  }

  async getAttendanceTrend(days: number = 7) {
    const result: { date: string; present: number; absent: number; late: number; leave: number }[] = [];
    const today = beijingBusinessDate();

    for (let i = days - 1; i >= 0; i--) {
      const workDate = new Date(today.getTime() - i * DAY_MS);
      const dateStr = workDate.toISOString().slice(0, 10);

      const records = await this.prisma.attendanceDaily.findMany({
        where: { workDate },
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
