import { get, post, put, del } from './request'

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

export function createAssetCategory(data: any) {
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
  assignments?: any[]
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

export function createAssetItem(data: any) {
  return post('/asset/items', data)
}

export function updateAssetItem(id: number, data: any) {
  return put(`/asset/items/${id}`, data)
}

export function assignAsset(id: number, data: any) {
  return post(`/asset/items/${id}/assign`, data)
}

export function returnAsset(id: number, data?: any) {
  return post(`/asset/items/${id}/return`, data)
}

export function transferAsset(id: number, data: any) {
  return post(`/asset/items/${id}/transfer`, data)
}

export function retireAsset(id: number, data?: any) {
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
export function getAssetAssignments(params?: any) {
  return get<{ code: 0; data: { list: AssignmentRecord[]; total: number; page: number; pageSize: number } }>('/asset/assignments', { params })
}
