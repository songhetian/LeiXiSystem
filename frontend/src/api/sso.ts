import { del, get, post, put } from './request'

export function getSsoApps(params?: any) {
  return get('/sso/apps', { params })
}

export function createSsoApp(data: any) {
  return post('/sso/apps', data)
}

export function updateSsoApp(id: number, data: any) {
  return put(`/sso/apps/${id}`, data)
}

export function deleteSsoApp(id: number) {
  return del(`/sso/apps/${id}`)
}
