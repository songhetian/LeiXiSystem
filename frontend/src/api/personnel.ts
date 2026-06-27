import { get } from './request'

export function getEmployees(params?: any) {
  return get('/personnel/employees', { params })
}
