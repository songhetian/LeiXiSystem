import type { DashboardStatsView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface DashboardStats {
  /** 工作台聚合统计（后端按部门 scope 隔离并经各模块 view 权限条件收敛） */
  stats: DashboardStatsView;
}

export const dashboardApi = {
  /** 拉取工作台聚合指标 */
  async getStats(): Promise<DashboardStats> {
    return api<DashboardStats>('/api/dashboard/stats');
  },
};