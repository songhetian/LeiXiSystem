import { get, post, put, del } from './request'

// Overtime & Payroll
export interface SalaryProfile {
  id: number
  employeeId: number
  baseSalary: number
  effectiveFrom: string
  effectiveTo?: string
  status: string
}

export interface SettlementBatch {
  id: number
  batchNo: string
  periodStart: string
  periodEnd: string
  totalOvertimePay: number
  affectedEmployees: number
  status: string
}

export function getSalaryProfiles(params?: any) {
  return get<{ code: number; data: { list: SalaryProfile[] } }>('/overtime-payroll/salary-profiles', { params })
}

export function createSalaryProfile(data: any) {
  return post<{ code: number; data: SalaryProfile }>('/overtime-payroll/salary-profiles', data)
}

export function calculateOvertime(overtimeId: number, hourSource: string) {
  return post<{ code: number; data: any }>('/overtime-payroll/calculate', { overtimeId, hourSource })
}

export function settleOvertime(id: number) {
  return post<{ code: number }>(`/overtime-payroll/settle/${id}`)
}

export function getPendingSettlements(params?: any) {
  return get<{ code: number; data: any }>('/overtime-payroll/pending-settlements', { params })
}

export function getSettlementBatches(params?: any) {
  return get<{ code: number; data: { list: SettlementBatch[] } }>('/overtime-payroll/settlement-batches', { params })
}

export function createSettlementBatch(data: any) {
  return post<{ code: number; data: SettlementBatch }>('/overtime-payroll/settlement-batches', data)
}

export function processSettlementBatch(id: number) {
  return post<{ code: number }>(`/overtime-payroll/settlement-batches/${id}/process`)
}

// OKR
export function getOkrDashboard(params?: any) {
  return get<{ code: number; data: any[] }>('/okr/dashboard', { params })
}

export function createObjective(data: any) {
  return post('/okr/objectives', data)
}

export function addKeyResult(objectiveId: number, data: any) {
  return post(`/okr/objectives/${objectiveId}/key-results`, data)
}

export function updateKrProgress(krId: number, currentValue: number) {
  return put(`/okr/key-results/${krId}/progress`, { currentValue })
}

export function syncOkrToPerformance(manual?: boolean) {
  return post('/okr/sync-to-performance', { manual })
}

// Operations Dashboard
export function getOperationsDashboard() {
  return get<{ code: number; data: any }>('/dashboard/operations')
}

export function getAlertThresholds() {
  return get<{ code: number; data: any[] }>('/dashboard/operations/alert-thresholds')
}

export function updateAlertThreshold(id: number, data: any) {
  return put(`/dashboard/operations/alert-thresholds/${id}`, data)
}

// Schedule Advanced
export function getRotationPatterns() {
  return get<{ code: number; data: any[] }>('/schedule/rotations')
}

export function createRotationPattern(data: any) {
  return post('/schedule/rotations', data)
}

export function generateRotationSchedule(patternId: number) {
  return post(`/schedule/rotations/${patternId}/generate`)
}

export function getScheduleVersions(params?: any) {
  return get<{ code: number; data: any[] }>('/schedule/versions', { params })
}

export function createScheduleSnapshot(data: any) {
  return post('/schedule/snapshot', data)
}

export function compareScheduleVersions(versionA: number, versionB: number) {
  return get('/schedule/compare', { params: { versionA, versionB } })
}

export function createDeviationReport(versionId: number) {
  return post('/schedule/deviation-report', { versionId })
}

// Leave Policies
export function getLeavePolicies() {
  return get<{ code: number; data: { list: any[] } }>('/vacation/policies')
}

export function createLeavePolicy(data: any) {
  return post('/vacation/policies', data)
}

export function allocateLeaveByPolicy() {
  return post('/vacation/allocate-by-policy')
}

// Asset Components
export function getAssetComponents(assetId: number) {
  return get<{ code: number; data: any[] }>(`/asset/items/${assetId}/components`)
}

export function addAssetComponent(assetId: number, data: any) {
  return post(`/asset/items/${assetId}/components`, data)
}

export function removeAssetComponent(compId: number) {
  return del(`/asset/items/components/${compId}`)
}

export function getAssetOperations(assetId: number) {
  return get<{ code: number; data: any[] }>(`/asset/items/${assetId}/operations`)
}

// Employee Portal
export function getEmployeeDashboard() {
  return get<{ code: number; data: any }>('/employee/dashboard')
}

export function verifySecondaryPassword(password: string) {
  return post<{ code: number }>('/employee/verify-password', { password })
}

export function setSecondaryPassword(password: string) {
  return post<{ code: number }>('/employee/set-password', { password })
}

export function getEmployeeSalary() {
  return get<{ code: number; data: any }>('/employee/my-salary')
}

export function getEmployeePayslips() {
  return get<{ code: number; data: any[] }>('/employee/payslips')
}

export function getEmployeeLifecycles() {
  return get<{ code: number; data: any[] }>('/employee/lifecycle')
}

export function getLifecycleTemplates() {
  return get<{ code: number; data: any[] }>('/employee/lifecycle/task-templates')
}

export function startLifecycle(data: any) {
  return post('/employee/lifecycle/start', data)
}

export function completeLifecycleTask(taskId: number, note?: string) {
  return put(`/employee/lifecycle/tasks/${taskId}/complete`, { note })
}
