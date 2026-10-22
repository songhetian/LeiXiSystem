import request from '@/lib/request';

/** 首页「待办事项」条目（服务端按 approval:todo:view 权限裁剪，无权限为 []） */
export interface DashboardTodoItem {
  id: number;
  instanceId: number;
  title: string;
  createdAt: string;
}

/** 首页「最新通知」条目 */
export interface DashboardNotificationItem {
  id: number;
  title: string;
  type: string;
  read: boolean;
  createdAt: string;
}

/** 首页「我的申请进度」条目 */
export interface DashboardSubmissionItem {
  id: number;
  title: string;
  status: string;
  createdAt: string;
}

/** 首页「本周考勤概览」（无员工档案时为 null） */
export interface DashboardMyWeek {
  workDays: number;
  lateDays: number;
  absentDays: number;
  avgWorkHours: number;
}

export interface DashboardStats {
  employeeCount: number;
  attendanceCount: number;
  todayLateCount: number;
  monthOvertimeHours: number;
  pendingApprovals: number;
  monthlySalary: number | null;
  employeeId: number | null;
  /** 待办前 4 条：无权限/异常时为 []（服务端静默降级，避免 403 噪音）；旧后端无此字段 */
  todoTop?: DashboardTodoItem[] | null;
  /** 最新 3 条通知；异常时为 []；旧后端无此字段 */
  notificationTop?: DashboardNotificationItem[] | null;
  /** 最近 3 条我的申请；异常时为 []；旧后端无此字段 */
  mySubmissionsTop?: DashboardSubmissionItem[] | null;
  /** 本周考勤概览：无员工档案为 null，无日报为全 0；旧后端无此字段 */
  myWeek?: DashboardMyWeek | null;
}

export interface DashboardStatsResult {
  code: number;
  message?: string;
  data?: DashboardStats;
}

export interface DepartmentStat {
  id: number;
  name: string;
  count: number;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
}

export const dashboardApi = {
  getStats(): Promise<DashboardStatsResult> {
    return request.get('/dashboard/stats');
  },
  getDepartmentStats(): Promise<{ code: number; message?: string; data?: DepartmentStat[] }> {
    return request.get('/dashboard/department-stats');
  },
  getAttendanceTrend(days = 7): Promise<{ code: number; message?: string; data?: AttendanceTrendPoint[] }> {
    return request.get('/dashboard/attendance-trend', { params: { days } });
  },
};
