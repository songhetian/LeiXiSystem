import { get, post } from './request'

// ===== 员工信息变更类型 =====
export interface EmployeeInfoChangeRequest {
  id: number
  employeeId: number
  requesterId: number
  approverId?: number
  type: 'basic_info' | 'contact_info' | 'position_info' | 'other'
  changeData: Record<string, any>
  originalData: Record<string, any>
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason?: string
  approvalComment?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
  employee?: {
    employeeNo: string
    user: {
      realName: string
      department?: { name: string }
    }
  }
  requester?: {
    realName: string
  }
  approver?: {
    realName: string
  }
}

export interface EmployeeInfoChangeListResponse {
  code: 0
  data: {
    list: EmployeeInfoChangeRequest[]
    total: number
    page: number
    pageSize: number
  }
}

// ===== API 函数 =====

/**
 * 获取信息变更申请列表
 */
export function getInfoChanges(params?: {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  scope?: 'mine' | 'pending_approval' | 'all'
  keyword?: string
}) {
  return get<EmployeeInfoChangeListResponse>('/employee/info-changes', { params })
}

/**
 * 获取信息变更申请详情
 */
export function getInfoChangeDetail(id: number) {
  return get<{ code: 0; data: EmployeeInfoChangeRequest }>(`/employee/info-changes/${id}`)
}

/**
 * 提交信息变更申请
 */
export function createInfoChange(data: {
  employeeId: number
  type: 'basic_info' | 'contact_info' | 'position_info' | 'other'
  changeData: Record<string, any>
  reason?: string
}) {
  return post<{ code: 0; data: EmployeeInfoChangeRequest }>('/employee/info-changes', data)
}

/**
 * 审批通过
 */
export function approveInfoChange(id: number, data?: { approvalComment?: string }) {
  return post<{ code: 0; message: string }>(`/employee/info-changes/${id}/approve`, data)
}

/**
 * 审批驳回
 */
export function rejectInfoChange(id: number, data: { approvalComment: string }) {
  return post<{ code: 0; message: string }>(`/employee/info-changes/${id}/reject`, data)
}

/**
 * 撤销申请
 */
export function cancelInfoChange(id: number) {
  return post<{ code: 0; message: string }>(`/employee/info-changes/${id}/cancel`)
}
