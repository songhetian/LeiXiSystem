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
  requestData?: any
  responseData?: any
  userAgent?: string
}

export function getAuditLogs(params?: any) {
  return get<{ code: 0; data: { list: AuditLog[]; total: number; page: number; pageSize: number } }>('/security/audit-logs', { params })
}

export function getAuditLogDetail(id: number) {
  return get<{ code: 0; data: AuditLog }>(`/security/audit-logs/${id}`)
}
