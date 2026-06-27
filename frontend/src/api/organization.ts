import { get } from './request'

export function getDepartmentsList(params?: any) {
  return get('/organization/departments/list', { params })
}

export function getPositions(params?: any) {
  return get('/organization/positions', { params })
}
