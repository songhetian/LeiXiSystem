import { get, post, put, del } from './request'

export interface AttendanceLocation {
  id: number
  name: string
  type: string
  latitude?: number
  longitude?: number
  radiusMeters: number
  wifiSsid?: string
  wifiBssid?: string
  address?: string
  departmentId?: number
  status: string
  sortOrder: number
  department?: { id: number; name: string }
  createdAt: string
  updatedAt: string
}

export const LOCATION_TYPE_OPTIONS = [
  { value: 'gps', label: 'GPS定位' },
  { value: 'wifi', label: 'WiFi打卡' },
  { value: 'both', label: 'GPS + WiFi' },
]

// 获取打卡位置列表
export function getAttendanceLocations(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  departmentId?: number
}) {
  return get<{
    code: 0
    data: {
      list: AttendanceLocation[]
      total: number
      page: number
      pageSize: number
    }
  }>('/attendance/locations', { params })
}

// 获取打卡位置详情
export function getAttendanceLocation(id: number) {
  return get<{ code: 0; data: AttendanceLocation }>(`/attendance/locations/${id}`)
}

// 创建打卡位置
export function createAttendanceLocation(data: any) {
  return post<{ code: 0; data: AttendanceLocation }>('/attendance/locations', data)
}

// 更新打卡位置
export function updateAttendanceLocation(id: number, data: any) {
  return put<{ code: 0; data: AttendanceLocation }>(`/attendance/locations/${id}`, data)
}

// 删除打卡位置
export function deleteAttendanceLocation(id: number) {
  return del(`/attendance/locations/${id}`)
}

// 校验打卡位置
export function verifyAttendanceLocation(data: {
  latitude?: number
  longitude?: number
  wifiSsid?: string
  wifiBssid?: string
}) {
  return post<{
    code: 0
    data: {
      valid: boolean
      location?: AttendanceLocation
      matchedBy?: string
    }
  }>('/attendance/locations/verify', data)
}
