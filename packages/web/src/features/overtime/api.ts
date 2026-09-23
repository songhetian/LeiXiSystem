import type { OvertimeStats, OvertimeView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface OvertimeList {
  overtimes: OvertimeView[];
}

export interface CreateOvertimeInput {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  reason: string;
}

export const overtimeApi = {
  /** 拉取当前用户可见作用域内的加班单（后端按部门隔离过滤） */
  async getOvertimes(): Promise<OvertimeList> {
    return api<OvertimeList>('/api/overtimes');
  },
  /** 加班统计：按月份聚合总时长/次数 */
  async getOvertimeStats(month: string): Promise<{ stats: OvertimeStats }> {
    return api<{ stats: OvertimeStats }>(`/api/overtimes/stats?month=${encodeURIComponent(month)}`);
  },
  /** 发起加班申请：departmentId 由后端强制取自当前用户 */
  async createOvertime(data: CreateOvertimeInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/overtimes', { method: 'POST', body: JSON.stringify(data) });
  },
  /** 审批加班：approve/reject */
  async setStatus(id: number, status: 'approved' | 'rejected'): Promise<null> {
    return api<null>(`/api/overtimes/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};