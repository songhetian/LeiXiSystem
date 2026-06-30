import { get, post, put, del } from './request'

export interface OvertimeType {
  id: number
  name: string
  code: string
  description?: string
  payRate: number
  minMinutes: number
  maxMinutes?: number
  requireApproval: boolean
  departmentId?: number
  status: string
  sortOrder: number
  department?: { id: number; name: string }
  creator?: { id: number; realName: string }
  createdAt: string
  updatedAt: string
}

export function getOvertimeTypes(params?: {
  page?: number
  pageSize?: number
  status?: string
  departmentId?: number
  keyword?: string
}) {
  return get<{
    code: 0
    data: {
      list: OvertimeType[]
      total: number
      page: number
      pageSize: number
    }
  }>('/attendance/overtime-types', { params })
}

export function getAllOvertimeTypes() {
  return get<{
    code: 0
    data: OvertimeType[]
  }>('/attendance/overtime-types/all')
}

export function getOvertimeType(id: number) {
  return get<{
    code: 0
    data: OvertimeType
  }>(`/attendance/overtime-types/${id}`)
}

export function createOvertimeType(data: {
  name: string
  code: string
  description?: string
  payRate?: number
  minMinutes?: number
  maxMinutes?: number
  requireApproval?: boolean
  departmentId?: number
  status?: string
  sortOrder?: number
}) {
  return post<{
    code: 0
    data: OvertimeType
  }>('/attendance/overtime-types', data)
}

export function updateOvertimeType(id: number, data: any) {
  return put<{
    code: 0
    data: OvertimeType
  }>(`/attendance/overtime-types/${id}`, data)
}

export function deleteOvertimeType(id: number) {
  return del(`/attendance/overtime-types/${id}`)
}
