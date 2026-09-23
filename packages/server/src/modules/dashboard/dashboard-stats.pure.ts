import type {
  AttendanceExceptionView,
  AttendanceView,
  DashboardStatsView,
  LeaveView,
  MakeupView,
  OvertimeStats,
  ReimburseView,
} from '@leixi/shared';

/** 仪表盘聚合的可选输入：无权限的模块不传（为 undefined），对应指标聚合为 0 / 空。 */
export interface DashboardStatsInputs {
  month: string; // YYYY-MM
  leaves?: LeaveView[];
  overtimeStats?: OvertimeStats; // 已按 month 聚合的加班统计
  makeups?: MakeupView[];
  reimburses?: ReimburseView[];
  attendances?: AttendanceView[];
  exceptions?: AttendanceExceptionView[];
  /** 作用域内部门数（路由层已按 scope 过滤） */
  departments?: number;
  /** 作用域内员工数（路由层已按 scope 过滤） */
  employees?: number;
}

const PENDING = 'pending';

/** 判断日期字符串是否属于某月（YYYY-MM） */
function inMonth(date: string | undefined, month: string): boolean {
  return !!date && date.startsWith(month);
}

/**
 * 纯函数仪表盘聚合：把各模块（按 scope 取好的、且已是当前用户有权限看到的）数据归并成 DashboardStatsView。
 * 抽查口径：
 *  - approvals：各模块 status === 'pending' 计数（加班直接复用 stats.pendingCount）
 *  - attendance：records 为本月打卡记录数；late/earlyLeave/missingPunch/absent 由本月异常按类型计数
 *  - trend：仅统计本月（leave 看 startAt，补卡看 recordDate，报销看 createdAt，加班时长用 stats.totalHours）
 *  - scale：部门/员工为透传计数值；topCategories 统计「本月报销」的分项类别金额 Top4（空类别归为「未分类」）
 */
export function buildDashboardStats(inputs: DashboardStatsInputs): DashboardStatsView {
  const { month } = inputs;

  const leaves = inputs.leaves ?? [];
  const overtimeStats = inputs.overtimeStats;
  const makeups = inputs.makeups ?? [];
  const reimburses = inputs.reimburses ?? [];
  const attendances = inputs.attendances ?? [];
  const exceptions = inputs.exceptions ?? [];

  // —— 待办审批汇总 ——
  const leavePending = leaves.filter((l) => l.status === PENDING).length;
  const overtimePending = overtimeStats?.pendingCount ?? 0;
  const makeupPending = makeups.filter((m) => m.status === PENDING).length;
  const reimbursePending = reimburses.filter((r) => r.status === PENDING).length;
  const totalPending = leavePending + overtimePending + makeupPending + reimbursePending;

  // —— 本月考勤概览 ——
  const records = attendances.filter((a) => inMonth(a.date, month)).length;
  const byType = (type: AttendanceExceptionView['type']) =>
    exceptions.filter((e) => e.type === type && inMonth(e.date, month)).length;

  // —— 本月趋势 ——
  const monthLeaves = leaves.filter((l) => inMonth(l.startAt, month));
  const monthMakeups = makeups.filter((m) => inMonth(m.recordDate, month));
  const monthReimburses = reimburses.filter((r) => inMonth(r.createdAt, month));
  const monthReimburseAmount = monthReimburses.reduce((acc, r) => acc + Number(r.amount), 0);

  // —— 规模与类别排行 ——
  const byCategory = new Map<string, number>();
  for (const r of monthReimburses) {
    for (const it of r.items) {
      const name = it.categoryName?.trim() || '未分类';
      byCategory.set(name, (byCategory.get(name) ?? 0) + Number(it.amount));
    }
  }
  const topCategories = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  return {
    month,
    approvals: {
      leave: leavePending,
      overtime: overtimePending,
      makeup: makeupPending,
      reimburse: reimbursePending,
      total: totalPending,
    },
    attendance: {
      records,
      late: byType('late'),
      earlyLeave: byType('early_leave'),
      missingPunch: byType('missing_punch'),
      absent: byType('absent'),
    },
    trend: {
      leaves: monthLeaves.length,
      makeupCount: monthMakeups.length,
      overtimeHours: overtimeStats?.totalHours ?? 0,
      reimburseCount: monthReimburses.length,
      reimburseAmount: monthReimburseAmount,
    },
    scale: {
      departments: inputs.departments ?? 0,
      employees: inputs.employees ?? 0,
      topCategories,
    },
  };
}