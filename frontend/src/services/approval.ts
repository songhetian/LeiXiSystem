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

export interface ApprovedItem {
  id: number;
  instanceId: number;
  title: string;
  workflowName: string;
  workflowCode: string;
  applicantName: string;
  nodeName: string;
  action: string;
  comment?: string;
  instanceStatus: string;
  handledAt: string;
  createdAt: string;
  currentNodeName?: string;
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

export interface WorkflowNode {
  id?: number;
  nodeKey: string;
  name: string;
  type: string;
  roleCode?: string;
  approvalGroupId?: number;
  order: number;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
}

export interface Workflow {
  id: number;
  code: string;
  name: string;
  module: string;
  status: string;
  nodes: WorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCreateDto {
  code: string;
  name: string;
  module: string;
  status?: string;
  nodes?: WorkflowNode[];
}

export interface WorkflowUpdateDto {
  name?: string;
  module?: string;
  status?: string;
  nodes?: WorkflowNode[];
}

export interface StartInstanceDto {
  workflowCode: string;
  title: string;
  formData?: Record<string, any>;
  departmentId?: number;
}

export interface WorkflowListResult {
  code: number;
  message?: string;
  data?: Workflow[];
}

export interface WorkflowDetailResult {
  code: number;
  message?: string;
  data?: Workflow;
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

  listWorkflows(module?: string): Promise<WorkflowListResult> {
    return request.get('/approval/workflows', { params: { module } });
  },

  getWorkflow(id: number): Promise<WorkflowDetailResult> {
    return request.get(`/approval/workflows/${id}`);
  },

  createWorkflow(data: WorkflowCreateDto): Promise<WorkflowDetailResult> {
    return request.post('/approval/workflows', data);
  },

  updateWorkflow(id: number, data: WorkflowUpdateDto): Promise<WorkflowDetailResult> {
    return request.put(`/approval/workflows/${id}`, data);
  },

  deleteWorkflow(id: number): Promise<DetailResult<any>> {
    return request.delete(`/approval/workflows/${id}`);
  },

  startInstance(data: StartInstanceDto): Promise<DetailResult<any>> {
    return request.post('/approval/instances', data);
  },

  listAvailableWorkflows(module?: string): Promise<WorkflowListResult> {
    return request.get('/approval/workflows/available', { params: { module } });
  },

  listMyApproved(params: SubmissionsParams = {}): Promise<ListResult<ApprovedItem>> {
    return request.get('/approval/my-approved', { params });
  },
};
