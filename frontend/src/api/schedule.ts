import { get, post, put, del } from './request'

// ============ 排班基础 ============
export interface Schedule {
  id: number
  userId: number
  userName: string
  departmentId?: number
  departmentName?: string
  shiftId: number
  shiftName: string
  shiftColor?: string
  scheduleDate: string
  status: string
  note?: string
  source?: string
  ruleId?: number
  confidence?: number
  conflictWarnings?: string
}

export interface ScheduleCalendarResponse {
  code: 0
  data: Schedule[]
}

export function getScheduleCalendar(params?: {
  startDate?: string
  endDate?: string
  departmentId?: number
  userId?: number
}) {
  return get<ScheduleCalendarResponse>('/schedule/calendar', { params })
}

export function assignSchedule(data: {
  userIds: number[]
  shiftId: number
  startDate: string
  endDate: string
}) {
  return post('/schedule/assign', data)
}

export function updateSchedule(id: number, data: {
  shiftId?: number
  status?: string
  note?: string
}) {
  return put(`/schedule/${id}`, data)
}

export function deleteSchedule(id: number) {
  return del(`/schedule/${id}`)
}

// ============ 排班规则 ============
export interface ScheduleRule {
  id: number
  name: string
  code: string
  departmentId?: number
  department?: { id: number; name: string }
  shiftIds: string
  pattern?: string
  maxWorkHoursPerWeek?: number
  maxConsecutiveDays?: number
  minRestHoursBetween?: number
  maxNightShiftsPerWeek?: number
  priority: number
  fairnessWeight: number
  preferenceEnabled: boolean
  status: string
  sortOrder: number
}

export function getScheduleRules(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  status?: string
}) {
  return get<{
    code: 0
    data: { list: ScheduleRule[]; total: number; page: number; pageSize: number }
  }>('/schedule/rules', { params })
}

export function getScheduleRule(id: number) {
  return get<{ code: 0; data: ScheduleRule }>(`/schedule/rules/${id}`)
}

export function createScheduleRule(data: Partial<ScheduleRule>) {
  return post('/schedule/rules', data)
}

export function updateScheduleRule(id: number, data: Partial<ScheduleRule>) {
  return put(`/schedule/rules/${id}`, data)
}

export function deleteScheduleRule(id: number) {
  return del(`/schedule/rules/${id}`)
}

export function getRuleShifts(id: number) {
  return get<{ code: 0; data: { id: number; name: string; color?: string }[] }>(`/schedule/rules/${id}/shifts`)
}

// ============ 排班偏好 ============
export interface SchedulePreference {
  id: number
  employeeId: number
  preferredShiftId?: number
  preferredShift?: { id: number; name: string; color?: string }
  preferredDays?: string
  avoidDays?: string
  avoidDates?: string
  notes?: string
}

export function getMySchedulePreference() {
  return get<{ code: 0; data: SchedulePreference | null }>('/schedule/preferences/me')
}

export function updateMySchedulePreference(data: Partial<SchedulePreference>) {
  return put('/schedule/preferences/me', data)
}

export function getEmployeeSchedulePreference(employeeId: number) {
  return get<{ code: 0; data: SchedulePreference | null }>(`/schedule/preferences/${employeeId}`)
}

export function batchUpdatePreferences(data: {
  employeeIds: number[]
  preferredShiftId?: number
  preferredDays?: string
  avoidDays?: string
  avoidDates?: string
}) {
  return post('/schedule/preferences/batch', data)
}

// ============ 换班申请 ============
export interface ShiftSwapRequest {
  id: number
  requestNo: string
  requesterId: number
  requester?: { id: number; realName: string; department?: { name: string } }
  targetId: number
  target?: { id: number; realName: string; department?: { name: string } }
  requesterScheduleId: number
  requesterSchedule?: {
    shift: { name: string; color?: string }
  }
  targetScheduleId: number
  targetSchedule?: {
    shift: { name: string; color?: string }
  }
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approveRemark?: string
  approvedBy?: number
  approver?: { realName: string }
  approvedAt?: string
  createdAt: string
}

export function getShiftSwaps(params?: {
  page?: number
  pageSize?: number
  status?: string
  type?: string
}) {
  return get<{
    code: 0
    data: { list: ShiftSwapRequest[]; total: number; page: number; pageSize: number }
  }>('/schedule/swaps', { params })
}

export function getShiftSwap(id: number) {
  return get<{ code: 0; data: ShiftSwapRequest }>(`/schedule/swaps/${id}`)
}

export function createShiftSwap(data: {
  targetId: number
  requesterScheduleId: number
  targetScheduleId: number
  reason?: string
}) {
  return post('/schedule/swaps', data)
}

export function approveShiftSwap(id: number, approveRemark?: string) {
  return put(`/schedule/swaps/${id}/approve`, { approveRemark })
}

export function rejectShiftSwap(id: number, approveRemark?: string) {
  return put(`/schedule/swaps/${id}/reject`, { approveRemark })
}

