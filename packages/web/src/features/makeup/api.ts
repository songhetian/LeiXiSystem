import type { MakeupView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface MakeupList {
  makeups: MakeupView[];
}

export interface CreateMakeupInput {
  recordDate: string; // YYYY-MM-DD
  clockType: 'check_in' | 'check_out';
  clockTime: string; // HH:mm
  reason: string;
}

export const makeupApi = {
  /** 拉取当前用户可见作用域内的补卡申请（后端按部门隔离过滤） */
  async getMakeups(): Promise<MakeupList> {
    return api<MakeupList>('/api/makeups');
  },
  /** 发起补卡申请：departmentId 由后端强制取自当前用户 */
  async createMakeup(data: CreateMakeupInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/makeups', { method: 'POST', body: JSON.stringify(data) });
  },
  /** 审批补卡：approve/reject */
  async setStatus(id: number, status: 'approved' | 'rejected'): Promise<null> {
    return api<null>(`/api/makeups/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};