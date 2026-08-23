import request from '@/lib/request';

export interface DashboardStats {
  employeeCount: number;
  attendanceCount: number;
  pendingApprovals: number;
  monthlySalary: number | null;
  employeeId: number | null;
}

export interface DashboardStatsResult {
  code: number;
  message?: string;
  data?: DashboardStats;
}

export const dashboardApi = {
  getStats(): Promise<DashboardStatsResult> {
    return request.get('/dashboard/stats');
  },
};
