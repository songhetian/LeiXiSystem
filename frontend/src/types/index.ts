export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  code?: number
}

export interface User {
  id: number
  username: string
  realName?: string
  real_name: string
  avatar?: string
  role?: string
  roles?: string[]
  permissions?: string[]
  department_id?: number
  departmentId?: number
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
