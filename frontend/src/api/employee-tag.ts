import { get, post, put, del } from './request'

export interface EmployeeTag {
  id: number
  name: string
  color?: string
  description?: string
  sortOrder: number
  status: string
  employeeCount?: number
  createdAt: string
  updatedAt: string
}

export interface EmployeeTagAssignment {
  id: number
  tagId: number
  employeeId: number
  createdAt: string
  employee?: {
    id: number
    name: string
    employeeNo: string
    department?: { id: number; name: string }
    position?: { id: number; name: string }
  }
}

export function getEmployeeTags(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}) {
  return get('/employee-tags', { params })
}

export function getEmployeeTag(id: number) {
  return get(`/employee-tags/${id}`)
}

export function createEmployeeTag(data: {
  name: string
  color?: string
  description?: string
  sortOrder?: number
  status?: string
}) {
  return post('/employee-tags', data)
}

export function updateEmployeeTag(id: number, data: {
  name?: string
  color?: string
  description?: string
  sortOrder?: number
  status?: string
}) {
  return put(`/employee-tags/${id}`, data)
}

export function deleteEmployeeTag(id: number) {
  return del(`/employee-tags/${id}`)
}

export function getTagEmployees(id: number, params?: {
  page?: number
  pageSize?: number
  keyword?: string
}) {
  return get(`/employee-tags/${id}/employees`, { params })
}

export function addEmployeesToTag(id: number, employeeIds: number[]) {
  return post(`/employee-tags/${id}/employees`, { employeeIds })
}

export function removeEmployeeFromTag(id: number, employeeId: number) {
  return del(`/employee-tags/${id}/employees/${employeeId}`)
}

export function getEmployeeTagsByEmployee(employeeId: number) {
  return get(`/employees/${employeeId}/tags`)
}
