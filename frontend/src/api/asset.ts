import { get, post, put, del } from './request'

export function getAssetCategories() {
  return get('/asset/categories')
}

export function createAssetCategory(data: any) {
  return post('/asset/categories', data)
}

export function deleteAssetCategory(id: number) {
  return del(`/asset/categories/${id}`)
}

export function getAssetItems(params?: any) {
  return get('/asset/items', { params })
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

export function getAssetAssignments(params?: any) {
  return get('/asset/assignments', { params })
}
