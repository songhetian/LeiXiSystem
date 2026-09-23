import type { AttSettingView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface SettingPayload {
  setting: AttSettingView;
}

/** 考勤设置保存入参 = 视图本身（全量覆盖单例配置） */
export type AttSettingInput = AttSettingView;

export const attSettingApi = {
  /** 读取系统级单例考勤设置 */
  async getSetting(): Promise<SettingPayload> {
    return api<SettingPayload>('/api/attendance/settings');
  },
  /** 全量覆盖保存考勤设置 */
  async updateSetting(data: AttSettingInput): Promise<SettingPayload> {
    return api<SettingPayload>('/api/attendance/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};