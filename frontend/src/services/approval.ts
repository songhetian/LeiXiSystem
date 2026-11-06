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
  /** type='user' 时指定的审批人 userId */
  userId?: number;
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

// 职责授权 · 流程 → 适用角色（role_workflows）
export interface RoleBrief {
  id: number;
  code: string;
  name: string;
}

/** 一条审批流程及其适用角色；`roles` 为空表示还没绑定任何角色 */
export interface WorkflowRoleBinding {
  id: number;
  code: string;
  name: string;
  module: string;
  status: string;
  roles: RoleBrief[];
}

export interface WorkflowRoleBindingList {
  /** 可分配角色全集（页面多选框的数据源，随列表一起下发避免再要一套角色权限） */
  roles: RoleBrief[];
  workflows: WorkflowRoleBinding[];
}

export interface WorkflowRoleBindingListResult {
  code: number;
  message?: string;
  data?: WorkflowRoleBindingList;
}

/** 批量写入方式：覆盖整组角色 / 只追加 / 只移除选中角色 */
export type WorkflowRoleBindMode = 'replace' | 'append' | 'remove';

export interface WorkflowRoleBatchParams {
  workflowIds: number[];
  roleIds: number[];
  mode: WorkflowRoleBindMode;
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

  /** 流程 → 适用角色（含可分配角色全集） */
  listWorkflowRoleBindings(): Promise<WorkflowRoleBindingListResult> {
    return request.get('/approval/role-bindings');
  },

  /** 覆盖式保存某条流程的适用角色；空数组 = 解除全部绑定 */
  setWorkflowRoles(workflowId: number, roleIds: number[]): Promise<DetailResult<any>> {
    return request.put(`/approval/role-bindings/${workflowId}`, { roleIds });
  },

  /**
   * 批量设置多条流程的适用角色（后端单事务写入）。
   * 页面「一键全部覆盖」用它，而不是循环调 setWorkflowRoles：
   * 后者中途失败会留下「一半新一半旧」的配置，管理员无从判断该重试哪些。
   */
  setWorkflowRolesBatch(
    params: WorkflowRoleBatchParams,
  ): Promise<
    DetailResult<{ success: boolean; workflowCount: number; roleCount: number; affected: number }>
  > {
    return request.put('/approval/role-bindings/batch', params);
  },

  /** 可分配角色（审批节点「按角色审批」下拉复用） */
  listRoleOptions(): Promise<DetailResult<RoleBrief[]>> {
    return request.get('/approval/role-options');
  },
};
