import { del, get, post, put } from './request'

export function getShifts(params?: any) {
  return get('/shift/list', { params })
}

export function createShift(data: any) {
  return post('/shift/list', data)
}

export function updateShift(id: number, data: any) {
  return put(`/shift/list/${id}`, data)
}

export function deleteShift(id: number) {
  return del(`/shift/list/${id}`)
}
