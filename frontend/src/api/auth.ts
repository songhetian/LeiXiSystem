import { get, post } from './request'
import type { LoginParams, LoginResult, User, ApiResponse } from '@/types'

export function login(params: LoginParams) {
  return post<ApiResponse<LoginResult>>('/auth/login', params)
}

export function logout() {
  return post('/auth/logout')
}

export function getMe() {
  return get<ApiResponse<User>>('/auth/me')
}

export function getPermissions() {
  return get('/auth/permissions')
}
