import { get, post, put } from './request'

export interface PendingApproval {
  id: number
  type: 'leave' | 'overtime' | 'reimbursement'
  typeName: string
  title: string
  applicant: string
  amount: string
  status: string
  createdAt: string
}

export interface ApprovalFlow {
  id: number
  name: string
  type: string
  description?: string
  isDefault: boolean
  status: string
  nodes?: ApprovalFlowNode[]
  createdAt: string
  updatedAt: string
}

export interface ApprovalFlowNode {
  id: number
  workflowId: number
  nodeName: string
  nodeType: string
  nodeOrder: number
  approverType?: string
  approverIds?: number[]
  conditions?: string
}

interface ListResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

interface ApiResponse<T> {
  code: number
  data: T
  message?: string
}

export function getPendingApproval(params: {
  page?: number
  pageSize?: number
  type?: string
}) {
  return get<ApiResponse<ListResponse<PendingApproval>>>('/approval/pending', { params })
}

export function getApprovalHistory(params: {
  page?: number
  pageSize?: number
}) {
  return get<ApiResponse<ListResponse<any>>>('/approval/history', { params })
}

export function getApprovalFlows() {
  return get<ApiResponse<ApprovalFlow[]>>('/approval/flows')
}

export function createApprovalFlow(data: {
  name: string
  type: string
  description?: string
  isDefault?: boolean
  status?: string
}) {
  return post<ApiResponse<ApprovalFlow>>('/approval/flows', data)
}

export function updateApprovalFlow(
  id: number,
  data: { nodes?: any[]; [key: string]: any },
) {
  return put<ApiResponse<ApprovalFlow>>(`/approval/flows/${id}`, data)
}
