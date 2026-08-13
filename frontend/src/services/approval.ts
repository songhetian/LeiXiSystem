import request from '@/lib/request';

export interface TodoItem {
  id: number;
  instanceId: number;
  title: string;
  module: string;
  workflowName: string;
  submitterId?: number;
  submitterName: string;
  submitterDepartment: string;
  submitTime: string;
  currentNodeName: string;
  status: string;
}

export interface SubmissionItem {
  id: number;
  instanceId: number;
  title: string;
  module: string;
  workflowName: string;
  currentNodeName: string;
  status: string;
  submitTime: string;
}

export interface ApprovalRecord {
  id: number;
  nodeName: string;
  approverName: string;
  action: string;
  comment?: string;
  operateTime: string;
}

export interface InstanceDetail {
  id: number;
  title: string;
  module: string;
  workflowName: string;
  status: string;
  submitterName: string;
  submitterDepartment: string;
  submitTime: string;
  formData?: Record<string, any>;
  records: ApprovalRecord[];
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SubmissionsParams extends PaginationParams {
  status?: string;
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export interface ApprovalActionParams {
  comment?: string;
}

export const approvalApi = {
  listTodos(params: PaginationParams = {}): Promise<ListResult<TodoItem>> {
    return request.get('/approval/todos', { params });
  },

  listMySubmissions(params: SubmissionsParams = {}): Promise<ListResult<SubmissionItem>> {
    return request.get('/approval/my-submissions', { params });
  },

  getInstance(id: number): Promise<DetailResult<InstanceDetail>> {
    return request.get(`/approval/instances/${id}`);
  },

  approve(id: number, params: ApprovalActionParams): Promise<DetailResult<any>> {
    return request.post(`/approval/instances/${id}/approve`, params);
  },

  reject(id: number, params: ApprovalActionParams): Promise<DetailResult<any>> {
    return request.post(`/approval/instances/${id}/reject`, params);
  },
};
