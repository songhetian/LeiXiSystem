import request from '@/lib/request';

export interface Notification {
  id: number;
  title: string;
  content?: string | null;
  type: string;
  read: boolean;
  readAt?: string | null;
  relatedId?: number | null;
  relatedType?: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  read?: boolean;
  type?: string;
}

export interface NotificationListResult {
  code: number;
  message?: string;
  data?: { list: Notification[]; total: number; page: number; pageSize: number };
}

export interface UnreadCountResult {
  code: number;
  message?: string;
  data?: { count: number };
}

// ---- 通知发送（批次八 · 对齐通知中心发送，仅管理员） ----
export interface NotificationSendParams {
  title: string;
  content?: string;
  type?: string;
  targetType: 'all' | 'department' | 'user';
  departmentIds?: number[];
  userIds?: number[];
}

export const notificationApi = {
  list(params: NotificationListParams = {}): Promise<NotificationListResult> {
    return request.get('/notifications', { params });
  },
  unreadCount(): Promise<UnreadCountResult> {
    return request.get('/notifications/unread-count');
  },
  markRead(id: number): Promise<{ code: number; message?: string }> {
    return request.post(`/notifications/${id}/read`);
  },
  markAllRead(): Promise<{ code: number; message?: string }> {
    return request.post('/notifications/read-all');
  },
  send(data: NotificationSendParams): Promise<{ code: number; message?: string; data?: { count: number } }> {
    return request.post('/notifications/send', data);
  },
};

// ---- 通知推送目标角色配置（对齐参考 NotificationSettings 独立页） ----
export interface NotificationSettingItem {
  eventType: string;
  targetRoles: string[];
}

export interface TargetRoleOption {
  value: string;
  label: string;
}

export interface NotificationSettingListResult {
  code: number;
  message?: string;
  data?: NotificationSettingItem[];
}

export interface TargetRoleListResult {
  code: number;
  message?: string;
  data?: TargetRoleOption[];
}

export const notificationSettingApi = {
  // 全部事件的通知推送目标配置
  list(): Promise<NotificationSettingListResult> {
    return request.get('/notification-settings');
  },
  // 可选推送目标（伪角色 + 系统角色）
  listRoles(): Promise<TargetRoleListResult> {
    return request.get('/notification-settings/roles');
  },
  // 更新/新建某事件的目标角色
  setTargetRoles(eventType: string, targetRoles: string[]): Promise<{ code: number; message?: string }> {
    return request.put(`/notification-settings/${eventType}`, { targetRoles });
  },
};
