export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  code?: number
}

export interface ApiListResponse<T = any> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiResult<T = any> {
  code: number
  message: string
  data: T
}

export interface User {
  id: number
  username: string
  realName: string
  avatar?: string
  role?: string
  roles?: string[]
  permissions?: string[]
  departmentId?: number
  employeeNo?: string
  departmentName?: string
  positionName?: string
  phone?: string
  email?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  description?: string
}

export interface UpdateProfileParams {
  phone?: string
  email?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  description?: string
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
  [key: string]: any
}

export interface PaginationResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface IdParam {
  id: number | string
}

export interface IdsParam {
  ids: (number | string)[]
}

export interface StatusParam {
  status: 'active' | 'inactive' | string
}
