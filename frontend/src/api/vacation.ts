import { get, post, put, del } from './request'

export interface VacationType {
  id: number
  name: string
  code: string
  totalDays: number
  unit: 'day' | 'hour'
  isCarryOver: boolean
  carryOverDays: number
  isPaid: boolean
  sortOrder: number
  status: 'active' | 'inactive'
  description?: string | null
}

export interface VacationTypeListResponse {
  code: 0
  data: VacationType[]
}

export interface VacationBalance {
  id: number
  vacationTypeId: number
  typeName: string
  typeCode: string
  year: number
  total: number
  used: number
  balance: number
  unit: 'day' | 'hour'
}

export interface VacationBalanceResponse {
  code: 0
  data: VacationBalance[]
}

export function getVacationTypes() {
  return get<VacationTypeListResponse>('/vacation/types')
}

export function createVacationType(data: Partial<VacationType>) {
  return post('/vacation/types', data)
}

export function updateVacationType(id: number, data: Partial<VacationType>) {
  return put(`/vacation/types/${id}`, data)
}

export function deleteVacationType(id: number) {
  return del(`/vacation/types/${id}`)
}

export function batchDeleteVacationTypes(ids: number[]) {
  return post('/vacation/types/batch-delete', { ids })
}

export function batchUpdateVacationTypeStatus(ids: number[], status: string) {
  return post('/vacation/types/batch-status', { ids, status })
}

export function getVacationBalance(params?: { employeeId?: number; year?: number }) {
  return get<VacationBalanceResponse>('/vacation/balance', { params })
}

export function adjustVacationBalance(data: {
  employeeId: number
  vacationTypeId: number
  year: number
  adjustment: number
  reason: string
}) {
  return post('/vacation/balance/adjust', data)
}
