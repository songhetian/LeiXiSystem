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

export interface VacationTypePageResponse {
  code: 0
  data: {
    list: VacationType[]
    total: number
    page: number
    pageSize: number
  }
}

export interface VacationTypePageParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
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

export function getVacationTypesPage(params: VacationTypePageParams) {
  return get<VacationTypePageResponse>('/vacation/types/page', { params })
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

// ============== 假期类型导入导出 ==============

export function downloadVacationTypeTemplate() {
  return get<Blob>('/vacation/import/template', {
    responseType: 'blob',
  } as any)
}

export function importVacationTypes(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return post<{
    code: number
    message: string
    data: { total: number; imported: number; failed: number; errors: Array<{ row: number; message: string }> }
  }>('/vacation/import/types', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  } as any)
}

export function exportVacationTypes() {
  return get<Blob>('/vacation/export/types', {
    responseType: 'blob',
  } as any)
}

export interface CarryoverRecord {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  vacationTypeId: number
  vacationTypeName: string
  fromYear: number
  toYear: number
  originalDays: number
  carryoverDays: number
  expiredDays?: number
  status: 'active' | 'expired' | 'used'
  expireDate: string
  createdAt: string
  operator?: string
  remark?: string
}

export interface CarryoverRecordListResponse {
  code: 0
  data: {
    list: CarryoverRecord[]
    total: number
    page: number
    pageSize: number
  }
}

export interface CarryoverRunResult {
  code: 0
  data: {
    success: boolean
    totalEmployees: number
    processedEmployees: number
    totalCarryoverDays: number
    errors?: Array<{
      employeeId: number
      employeeName: string
      message: string
    }>
  }
}

export interface CarryoverExpireResult {
  code: 0
  data: {
    success: boolean
    totalRecords: number
    expiredRecords: number
    expiredDays: number
  }
}

export function runVacationCarryover(data: {
  fromYear: number
  toYear: number
  vacationTypeId?: number
  departmentId?: number
  employeeIds?: number[]
}) {
  return post<CarryoverRunResult>('/vacation/carryover/run', data)
}

export function getCarryoverRecords(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  vacationTypeId?: number
  year?: number
  status?: string
}) {
  return get<CarryoverRecordListResponse>('/vacation/carryover/records', { params })
}

export function expireCarryoverRecords(data: {
  year?: number
  vacationTypeId?: number
  employeeIds?: number[]
}) {
  return post<CarryoverExpireResult>('/vacation/carryover/expire', data)
}
