import { get, post, put, del } from './request'

export interface AttendanceExceptionRule {
  id: number
  name: string
  type: string
  description?: string
  departmentId?: number
  threshold: number
  thresholdMax?: number
  autoResolve: boolean
  autoResolveType?: string
  deductMinutes: number
  status: string
  sortOrder: number
  department?: { id: number; name: string }
  creator?: { id: number; realName: string }
  createdAt: string
  updatedAt: string
}

export const EXCEPTION_TYPES = [
  { value: 'late', label: '迟到' },
  { value: 'early', label: '早退' },
  { value: 'absent', label: '旷工' },
  { value: 'missing_checkin', label: '缺打卡（上班）' },
  { value: 'missing_checkout', label: '缺打卡（下班）' },
  { value: 'overtime_less', label: '工时不足' },
  { value: 'work_duration_less', label: '工作时长不足' },
]

export const AUTO_RESOLVE_TYPES = [
  { value: 'ignore', label: '忽略（自动通过）' },
  { value: 'deduct', label: '扣除工时' },
  { value: 'warn', label: '警告记录' },
]

// 获取异常规则列表
export function getExceptionRules(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  departmentId?: number
  keyword?: string
}) {
  return get<{
    code: 0
    data: {
      list: AttendanceExceptionRule[]
      total: number
      page: number
      pageSize: number
    }
  }>('/attendance/exception-rules', { params })
}

// 获取异常规则详情
export function getExceptionRule(id: number) {
  return get<{
    code: 0
    data: AttendanceExceptionRule
  }>(`/attendance/exception-rules/${id}`)
}

// 创建异常规则
export function createExceptionRule(data: {
  name: string
  type: string
  description?: string
  departmentId?: number
  threshold?: number
  thresholdMax?: number
  autoResolve?: boolean
  autoResolveType?: string
  deductMinutes?: number
  status?: string
  sortOrder?: number
}) {
  return post<{
    code: 0
    data: AttendanceExceptionRule
  }>('/attendance/exception-rules', data)
}

// 更新异常规则
export function updateExceptionRule(id: number, data: {
  name?: string
  type?: string
  description?: string
  departmentId?: number
  threshold?: number
  thresholdMax?: number
  autoResolve?: boolean
  autoResolveType?: string
  deductMinutes?: number
  status?: string
  sortOrder?: number
}) {
  return put<{
    code: 0
    data: AttendanceExceptionRule
  }>(`/attendance/exception-rules/${id}`, data)
}

// 删除异常规则
export function deleteExceptionRule(id: number) {
  return del(`/attendance/exception-rules/${id}`)
}

// 批量处理异常
export function batchResolveExceptions(data: {
  ids: number[]
  status: 'resolved' | 'rejected'
  reason?: string
}) {
  return post('/attendance/exceptions/batch-resolve', data)
}
