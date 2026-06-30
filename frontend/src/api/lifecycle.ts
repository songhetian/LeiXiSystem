import { get, post, put, del } from './request'

// ===== Lifecycle Events =====

export interface LifecycleEvent {
  id: number
  eventType: string
  title: string
  description?: string
  effectiveDate: string
  status: string
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  creator?: { realName: string }
  createdAt?: string
}

export function getLifecycleEvents(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  eventType?: string
}) {
  return get<{ code: 0; data: { list: LifecycleEvent[]; total: number; page: number; pageSize: number } }>('/lifecycle/events', { params })
}

export function getLifecycleEventDetail(id: number) {
  return get<{ code: 0; data: LifecycleEvent }>(`/lifecycle/events/${id}`)
}

export function createLifecycleEvent(data: any) {
  return post('/lifecycle/events', data)
}

export function updateLifecycleEvent(id: number, data: any) {
  return put(`/lifecycle/events/${id}`, data)
}

export function deleteLifecycleEvent(id: number) {
  return del(`/lifecycle/events/${id}`)
}

export function completeLifecycleEvent(id: number) {
  return post(`/lifecycle/events/${id}/complete`)
}

// ===== Onboarding Tasks =====

export function getOnboardingTasks(params?: any) {
  return get('/lifecycle/onboarding-tasks', { params })
}

export function getOnboardingTaskDetail(id: number) {
  return get(`/lifecycle/onboarding-tasks/${id}`)
}

export function createOnboardingTask(data: any) {
  return post('/lifecycle/onboarding-tasks', data)
}

export function updateOnboardingTask(id: number, data: any) {
  return put(`/lifecycle/onboarding-tasks/${id}`, data)
}

export function deleteOnboardingTask(id: number) {
  return del(`/lifecycle/onboarding-tasks/${id}`)
}

// ===== Offboarding Tasks =====

export function getOffboardingTasks(params?: any) {
  return get('/lifecycle/offboarding-tasks', { params })
}

export function getOffboardingTaskDetail(id: number) {
  return get(`/lifecycle/offboarding-tasks/${id}`)
}

export function createOffboardingTask(data: any) {
  return post('/lifecycle/offboarding-tasks', data)
}

export function updateOffboardingTask(id: number, data: any) {
  return put(`/lifecycle/offboarding-tasks/${id}`, data)
}

export function deleteOffboardingTask(id: number) {
  return del(`/lifecycle/offboarding-tasks/${id}`)
}

// ===== Employee Documents =====

export interface EmployeeDocument {
  id: number
  title: string
  name: string
  documentType: string
  fileUrl?: string
  status: string
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  createdAt?: string
}

export function getEmployeeDocuments(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}) {
  return get<{ code: 0; data: { list: EmployeeDocument[]; total: number; page: number; pageSize: number } }>('/lifecycle/documents', { params })
}

export function createEmployeeDocument(data: any) {
  return post('/lifecycle/documents', data)
}

export function updateEmployeeDocument(id: number, data: any) {
  return put(`/lifecycle/documents/${id}`, data)
}

export function deleteEmployeeDocument(id: number) {
  return del(`/lifecycle/documents/${id}`)
}

// ===== Employee Contracts =====

export interface EmployeeContract {
  id: number
  contractNo: string
  contractType: string
  startDate: string
  endDate?: string
  status: string
  fileUrl?: string
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  createdAt?: string
  updatedAt?: string
}

export function getEmployeeContracts(params?: any) {
  return get<{ code: 0; data: { list: EmployeeContract[]; total: number; page: number; pageSize: number } }>('/lifecycle/contracts', { params })
}

export function createEmployeeContract(data: any) {
  return post('/lifecycle/contracts', data)
}

export function updateEmployeeContract(id: number, data: any) {
  return put(`/lifecycle/contracts/${id}`, data)
}

export function deleteEmployeeContract(id: number) {
  return del(`/lifecycle/contracts/${id}`)
}
