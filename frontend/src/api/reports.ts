import request from './request'

export interface ReportQuery {
  type?: 'employee' | 'department' | 'monthly' | 'yearly'
  employeeId?: number
  departmentIds?: number[]
  year?: number
  month?: number
  startDate?: string
  endDate?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface ChartData {
  dailyTrend?: any[]
  departmentCompare?: any[]
  shiftPie?: any[]
  yearlyTrend?: any[]
  statusPie?: any[]
  departmentRanking?: any[]
  leaveTypePie?: any[]
  overtimeTypePie?: any[]
  monthlyTrend?: any[]
  expensePie?: any[]
}

export interface ScheduleReportResponse {
  code: number
  data: {
    list?: any[]
    departmentList?: any[]
    dailyStats?: any[]
    monthlySummary?: any
    monthlyData?: any[]
    yearlySummary?: any
    chartData?: ChartData
    startDate: string
    endDate: string
    shiftMap?: any
    year?: number
    total?: number
  }
}

export interface AttendanceReportResponse {
  code: number
  data: {
    list: any[]
    departmentSummary: any[]
    departmentRanking?: any[]
    chartData?: ChartData
    startDate: string
    endDate: string
    total: number
    totalEmployees: number
    avgAttendanceRate: number
  }
}

export interface LeaveOvertimeReportResponse {
  code: number
  data: {
    list: any[]
    departmentSummary?: any[]
    leaveTypeSummary: Record<string, number>
    overtimeTypeSummary: Record<string, number>
    chartData?: ChartData
    startDate: string
    endDate: string
    total: number
    totalLeaveDays: number
    totalOvertimeHours: number
  }
}

export interface FinanceReportResponse {
  code: number
  data: {
    departmentSummary: any[]
    summary: {
      totalSalary: number
      totalReimbursement: number
      totalExpense: number
      employeeCount: number
      avgSalary: number
    }
    chartData?: ChartData
    startDate: string
    endDate: string
    total: number
  }
}

export interface AttendanceDetailResponse {
  code: number
  data: {
    list: any[]
    total: number
    page: number
    pageSize: number
    startDate: string
    endDate: string
  }
}

export interface AttendanceRankingResponse {
  code: number
  data: {
    list: any[]
    startDate: string
    endDate: string
    total: number
  }
}

export interface AttendanceTrendResponse {
  code: number
  data: {
    year: number
    thisYear: {
      total: number
      normal: number
      avgAttendanceRate: number
      monthly: any[]
    }
    lastYear: {
      total: number
      normal: number
      avgAttendanceRate: number
      monthly: any[]
    }
    yearOverYear: any[]
    monthOverMonth: any[]
  }
}

export function getScheduleReport(params: ReportQuery): Promise<ScheduleReportResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/schedule', { params: query })
}

export function getAttendanceReport(params: ReportQuery): Promise<AttendanceReportResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/attendance', { params: query })
}

export function getLeaveOvertimeReport(params: ReportQuery): Promise<LeaveOvertimeReportResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/leave-overtime', { params: query })
}

export function getFinanceReport(params: ReportQuery): Promise<FinanceReportResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/finance', { params: query })
}

export function getAttendanceDetail(params: ReportQuery): Promise<AttendanceDetailResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/attendance/detail', { params: query })
}

export function getAttendanceRanking(params: ReportQuery): Promise<AttendanceRankingResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/attendance/ranking', { params: query })
}

export function getAttendanceTrend(params: ReportQuery): Promise<AttendanceTrendResponse> {
  const query: any = { ...params }
  if (params.departmentIds?.length) {
    query.departmentIds = JSON.stringify(params.departmentIds)
  }
  return request.get('/reports/attendance/trend', { params: query })
}