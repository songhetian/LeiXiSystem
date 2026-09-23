import type { LeaveView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface LeaveList {
  leaves: LeaveView[];
}

export const leaveApi = {
  /** 拉取当前用户可见作用域内的请假单（后端按部门隔离过滤） */
  async getLeaves(): Promise<LeaveList> {
    return api<LeaveList>('/api/leaves');
  },
  /** 发起请假：departmentId 由后端强制取自当前用户 */
  async createLeave(data: {
    type: string;
    reason: string;
    startAt: string;
    endAt: string;
  }): Promise<{ id: number }> {
    return api<{ id: number }>('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 审批请假：status='approved'|'rejected'；跨部门在后端被 403 拦截 */
  async setStatus(id: number, status: 'approved' | 'rejected'): Promise<void> {
    await api<void>(`/api/leaves/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};