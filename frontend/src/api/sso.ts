import { del, get, post, put } from './request'

export interface SsoApp {
  id: number
  name: string
  code: string
  appUrl: string
  logoUrl?: string
  description: string
  status: 'active' | 'inactive'
  createdAt?: string
}

export function getSsoApps(params?: any) {
  return get<{ code: 0; data: { list: SsoApp[]; total: number; page: number; pageSize: number } }>('/sso/apps', { params })
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
