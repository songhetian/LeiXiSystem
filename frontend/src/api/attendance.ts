import { get, post, put, del } from './request'

export interface AttendanceRecord {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  date: string
  checkIn?: string | null
  checkOut?: string | null
  workHours?: number | null
  status: string
  lateMinutes?: number | null
  earlyMinutes?: number | null
  locationIn?: string | null
  locationOut?: string | null
}

export interface AttendanceRecordListResponse {
  code: 0
  data: {
    list: AttendanceRecord[]
    total: number
    page: number
    pageSize: number
  }
}

export interface AttendanceStatsResponse {
  code: 0
  data: {
    total: number
    normal: number
    late: number
    early: number
    absent: number
    leave: number
    attendanceRate: string
  }
}

export interface OvertimeRequest {
  id: number
  userId: number
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  currentStep: number
  workflowId?: number | null
  createdAt: string
  updatedAt: string
}

export interface OvertimeListResponse {
  code: 0
  data: {
    list: OvertimeRequest[]
    total: number
    page: number
    pageSize: number
  }
}

export function getAttendanceRecords(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  startDate?: string
  endDate?: string
  status?: string
}) {
  return get<AttendanceRecordListResponse>('/attendance/records', { params })
}

export function getAttendanceStats(params?: { departmentId?: number; month?: string }) {
  return get<AttendanceStatsResponse>('/attendance/stats', { params })
}

export interface AttendanceMonthlyRow {
  id: number
  employeeId: number
  employee: {
    id: number
    employeeNo: string
    user: {
      realName: string
      department?: { name: string }
    }
  }
  expectedWorkDays: number
  actualWorkDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  absentDays: number
  lateCount: number
  earlyCount: number
  missingCheckinCount: number
  overtimeMinutes: number
  status: string
}

export function getAttendanceMonthly(params?: {
  year?: number
  month?: number
  departmentId?: number
}) {
  return get<{ code: 0; data: AttendanceMonthlyRow[] }>('/attendance/monthly', { params })
}

export function calculateAttendance(data: { year?: number; month?: number; date?: string; employeeId?: number }) {
  return post('/attendance/calculate', data)
}

export function lockAttendanceMonthly(data: { year: number; month: number; employeeId?: number }) {
  return post('/attendance/monthly/lock', data)
}

export function getAttendanceExceptions(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  status?: string
  startDate?: string
  endDate?: string
}) {
  return get<{
    code: 0
    data: { list: { id: number; employeeName: string; departmentName: string; date: string; type: string; status: string }[]; total: number }
  }>('/attendance/exceptions', { params })
}

export function resolveAttendanceException(id: number, data: { status: 'resolved' | 'rejected'; reason?: string }) {
  return post(`/attendance/exceptions/${id}/resolve`, data)
}

export function getAttendanceCorrections(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}) {
  return get<{
    code: 0
    data: { list: { id: number; employeeName: string; date: string; logType: string; checkTime: string; status: string }[]; total: number }
  }>('/attendance/corrections', { params })
}

export function createAttendanceCorrection(data: { date: string; logType: 'in' | 'out'; checkTime: string; reason: string }) {
  return post('/attendance/corrections', data)
}

export function approveAttendanceCorrection(id: number, data: { opinion?: string }) {
  return post(`/attendance/corrections/${id}/approve`, data)
}

export function rejectAttendanceCorrection(id: number, data: { opinion?: string }) {
  return post(`/attendance/corrections/${id}/reject`, data)
}

export function getOvertimeList(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  startDate?: string
  endDate?: string
  status?: string
}) {
  return get<OvertimeListResponse>('/attendance/overtime', { params })
}

export function getMyOvertime(params?: {
  page?: number
  pageSize?: number
  status?: string
  startDate?: string
  endDate?: string
}) {
  return get<OvertimeListResponse>('/attendance/overtime/my', { params })
}

export function getOvertimeDetail(id: number) {
  return get(`/attendance/overtime/${id}`)
}

export function createOvertime(data: {
  overtimeType: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
}) {
  return post('/attendance/overtime', data)
}

export function updateOvertime(id: number, data: Partial<{
  overtimeType: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
}>) {
  return put(`/attendance/overtime/${id}`, data)
}

export function cancelOvertime(id: number) {
  return post(`/attendance/overtime/${id}/cancel`)
}

export function approveOvertime(id: number, data?: { opinion?: string }) {
  return post(`/attendance/overtime/${id}/approve`, data)
}

export function rejectOvertime(id: number, data?: { opinion?: string }) {
  return post(`/attendance/overtime/${id}/reject`, data)
}

export function deleteOvertime(id: number) {
  return del(`/attendance/overtime/${id}`)
}

export function batchApproveOvertime(ids: number[], opinion?: string) {
  return post('/attendance/overtime/batch-approve', { ids, opinion })
}

