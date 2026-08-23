import request from '@/lib/request';

export interface Broadcast {
  id: number;
  title: string;
  content: string;
  summary?: string;
  status: 'draft' | 'published' | 'archived';
  recipientType: 'all' | 'department' | 'user';
  priority: 'normal' | 'important' | 'urgent' | number;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  recipients?: BroadcastRecipient[];
}

export interface BroadcastRecipient {
  id: number;
  broadcastId: number;
  recipientType: 'all' | 'department' | 'user';
  departmentId?: number;
  userId?: number;
}

export interface BroadcastCreateDto {
  title: string;
  content: string;
  type?: string;
  priority?: number;
  recipientType: 'all' | 'department' | 'user';
  recipientDepartmentIds?: number[];
  recipientUserIds?: number[];
}

export interface BroadcastUpdateDto {
  title?: string;
  content?: string;
  type?: string;
  priority?: number;
  recipientType?: 'all' | 'department' | 'user';
  recipientDepartmentIds?: number[];
  recipientUserIds?: number[];
}

export interface BroadcastListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export interface BroadcastListResult {
  code: number;
  message?: string;
  data?: {
    list: Broadcast[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface BroadcastResult {
  code: number;
  message?: string;
  data?: Broadcast;
}

/**
 * 公告管理 API。
 * 后端管理端点统一挂载在 SystemController(@Controller('system')) 下，
 * 即 /system/broadcasts，区别于 /broadcasts 公开端点（仅已发布、仅查询/已读）。
 */
export const broadcastApi = {
  getList(params: BroadcastListParams = {}): Promise<BroadcastListResult> {
    return request.get('/system/broadcasts', { params });
  },
  getDetail(id: number): Promise<BroadcastResult> {
    return request.get(`/system/broadcasts/${id}`);
  },
  create(data: BroadcastCreateDto): Promise<BroadcastResult> {
    return request.post('/system/broadcasts', data);
  },
  update(id: number, data: BroadcastUpdateDto): Promise<BroadcastResult> {
    return request.put(`/system/broadcasts/${id}`, data);
  },
  publish(id: number): Promise<{ code: number; message?: string }> {
    return request.post(`/system/broadcasts/${id}/publish`);
  },
  remove(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/system/broadcasts/${id}`);
  },
};
