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
};
