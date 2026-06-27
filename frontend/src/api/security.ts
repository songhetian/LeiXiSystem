import { get } from './request'

export function getAuditLogs(params?: any) {
  return get('/security/audit-logs', { params })
}

export function getAuditLogDetail(id: number) {
  return get(`/security/audit-logs/${id}`)
}
