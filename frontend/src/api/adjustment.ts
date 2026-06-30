import { get, post } from './request'

export interface LeaveAdjustment {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: string
  currentStep: number
  createdAt: string
}

export interface OvertimeAdjustment {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  overtimeType: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
  status: string
  currentStep: number
  createdAt: string
}

export interface ShiftChange {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  originalShift: string
  targetShift: string
  date: string
  reason: string
  status: string
  createdAt: string
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

export function getAdjustmentLeave(params: {
  page?: number
  pageSize?: number
  status?: string
  leaveType?: string
  departmentId?: number
  keyword?: string
}) {
  return get<ApiResponse<ListResponse<LeaveAdjustment>>>('/adjustment/leave', { params })
}

export function applyAdjustmentLeave(data: {
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
}) {
  return post<ApiResponse<any>>('/adjustment/leave', data)
}

export function cancelAdjustmentLeave(id: number) {
  return post<ApiResponse<any>>(`/adjustment/leave/${id}/cancel`)
}

export function getAdjustmentOvertime(params: {
  page?: number
  pageSize?: number
  status?: string
  overtimeType?: string
  departmentId?: number
  keyword?: string
}) {
  return get<ApiResponse<ListResponse<OvertimeAdjustment>>>('/adjustment/overtime', { params })
}

export function applyAdjustmentOvertime(data: {
  overtimeType: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
}) {
  return post<ApiResponse<any>>('/adjustment/overtime', data)
}

export function cancelAdjustmentOvertime(id: number) {
  return post<ApiResponse<any>>(`/adjustment/overtime/${id}/cancel`)
}

export function getShiftChangeList(params: {
  page?: number
  pageSize?: number
  status?: string
}) {
  return get<ApiResponse<ListResponse<ShiftChange>>>('/adjustment/shift-change', { params })
}

export function batchApproveLeave(ids: number[], opinion?: string) {
  return post('/adjustment/leave/batch-approve', { ids, opinion })
}

export function batchRejectLeave(ids: number[], opinion?: string) {
  return post('/adjustment/leave/batch-reject', { ids, opinion })
}
