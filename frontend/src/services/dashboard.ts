import request from '@/lib/request';

export interface DashboardStats {
  employeeCount: number;
  attendanceCount: number;
  todayLateCount: number;
  monthOvertimeHours: number;
  pendingApprovals: number;
  monthlySalary: number | null;
  employeeId: number | null;
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