export function cancelShiftSwap(id: number) {
  return put(`/schedule/swaps/${id}/cancel`, {})
}

// ============ 排班发布与确认 ============
export interface ScheduleConfirmationItem {
  id: number
  userId: number
  scheduleId: number
  periodStart: string
  periodEnd: string
  status: 'pending' | 'confirmed' | 'appealed' | 'auto_confirmed'
  confirmAt?: string
  note?: string
  user: {
    id: number
    realName: string
    departmentId?: number
    department?: { name: string }
  }
  schedule: {
    id: number
    scheduleDate: string
    shift: {
      id: number
      name: string
      color?: string
      startTime?: string
      endTime?: string
    }
  }
}

export interface ScheduleAppealItem {
  id: number
  userId: number
  scheduleId: number
  reason: string
  expectedDate?: string
  expectedShiftId?: number
  expectedShiftName?: string
  status: 'pending' | 'approved' | 'rejected'
  handlerId?: number
  handlerNote?: string
  handledAt?: string
  user: {
    id: number
    realName: string
    department?: { name: string }
  }
  schedule: {
    id: number
    scheduleDate: string
    shift: { name: string; color?: string }
  }
  handler?: { realName: string }
  createdAt: string
}

export function publishSchedules(params: {
  departmentId?: number
  startDate: string
  endDate: string
}) {
  return post<{ code: 0; data: { count: number } }>('/schedule/publish', params)
}

export function getConfirmations(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  startDate?: string
  endDate?: string
}) {
  return get<{
    code: 0
    data: {
      list: ScheduleConfirmationItem[]
      total: number
      page: number
      pageSize: number
      stats: Record<string, number>
    }
  }>('/schedule/confirmations', { params })
}

export function getAppeals(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  startDate?: string
}) {
  return get<{
    code: 0
    data: { list: ScheduleAppealItem[]; total: number; page: number; pageSize: number }
  }>('/schedule/appeals', { params })
}

export function handleAppeal(id: number, data: { status: 'approved' | 'rejected'; handlerNote?: string }) {
  return put(`/schedule/appeals/${id}`, data)
}

export function confirmBatch(scheduleIds: number[], note?: string) {
  return post('/schedule/confirm-batch', { scheduleIds, note })
}

// ============ 员工端我的排班 ============
export function getMyPendingSchedules() {
  return get<{
    code: 0
    data: Array<{
      periodStart: string
      periodEnd: string
      items: Array<ScheduleConfirmationItem & { schedule: { shift: { name: string; color?: string; startTime?: string; endTime?: string } } }>
    }>
  }>('/schedule/my/pending')
}

export function getMyConfirmedSchedules(params?: {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}) {
  return get<{
    code: 0
    data: { list: ScheduleConfirmationItem[]; total: number; page: number; pageSize: number }
  }>('/schedule/my/confirmed', { params })
}

export function confirmSchedules(scheduleIds: number[], note?: string) {
  return post<{ code: 0; data: { count: number } }>('/schedule/my/confirm', { scheduleIds, note })
}

export function confirmWeekSchedules() {
  return post<{ code: 0; message: string; data: { count: number } }>('/schedule/my/confirm-week', {})
}

export function getMyAppeals() {
  return get<{ code: 0; data: ScheduleAppealItem[] }>('/schedule/my/appeals')
}

export function createAppeal(data: {
  scheduleId: number
  reason: string
  expectedDate?: string
  expectedShiftId?: number
}) {
  return post('/schedule/my/appeal', data)
}

export function cancelAppeal(id: number) {
  return del(`/schedule/my/appeal/${id}`)
}

// ============ 借调管理 ============
export interface EmployeeSecondment {
  id: number
  employeeId: number
  employee?: {
    id: number
    employeeNo: string
    user: { realName: string }
  }
  fromDepartmentId: number
  fromDepartment?: { id: number; name: string }
  toDepartmentId: number
  toDepartment?: { id: number; name: string }
  startDate: string
  endDate: string
  reason?: string
  status: string
  createdBy: number
  creator?: { realName: string }
  createdAt: string
}

export function getSecondments(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  employeeId?: number
  departmentId?: number
  status?: string
}) {
  return get<{
    code: 0
    data: { list: EmployeeSecondment[]; total: number; page: number; pageSize: number }
  }>('/schedule/secondments', { params })
}

export function getSecondment(id: number) {
  return get<{ code: 0; data: EmployeeSecondment }>(`/schedule/secondments/${id}`)
}

export function createSecondment(data: {
  employeeId: number
  fromDepartmentId: number
  toDepartmentId: number
  startDate: string
  endDate: string
  reason?: string
}) {
  return post('/schedule/secondments', data)
}

export function updateSecondment(id: number, data: Partial<{
  toDepartmentId: number
  startDate: string
  endDate: string
  reason: string
  status: string
}>) {
  return put(`/schedule/secondments/${id}`, data)
}

