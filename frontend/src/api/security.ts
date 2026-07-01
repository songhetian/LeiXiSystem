import { get } from './request'

export interface AuditLog {
  id: number
  createdAt: string
  username: string
  module: string
  action: string
  ipAddress?: string
  status: string
  requestSummary?: string
  requestData?: unknown
  responseData?: unknown
  userAgent?: string
}

export function getAuditLogs(params?: {
  page?: number
  pageSize?: number
  username?: string
  module?: string
  action?: string
  status?: string
  startDate?: string
  endDate?: string
}) {
  return get<{ code: 0; data: { list: AuditLog[]; total: number; page: number; pageSize: number } }>('/security/audit-logs', { params })
}

export function getAuditLogDetail(id: number) {
  return get<{ code: 0; data: AuditLog }>(`/security/audit-logs/${id}`)
}
