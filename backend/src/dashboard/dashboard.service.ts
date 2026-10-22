import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { beijingBusinessDate, beijingNow, monthRangeUtc } from '../common/date.util';
import { PermissionCacheService } from '../common/permission-cache.service';
import { ApprovalClientInterface } from '../approval/approval-client.interface';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 首页「最新通知」条数 */
const NOTIFICATION_TOP_SIZE = 3;
/** 首页「我的申请进度」条数 */
const SUBMISSION_TOP_SIZE = 3;
/** 首页「待办事项」条数 */
const TODO_TOP_SIZE = 4;

/** 出勤口径：正常/迟到/早退/迟到早退/补卡后正常都算「实际出勤」（与考勤趋势 present 同口径，另补 makeup） */
const PRESENT_STATUSES = new Set(['normal', 'late', 'early', 'late_early', 'makeup']);
/** 迟到口径：与「今日迟到」统计一致 */
const LATE_STATUSES = new Set(['late', 'late_early']);
/** 缺勤口径：全天缺勤 + 半天缺勤 */
const ABSENT_STATUSES = new Set(['absent', 'half_absent']);

/** 首页「最新通知」条目（前端渲染所需最小字段集） */
export interface DashboardNotificationItem {
  id: number;
  title: string;
  type: string;
  read: boolean;
  createdAt: Date;
}

/** 首页「我的申请进度」条目 */
export interface DashboardSubmissionItem {
  id: number;
  title: string;
  status: string;
  createdAt: Date;
}

/** 首页「待办事项」条目 */
export interface DashboardTodoItem {
  id: number;
  instanceId: number;
  title: string;
  createdAt: Date;
}

/** 首页「本周考勤概览」 */
export interface DashboardMyWeek {
  /** 正常出勤天数（含迟到/早退/补卡后正常，不含请假/周末/缺勤） */
  workDays: number;
  lateDays: number;
  absentDays: number;
  /** 平均工时（小时，保留 1 位）：按「首打卡 → 末打卡」跨度对有打卡对的日均摊；无打卡数据为 0 */
  avgWorkHours: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject('APPROVAL_CLIENT') private approvalClient: ApprovalClientInterface,
    private permCache: PermissionCacheService,
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

    // ---- 工作台四区块（替换前端 mock）----
    // 每个区块独立 try-catch 降级：任一子查询异常都不允许拖垮 stats 整体（首页永远可用）。
    const notificationTop = await this.safe(
      () => this.getNotificationTop(userId),
      [] as DashboardNotificationItem[],
    );
    const mySubmissionsTop = await this.safe(
      () => this.approvalClient.listMySubmissionsTop(userId, SUBMISSION_TOP_SIZE),
      [] as DashboardSubmissionItem[],
    );
    const todoTop = await this.safe(
      () => this.getTodoTop(userId),
      [] as DashboardTodoItem[],
    );
    const myWeek = await this.safe(() => this.getMyWeek(employee), null as DashboardMyWeek | null);

    return {
      employeeCount,
      attendanceCount,
      todayLateCount,
      monthOvertimeHours,
      pendingApprovals,
      monthlySalary: null,
      employeeId: employee?.id || null,
      notificationTop,
      mySubmissionsTop,
      todoTop,
      myWeek,
    };
  }

  /** 子查询兜底：失败时返回 fallback 并吞掉异常（stats 永远可用，不 500） */
  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  /** 当前用户最新 N 条通知（createdAt 倒序，最小字段集） */
  private async getNotificationTop(userId: number): Promise<DashboardNotificationItem[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATION_TOP_SIZE,
      select: { id: true, title: true, type: true, read: true, createdAt: true },
    });
  }

  /**
   * 当前用户待办前 N 条。
   * /approval/todos 接口带 approval:todo:view 权限守卫，普通员工直连会 403 并触发
   * 全局错误 Toast，故在服务端按权限静默裁剪：无权限返回 []，不抛错、不产生噪音。
   */
  private async getTodoTop(userId: number): Promise<DashboardTodoItem[]> {
    const permissions = await this.permCache.getUserPermissions(userId);
    if (!permissions.has('approval:todo:view')) {
      return [];
    }
    return this.approvalClient.listTodoTop(userId, TODO_TOP_SIZE);
  }

  /**
   * 当前用户本周考勤概览。
   *
   * 口径说明：
   * - 无员工档案（纯管理员账号）→ null，前端显示「—」；有档案但本周无日报 → 全 0。
   * - workDays：status ∈ {normal, late, early, late_early, makeup}（实际出勤，含迟到早退补卡）。
   * - lateDays：status ∈ {late, late_early}；absentDays：status ∈ {absent, half_absent}。
   * - avgWorkHours：按「首打卡 → 末打卡」跨度**扣除当日班次休息时长**（shift.restDuration）
   *   的日均值，与班次定义口径一致；无班次记录（如休息日到岗）不扣休息；
   *   单日扣除后为负（异常短卡）按 0 计，不得拉低均值。
   *
   * 时区铁律：业务日期以 UTC 午夜存储，「本周」按北京时间计算——
   * 周一 00:00 北京 = UTC 周日 16:00；由 beijingBusinessDate（先取北京日历日、
   * 再转 UTC 午夜）的 getUTCDay 倒推周一，不用任何本地时区 getter。
   */
  private async getMyWeek(employee: { id: number } | null): Promise<DashboardMyWeek | null> {
    if (!employee) return null;

    const businessDate = beijingBusinessDate();
    const dow = businessDate.getUTCDay(); // 0=周日
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(businessDate.getTime() - daysSinceMonday * DAY_MS);
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

    const records = await this.prisma.attendanceDaily.findMany({
      where: {
        employeeId: employee.id,
        workDate: { gte: weekStart, lt: weekEnd },
      },
      select: { status: true, firstPunch: true, lastPunch: true, shift: { select: { restDuration: true } } },
    });

    let workDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let punchHoursSum = 0;
    let punchDayCount = 0;

    for (const r of records) {
      if (PRESENT_STATUSES.has(r.status)) workDays += 1;
      if (LATE_STATUSES.has(r.status)) lateDays += 1;
      if (ABSENT_STATUSES.has(r.status)) absentDays += 1;
      if (r.firstPunch && r.lastPunch) {
        const spanHours = (r.lastPunch.getTime() - r.firstPunch.getTime()) / 3_600_000;
        const restHours = (r.shift?.restDuration ?? 0) / 60;
        // 单日扣除休息后为负（异常短卡）按 0 计，避免负值拉低均值
        punchHoursSum += Math.max(0, spanHours - restHours);
        punchDayCount += 1;
      }
    }

    const avgWorkHours =
      punchDayCount > 0 ? Math.round((punchHoursSum / punchDayCount) * 10) / 10 : 0;

    return { workDays, lateDays, absentDays, avgWorkHours };
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
