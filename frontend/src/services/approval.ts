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
  /** 流程编码：可留空，由后端自动生成 */
  code?: string;
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

export interface ApprovalGroupMember {
  id: number;
  groupId: number;
  userId: number;
}

export interface ApprovalGroup {
  id: number;
  name: string;
  code: string;
  description?: string;
  status: number;
  createdAt: string;
  updatedAt: string;
  members?: ApprovalGroupMember[];
}

export interface GroupCreateDto {
  name: string;
  /** 组编码：可留空，由后端自动生成 */
  code?: string;
  description?: string;
  memberIds?: number[];
}

export interface GroupUpdateDto {
  name?: string;
  description?: string;
  status?: number;
  memberIds?: number[];
}

// 职责授权 · 角色 ↔ 审批流程绑定
export interface RoleWorkflowItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  workflowId?: number | null;
  workflowName?: string | null;
  workflowStatus?: string | null;
}

export interface RoleWorkflowListResult {
  code: number;
  message?: string;
  data?: RoleWorkflowItem[];
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

  listGroups(params: PaginationParams & { keyword?: string } = {}): Promise<ListResult<ApprovalGroup>> {
    return request.get('/approval/groups', { params });
  },

  getGroup(id: number): Promise<DetailResult<ApprovalGroup>> {
    return request.get(`/approval/groups/${id}`);
  },

  createGroup(data: GroupCreateDto): Promise<DetailResult<ApprovalGroup>> {
    return request.post('/approval/groups', data);
  },

  updateGroup(id: number, data: GroupUpdateDto): Promise<DetailResult<ApprovalGroup>> {
    return request.put(`/approval/groups/${id}`, data);
  },

  deleteGroup(id: number): Promise<DetailResult<any>> {
    return request.delete(`/approval/groups/${id}`);
  },

  listRoleWorkflows(): Promise<RoleWorkflowListResult> {
    return request.get('/approval/roles/workflows');
  },

  setRoleWorkflow(roleId: number, workflowId: number | null): Promise<DetailResult<any>> {
    return request.put(`/approval/roles/${roleId}/workflow`, { workflowId });
  },
};
