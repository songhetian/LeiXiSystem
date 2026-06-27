import { get, post } from './request'
import type { LoginParams, LoginResult } from '@/types'

export function login(params: LoginParams) {
  return post<LoginResult>('/auth/login', params)
}

export function logout() {
  return post('/auth/logout')
}

export function getMe() {
  return get('/auth/me')
}

export function getPermissions() {
  return get('/auth/permissions')
}
