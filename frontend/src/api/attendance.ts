import { get, post } from './request'

export function getAttendanceMonthly(params?: any) {
  return get('/attendance/monthly', { params })
}

export function calculateAttendance(data: { year?: number; month?: number; date?: string; employeeId?: number }) {
  return post('/attendance/calculate', data)
}

export function lockAttendanceMonthly(data: { year: number; month: number; employeeId?: number }) {
  return post('/attendance/monthly/lock', data)
}

export function getAttendanceExceptions(params?: any) {
  return get('/attendance/exceptions', { params })
}

export function resolveAttendanceException(id: number, data: { status: 'resolved' | 'rejected'; reason?: string }) {
  return post(`/attendance/exceptions/${id}/resolve`, data)
}

export function getAttendanceCorrections(params?: any) {
  return get('/attendance/corrections', { params })
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
