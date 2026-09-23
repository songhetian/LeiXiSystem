import type { LeaveQuotaView, LeaveTypeView, LeaveTrendPoint } from '@leixi/shared';
import { api } from '../../lib/api';

export interface LeaveTypesPayload {
  leaveTypes: LeaveTypeView[];
}
export interface QuotasPayload {
  quotas: LeaveQuotaView[];
}
export interface TrendPayload {
  trend: LeaveTrendPoint[];
}
export interface ImportResult {
  count: number;
  skipped: number;
}

export interface CreateLeaveTypeInput {
  name: string;
  unit: string;
  allowance: number;
  description?: string | null;
}
export interface UpdateLeaveTypeInput {
  name?: string;
  unit?: string;
  allowance?: number;
  isActive?: boolean;
  description?: string | null;
}

export const leaveTypeApi = {
  async list(): Promise<LeaveTypesPayload> {
    return api<LeaveTypesPayload>('/api/leave-types');
  },
  async create(data: CreateLeaveTypeInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/leave-types', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: number, data: UpdateLeaveTypeInput): Promise<null> {
    return api<null>(`/api/leave-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async remove(id: number): Promise<null> {
    return api<null>(`/api/leave-types/${id}`, { method: 'DELETE' });
  },
};

export const quotaApi = {
  async list(year: number): Promise<QuotasPayload> {
    return api<QuotasPayload>(`/api/leave-quotas?year=${year}`);
  },
  async set(userId: number, year: number, leaveTypeId: number, allowance: number, used: number): Promise<null> {
    return api<null>(`/api/leave-quotas/${userId}/${year}/${leaveTypeId}`, {
      method: 'PUT',
      body: JSON.stringify({ allowance, used }),
    });
  },
  async import(year: number, file: string): Promise<ImportResult> {
    return api<ImportResult>(`/api/leave-quotas/import?year=${year}`, {
      method: 'POST',
      body: JSON.stringify({ file }),
    });
  },
  async trend(year: number): Promise<TrendPayload> {
    return api<TrendPayload>(`/api/leave/trend?year=${year}`);
  },
};