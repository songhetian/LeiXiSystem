import { get, post, put } from './request'
import type { LoginParams, LoginResult, User, ApiResponse, UpdateProfileParams } from '@/types'

export function login(params: LoginParams) {
  return post<ApiResponse<LoginResult>>('/auth/login', params)
}

export function logout() {
  return post('/auth/logout')
}

export function getMe() {
  return get<ApiResponse<User>>('/auth/me', { silent: true, cancelDuplicate: false })
}

export function getPermissions() {
  return get('/auth/permissions')
}

export function updateProfile(data: UpdateProfileParams) {
  return put<ApiResponse<User>>('/auth/profile', data)
}