export function deleteSecondment(id: number) {
  return del(`/schedule/secondments/${id}`)
}

export function getActiveSecondments() {
  return get<{ code: 0; data: EmployeeSecondment[] }>('/schedule/secondments/active')
}

// ============ 智能推荐 ============
export interface ScheduleRecommendation {
  employeeId: number
  employeeNo: string
  realName: string
  scheduleDate: string
  shiftId: number
  shiftName: string
  shiftColor?: string
  confidence: number
  conflicts: string[]
}

export interface ConflictWarning {
  date: string
  employeeId: number
  employeeName: string
  type: 'hard' | 'soft'
  message: string
}

export interface ScheduleStatistics {
  total: number
  byShift: Record<string, number>
  byEmployee: Record<string, number>
}

export interface RecommendResult {
  recommendations: ScheduleRecommendation[]
  warnings: ConflictWarning[]
  statistics: ScheduleStatistics
}

export function generateRecommendations(params: {
  departmentId?: number
  startDate: string
  endDate: string
  ruleId?: number
  excludeEmployeeIds?: number[]
}) {
  return post<{ code: 0; data: RecommendResult }>('/schedule/recommend', params)
}

export function applyRecommendations(recommendations: Array<{
  employeeId: number
  scheduleDate: string
  shiftId: number
  confidence?: number
  conflicts?: string[]
}>) {
  return post('/schedule/recommend/apply', { recommendations })
}

export function batchApplyRecommendations(params: {
  departmentId?: number
  startDate: string
  endDate: string
  ruleId?: number
}) {
  return post<{ code: 0; data: { successCount: number; failedCount: number } }>('/schedule/recommend/batch-apply', params)
}

export function checkConflicts(params: {
  departmentId?: number
  startDate: string
  endDate: string
}) {
  return post<{ code: 0; data: {
    hardConflicts: ConflictWarning[]
    softConflicts: ConflictWarning[]
    totalHardConflicts: number
    totalSoftConflicts: number
  } }>('/schedule/check-conflicts', params)
}

// ============ 排班模板 ============
export interface ScheduleTemplateItem {
  id: number
  templateId: number
  dayIndex: number
  shiftIds: string
  weekday?: number
}

export interface ScheduleTemplate {
  id: number
  name: string
  code: string
  departmentId?: number
  department?: { id: number; name: string }
  cycleDays: number
  repeatType: 'weekday' | 'day'
  description?: string
  status: string
  sortOrder: number
  items: ScheduleTemplateItem[]
  creator?: { id: number; realName: string }
  createdAt: string
  updatedAt: string
}

export function getScheduleTemplates(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  status?: string
}) {
  return get<{
    code: 0
    data: {
      list: ScheduleTemplate[]
      total: number
      page: number
      pageSize: number
    }
  }>('/schedule/templates', { params })
}

export function getScheduleTemplate(id: number) {
  return get<{ code: 0; data: ScheduleTemplate }>(`/schedule/templates/${id}`)
}

export function createScheduleTemplate(data: {
  name: string
  code: string
  departmentId?: number | null
  cycleDays?: number
  repeatType?: string
  description?: string
  status?: string
  sortOrder?: number
  items: Array<{
    dayIndex: number
    shiftIds: string
    weekday?: number | null
  }>
}) {
  return post<{ code: 0; data: ScheduleTemplate }>('/schedule/templates', data)
}

export function updateScheduleTemplate(id: number, data: Partial<{
  name: string
  code: string
  departmentId?: number | null
  cycleDays?: number
  repeatType?: string
  description?: string
  status?: string
  sortOrder?: number
  items: Array<{
    dayIndex: number
    shiftIds: string
    weekday?: number | null
  }>
}>) {
  return put<{ code: 0; data: ScheduleTemplate }>(`/schedule/templates/${id}`, data)
}

export function deleteScheduleTemplate(id: number) {
  return del(`/schedule/templates/${id}`)
}

export interface TemplatePreviewItem {
  employeeId: number
  employeeNo: string
  employeeName: string
  date: string
  shiftId: number
  shiftName: string
  shiftColor?: string
  shiftStartTime?: string
  shiftEndTime?: string
  hasExisting: boolean
  willOverwrite: boolean
  willSkip: boolean
}

export function previewApplyTemplate(params: {
  templateId: number
  departmentId?: number
  employeeIds?: string
  startDate: string
  endDate: string
  overwrite?: boolean
}) {
  return post<{
    code: 0
    data: {
      preview: TemplatePreviewItem[]
      total: number
      willCreate: number
      willOverwrite: number
      willSkip: number
    }
  }>('/schedule/templates/preview', params)
}

export function applyTemplate(params: {
  templateId: number
  departmentId?: number
  employeeIds?: string
  startDate: string
  endDate: string
  overwrite?: boolean
}) {
  return post<{
    code: 0
    message: string
    data: {
      createdCount: number
      updatedCount: number
      skippedCount: number
    }
  }>('/schedule/templates/apply', params)
}
