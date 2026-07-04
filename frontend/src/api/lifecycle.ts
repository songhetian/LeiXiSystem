import { get, post, put, del } from './request'

// ===== Local request type interfaces =====

export interface CreateLifecycleEventParams {
  eventType: string
  title: string
  description?: string
  effectiveDate: string
  employeeId?: number
  status?: string
}

export type UpdateLifecycleEventParams = Partial<CreateLifecycleEventParams>

export interface OnboardingTaskQueryParams {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number
  keyword?: string
}

export interface CreateOnboardingTaskParams {
  title: string
  description?: string
  employeeId?: number
  dueDate?: string
  assigneeId?: number
  status?: string
}

export type UpdateOnboardingTaskParams = Partial<CreateOnboardingTaskParams>

export interface OffboardingTaskQueryParams {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number
  keyword?: string
}

export interface CreateOffboardingTaskParams {
  title: string
  description?: string
  employeeId?: number
  dueDate?: string
  assigneeId?: number
  status?: string
}

export type UpdateOffboardingTaskParams = Partial<CreateOffboardingTaskParams>

export interface CreateEmployeeDocumentParams {
  title: string
  name: string
  documentType: string
  fileUrl?: string
  employeeId?: number
  status?: string
}

export type UpdateEmployeeDocumentParams = Partial<CreateEmployeeDocumentParams>

export interface ContractQueryParams {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number
  keyword?: string
  contractType?: string
}

export interface CreateEmployeeContractParams {
  contractNo: string
  contractType: string
  startDate: string
  endDate?: string
  employeeId?: number
  fileUrl?: string
  status?: string
}

export type UpdateEmployeeContractParams = Partial<CreateEmployeeContractParams>

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

export function createLifecycleEvent(data: CreateLifecycleEventParams) {
  return post('/lifecycle/events', data)
}

export function updateLifecycleEvent(id: number, data: UpdateLifecycleEventParams) {
  return put(`/lifecycle/events/${id}`, data)
}

export function deleteLifecycleEvent(id: number) {
  return del(`/lifecycle/events/${id}`)
}

export function completeLifecycleEvent(id: number) {
  return post(`/lifecycle/events/${id}/complete`)
}

// ===== Onboarding Tasks =====

export function getOnboardingTasks(params?: OnboardingTaskQueryParams) {
  return get('/lifecycle/onboarding-tasks', { params })
}

export function getOnboardingTaskDetail(id: number) {
  return get(`/lifecycle/onboarding-tasks/${id}`)
}

export function createOnboardingTask(data: CreateOnboardingTaskParams) {
  return post('/lifecycle/onboarding-tasks', data)
}

export function updateOnboardingTask(id: number, data: UpdateOnboardingTaskParams) {
  return put(`/lifecycle/onboarding-tasks/${id}`, data)
}

export function deleteOnboardingTask(id: number) {
  return del(`/lifecycle/onboarding-tasks/${id}`)
}

// ===== Offboarding Tasks =====

export function getOffboardingTasks(params?: OffboardingTaskQueryParams) {
  return get('/lifecycle/offboarding-tasks', { params })
}

export function getOffboardingTaskDetail(id: number) {
  return get(`/lifecycle/offboarding-tasks/${id}`)
}

export function createOffboardingTask(data: CreateOffboardingTaskParams) {
  return post('/lifecycle/offboarding-tasks', data)
}

export function updateOffboardingTask(id: number, data: UpdateOffboardingTaskParams) {
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

export function createEmployeeDocument(data: CreateEmployeeDocumentParams) {
  return post('/lifecycle/documents', data)
}

export function updateEmployeeDocument(id: number, data: UpdateEmployeeDocumentParams) {
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

export function getEmployeeContracts(params?: ContractQueryParams) {
  return get<{ code: 0; data: { list: EmployeeContract[]; total: number; page: number; pageSize: number } }>('/lifecycle/contracts', { params })
}

export function createEmployeeContract(data: CreateEmployeeContractParams) {
  return post('/lifecycle/contracts', data)
}

export function updateEmployeeContract(id: number, data: UpdateEmployeeContractParams) {
  return put(`/lifecycle/contracts/${id}`, data)
}

export function deleteEmployeeContract(id: number) {
  return del(`/lifecycle/contracts/${id}`)
}
