import { get, post, put, del } from './request'

export interface Department {
  id: number
  name: string
  parentId?: number
  parentName?: string
  description?: string
  managerId?: number
  managerName?: string
  sortOrder?: number
  status?: string
  createdAt?: string
  children?: Department[]
}

export interface DepartmentListResponse {
  code: 0
  data: Department[]
}

export interface Position {
  id: number
  name: string
  departmentId: number
  departmentName?: string
  description?: string
  requirements?: string
  responsibilities?: string
  salaryMin?: number
  salaryMax?: number
  sortOrder?: number
  status?: string
}

export interface PositionListResponse {
  code: 0
  data: {
    list: Position[]
    total: number
    page: number
    pageSize: number
  }
}

export function getDepartmentTree() {
  return get<{ code: 0; data: Department[] }>('/organization/departments')
}

export function getDepartmentsList(params?: { keyword?: string; status?: string }) {
  return get<DepartmentListResponse>('/organization/departments/list', { params })
}

export function createDepartment(data: Partial<Department>) {
  return post('/organization/departments', data)
}

export function updateDepartment(id: number, data: Partial<Department>) {
  return put(`/organization/departments/${id}`, data)
}

export function deleteDepartment(id: number) {
  return del(`/organization/departments/${id}`)
}

export function batchDeleteDepartments(ids: number[]) {
  return post('/organization/departments/batch-delete', { ids })
}

export function batchUpdateDepartmentStatus(ids: number[], status: string) {
  return post('/organization/departments/batch-status', { ids, status })
}

export function getPositions(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
}) {
  return get<PositionListResponse>('/organization/positions', { params })
}

export function createPosition(data: Partial<Position>) {
  return post('/organization/positions', data)
}

export function updatePosition(id: number, data: Partial<Position>) {
  return put(`/organization/positions/${id}`, data)
}

export function deletePosition(id: number) {
  return del(`/organization/positions/${id}`)
}

export function batchDeletePositions(ids: number[]) {
  return post('/organization/positions/batch-delete', { ids })
}

export function batchUpdatePositionStatus(ids: number[], status: string) {
  return post('/organization/positions/batch-status', { ids, status })
}
