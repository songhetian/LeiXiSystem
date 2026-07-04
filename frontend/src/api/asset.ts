import { get, post, put, del } from './request'

// ===== Local request type interfaces =====

export interface CreateAssetCategoryParams {
  name: string
  code: string
  description?: string
  status?: string
  sortOrder?: number
}

export interface CreateAssetItemParams {
  name: string
  assetNo?: string
  categoryId: number
  brand?: string
  model?: string
  serialNo?: string
  location?: string
  purchaseDate?: string
  purchaseAmount?: number
  remark?: string
}

export type UpdateAssetItemParams = Partial<CreateAssetItemParams> & {
  status?: string
}

export interface AssignAssetParams {
  employeeId: number
  note?: string
}

export interface ReturnAssetParams {
  note?: string
}

export interface TransferAssetParams {
  employeeId: number
  note?: string
}

export interface RetireAssetParams {
  reason?: string
}

export interface AssetAssignmentQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  employeeId?: number
  assetId?: number
  action?: string
}

// Categories
export interface AssetCategory {
  id: number
  name: string
  code: string
  description?: string
  status: string
  sortOrder: number
}

export function getAssetCategories() {
  return get<{ code: 0; data: AssetCategory[] }>('/asset/categories')
}

export function createAssetCategory(data: CreateAssetCategoryParams) {
  return post('/asset/categories', data)
}

export function deleteAssetCategory(id: number) {
  return del(`/asset/categories/${id}`)
}

// Items
export interface AssetItem {
  id: number
  assetNo: string
  name: string
  brand?: string
  model?: string
  serialNo?: string
  status: string
  location?: string
  purchaseDate?: string
  purchaseAmount?: number
  remark?: string
  category?: { id: number; name: string; code: string }
  currentEmployee?: { id?: number; employeeNo: string; user?: { realName: string } }
  assignments?: AssignmentRecord[]
}

export interface AssignmentRecord {
  id: number
  action: string
  assignedAt: string
  returnedAt?: string
  note?: string
  asset?: { assetNo: string; name: string }
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  operator?: { realName: string }
}

export function getAssetItems(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: number
  status?: string
}) {
  return get<{ code: 0; data: { list: AssetItem[]; total: number; page: number; pageSize: number } }>('/asset/items', { params })
}

export function getAssetItemDetail(id: number) {
  return get<{ code: 0; data: AssetItem }>(`/asset/items/${id}`)
}

export function createAssetItem(data: CreateAssetItemParams) {
  return post('/asset/items', data)
}

export function updateAssetItem(id: number, data: UpdateAssetItemParams) {
  return put(`/asset/items/${id}`, data)
}

export function assignAsset(id: number, data: AssignAssetParams) {
  return post(`/asset/items/${id}/assign`, data)
}

export function returnAsset(id: number, data?: ReturnAssetParams) {
  return post(`/asset/items/${id}/return`, data)
}

export function transferAsset(id: number, data: TransferAssetParams) {
  return post(`/asset/items/${id}/transfer`, data)
}

export function retireAsset(id: number, data?: RetireAssetParams) {
  return post(`/asset/items/${id}/retire`, data)
}

export function deleteAssetItem(id: number) {
  return del(`/asset/items/${id}`)
}

export function batchDeleteAssetItems(ids: number[]) {
  return post('/asset/items/batch-delete', { ids })
}

export function batchUpdateAssetStatus(ids: number[], status: string) {
  return post('/asset/items/batch-status', { ids, status })
}

// Assignments
export function getAssetAssignments(params?: AssetAssignmentQueryParams) {
  return get<{ code: 0; data: { list: AssignmentRecord[]; total: number; page: number; pageSize: number } }>('/asset/assignments', { params })
}