export function batchRejectOvertime(ids: number[], opinion?: string) {
  return post('/attendance/overtime/batch-reject', { ids, opinion })
}

export interface LeaveRequest {
  id: number
  userId: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  currentStep: number
  workflowId?: number | null
  createdAt: string
  updatedAt: string
}

export interface LeaveListResponse {
  code: 0
  data: {
    list: LeaveRequest[]
    total: number
    page: number
    pageSize: number
  }
}

export function getLeaveList(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  startDate?: string
  endDate?: string
  status?: string
}) {
  return get<LeaveListResponse>('/attendance/leave', { params })
}

export function getMyLeave(params?: {
  page?: number
  pageSize?: number
  status?: string
  startDate?: string
  endDate?: string
}) {
  return get<LeaveListResponse>('/attendance/leave/my', { params })
}

export function getLeaveDetail(id: number) {
  return get(`/attendance/leave/${id}`)
}

export function createLeave(data: {
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
}) {
  return post('/attendance/leave', data)
}

export function updateLeave(id: number, data: Partial<{
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
}>) {
  return put(`/attendance/leave/${id}`, data)
}

export function cancelLeave(id: number) {
  return post(`/attendance/leave/${id}/cancel`)
}

export function approveLeave(id: number, data?: { opinion?: string }) {
  return post(`/attendance/leave/${id}/approve`, data)
}

export function rejectLeave(id: number, _data?: { opinion?: string }) {
  return post(`/attendance/leave/${id}/reject`)
}

export function deleteLeave(id: number) {
  return del(`/attendance/leave/${id}`)
}

export function batchApproveLeave(ids: number[], opinion?: string) {
  return post('/attendance/leave/batch-approve', { ids, opinion })
}

export function batchRejectLeave(ids: number[], opinion?: string) {
  return post('/attendance/leave/batch-reject', { ids, opinion })
}

export interface DeductionRule {
  id: number
  name: string
  type: string
  minMinutes: number
  maxMinutes?: number | null
  deductionType: string
  deductionValue: number
  salaryMultiplier?: number | null
  affectAttendance: boolean
  leaveType?: string | null
  description?: string | null
  sortOrder: number
  status: string
  departmentId?: number | null
  createdBy?: number | null
  createdAt: string
  updatedAt: string
}

export interface DeductionRuleListResponse {
  code: 0
  data: {
    list: DeductionRule[]
    total: number
    page: number
    pageSize: number
  }
}

export interface DeductionRuleResponse {
  code: 0
  data: DeductionRule
}

export interface DeductionCalculateResult {
  type: string
  minutes: number
  dailySalary: number
  deductionAmount: number
  ruleName: string
  details: string
}

export function getDeductionRules(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
}) {
  return get<DeductionRuleListResponse>('/attendance/deduction-rules', { params })
}

export function getDeductionRule(id: number) {
  return get<DeductionRuleResponse>(`/attendance/deduction-rules/${id}`)
}

export function createDeductionRule(data: Partial<DeductionRule>) {
  return post<DeductionRuleResponse>('/attendance/deduction-rules', data)
}

export function updateDeductionRule(id: number, data: Partial<DeductionRule>) {
  return put<DeductionRuleResponse>(`/attendance/deduction-rules/${id}`, data)
}

export function deleteDeductionRule(id: number) {
  return del(`/attendance/deduction-rules/${id}`)
}

export function calculateDeduction(data: {
  type: string
  minutes: number
  dailySalary: number
}) {
  return post<{ code: 0; data: DeductionCalculateResult }>('/attendance/deduction-rules/calculate', data)
}

// ===== 考勤月度结算 =====
export interface MonthlyAttendance {
  id: number
  employeeId: number
  year: number
  month: number
  employee?: {
    employeeNo: string
    user: {
      realName: string
      department?: { name: string }
    }
  }
  normalDays: number
  lateDays: number
  earlyDays: number
  absentDays: number
  leaveDays: number
  overtimeHours: number
  workHours: number
  status: string
  lockedAt?: string
  lockedBy?: number
}

export function getMonthlyAttendance(params?: {
  page?: number
  pageSize?: number
  year?: number
  month?: number
  employeeId?: number
  departmentId?: number
  status?: string
}) {
  return get<{ code: 0; data: { list: MonthlyAttendance[]; total: number; page: number; pageSize: number } }>('/attendance/monthly', { params })
}

export function batchCalculateMonthly(params: {
  year: number
  month: number
  employeeIds?: number[]
}) {
  return post('/attendance/monthly/batch-calculate', params)
}

export function batchLockMonthly(params: {
  year: number
  month: number
  employeeIds?: number[]
}) {
  return post('/attendance/monthly/batch-lock', params)
}

export function batchUnlockMonthly(params: {
  year: number
  month: number
  employeeIds?: number[]
}) {
  return post('/attendance/monthly/batch-unlock', params)
}
