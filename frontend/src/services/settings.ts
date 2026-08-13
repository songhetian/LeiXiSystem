import request from '@/lib/request';

export interface SystemSetting {
  id: number;
  group: string;
  key: string;
  value: string;
  label: string | null;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
  updatedBy: number | null;
}

export interface SettingUpdateInput {
  value: string;
  label?: string;
  description?: string;
  group?: string;
}

export interface SettingBulkItem {
  key: string;
  value: string;
  label?: string;
  description?: string;
  group?: string;
}

export interface SettingsListResult {
  code: number;
  message?: string;
  data?: SystemSetting[];
}

export interface SettingResult {
  code: number;
  message?: string;
  data?: SystemSetting;
}

export interface SettingDeleteResult {
  code: number;
  message?: string;
}

export const settingsApi = {
  list(group?: string): Promise<SettingsListResult> {
    return request.get('/settings', group ? { params: { group } } : undefined);
  },
  get(key: string): Promise<SettingResult> {
    return request.get(`/settings/${key}`);
  },
  update(key: string, data: SettingUpdateInput): Promise<SettingResult> {
    return request.put(`/settings/${key}`, data);
  },
  bulkUpdate(items: SettingBulkItem[]): Promise<SettingsListResult> {
    return request.post('/settings', { items });
  },
  remove(key: string): Promise<SettingDeleteResult> {
    return request.delete(`/settings/${key}`);
  },
};
