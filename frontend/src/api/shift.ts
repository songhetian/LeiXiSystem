import { del, get, post, put } from './request'

export interface Shift {
  id: number
  name: string
  code: string
  color: string
  startTime: string
  endTime: string
  workHours: number
  isFlexible: boolean
  isCrossDay: boolean
  beginCheckinMinutes: number
  allowCheckoutMinutes: number
  lateGraceMinutes: number
  earlyGraceMinutes: number
  status: 'active' | 'inactive'
  sortOrder: number
  description?: string
}

export function getShifts(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}) {
  return get<{
    code: 0
    data: { list: Shift[]; total: number; page: number; pageSize: number }
  }>('/shift', { params })
}

export function createShift(data: Omit<Shift, 'id'>) {
  return post<{ code: 0; data: Shift }>('/shift', data)
}

export function updateShift(id: number, data: Partial<Omit<Shift, 'id'>>) {
  return put<{ code: 0; data: Shift }>(`/shift/${id}`, data)
}

export function deleteShift(id: number) {
  return del(`/shift/${id}`)
}
