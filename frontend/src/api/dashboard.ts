import { get } from './request'

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalDepartments: number
  totalPositions: number
  todayAttendance: number
  pendingApprovals: number
}

export interface AttendanceOverview {
  date: string
  total: number
  normal: number
  late: number
  early: number
  absent: number
  attendanceRate: string
  recentList: Array<{
    id: number
    name: string
    department?: string
    checkIn?: string
    checkOut?: string
    status: string
  }>
}

export interface TodoItem {
  id: number
  type: string
  typeName: string
  title: string
  applicant: string
  createdAt: string
}

export function getDashboardStats() {
  return get<{ code: 0; data: DashboardStats }>('/dashboard/stats')
}

export function getAttendanceOverview() {
  return get<{ code: 0; data: AttendanceOverview }>('/dashboard/attendance-overview')
}

export function getDashboardTodos() {
  return get<{ code: 0; data: TodoItem[] }>('/dashboard/todos')
}
