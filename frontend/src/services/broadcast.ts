import request from '@/lib/request';

export interface Broadcast {
  id: number;
  title: string;
  content: string;
  summary?: string;
  status: 'draft' | 'published' | 'archived';
  recipientType: 'all' | 'department' | 'user';
  priority: 'normal' | 'important' | 'urgent';
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
  summary?: string;
  priority?: string;
  recipientType: 'all' | 'department' | 'user';
  recipientDepartmentIds?: number[];
  recipientUserIds?: number[];
}

export interface BroadcastUpdateDto {
  title?: string;
  content?: string;
  summary?: string;
  priority?: string;
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

export const broadcastApi = {
  getList(params: BroadcastListParams = {}): Promise<BroadcastListResult> {
    return request.get('/broadcasts', { params });
  },
  getDetail(id: number): Promise<BroadcastResult> {
    return request.get(`/broadcasts/${id}`);
  },
  create(data: BroadcastCreateDto): Promise<BroadcastResult> {
    return request.post('/broadcasts', data);
  },
  update(id: number, data: BroadcastUpdateDto): Promise<BroadcastResult> {
    return request.put(`/broadcasts/${id}`, data);
  },
  publish(id: number): Promise<{ code: number; message?: string }> {
    return request.post(`/broadcasts/${id}/publish`);
  },
  remove(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/broadcasts/${id}`);
  },
};
