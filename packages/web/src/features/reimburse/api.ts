import type { ReimburseItemInput, ReimburseView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface ReimburseList {
  reimburses: ReimburseView[];
}

/** 创建报销入参：事由 + 分项列表（至少 1 条，总额由服务端按分项之和计算） */
export interface CreateReimburseInput {
  reason: string;
  items: ReimburseItemInput[];
}

export const reimburseApi = {
  /** 拉取当前用户可见作用域内的报销单（后端按部门隔离过滤） */
  async getReimburses(): Promise<ReimburseList> {
    return api<ReimburseList>('/api/reimburses');
  },
  /** 发起报销：分项上报，departmentId 由后端强制取自当前用户，总额由服务端计算 */
  async createReimburse(data: CreateReimburseInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/reimburses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 审批报销：status='approved'|'rejected'；跨部门在后端被 403 拦截 */
  async setStatus(id: number, status: 'approved' | 'rejected'): Promise<void> {
    await api<void>(`/api/reimburses/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};