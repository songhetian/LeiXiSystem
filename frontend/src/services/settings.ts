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

export interface SystemInfoData {
  name: string;
  logo: string;
}

export interface SystemInfoResult {
  code: number;
  message?: string;
  data?: SystemInfoData;
}

export interface UploadResult {
  url: string;
  fileName: string;
}

export const settingsApi = {
  list(group?: string): Promise<SettingsListResult> {
    return request.get('/settings', group ? { params: { group } } : undefined);
  },
  get(key: string): Promise<SettingResult> {
    return request.get(`/settings/${key}`);
  },
  /** 系统公开信息（名称/Logo），无需登录 */
  info(): Promise<SystemInfoResult> {
    return request.get('/public/system/info');
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
  /** 上传系统 Logo 图片（复用通用文件上传） */
  uploadLogo(file: File): Promise<{ code: number; data?: UploadResult }> {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/files/upload?bizType=system', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
