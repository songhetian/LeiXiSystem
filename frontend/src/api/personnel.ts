import { get, post, put, del } from './request'

export interface Employee {
  id: number
  employeeNo: string
  realName: string
  department: string
  departmentId?: number
  position: string
  phone: string
  email: string
  hireDate?: string
  status: 'probation' | 'formal' | 'contract' | 'terminated'
  salary?: number
  rating?: number
  gender?: string
  birthDate?: string
  idCardNo?: string
  nationality?: string
  maritalStatus?: string
  bankName?: string
  bankAccountNo?: string
  probationEndDate?: string
  contractSignDate?: string
  terminationDate?: string
  terminationType?: string
  terminationReason?: string
  emergencyContact?: string
  emergencyPhone?: string
  address?: string
  education?: string
  skills?: string
  remark?: string
  emergencyContacts?: EmergencyContact[]
}

export interface EmergencyContact {
  id?: number
  name: string
  relationship: string
  phone: string
  isPrimary?: boolean
}

export interface EmployeeListResponse {
  code: 0
  data: {
    list: Employee[]
    total: number
    page: number
    pageSize: number
  }
}

export interface EmployeeDetailResponse {
  code: 0
  data: Employee & { emergencyContacts: EmergencyContact[] }
}

export function getEmployees(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  status?: string
}) {
  return get<EmployeeListResponse>('/employee/employees', { params })
}

export function getEmployee(id: number) {
  return get<EmployeeDetailResponse>(`/employee/employees/${id}`)
}

export function updateEmployee(id: number, data: Partial<Employee>) {
  return put(`/employee/employees/${id}`, data)
}

export function deleteEmployee(id: number) {
  return del(`/employee/employees/${id}`)
}

export function batchDeleteEmployees(ids: number[]) {
  return post('/employee/employees/batch-delete', { ids })
}

export function batchUpdateEmployeeStatus(ids: number[], status: string) {
  return post('/employee/employees/batch-status', { ids, status })
}

export interface EmployeeChange {
  id: number
  employeeName: string
  employeeNo: string
  type: string
  beforeContent: string
  afterContent: string
  changeDate: string
  operator: string
  remark: string
}

export interface EmployeeChangeResponse {
  code: 0
  data: {
    list: EmployeeChange[]
    total: number
    page: number
    pageSize: number
  }
}

export function getEmployeeChanges(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
  startDate?: string
  endDate?: string
}) {
  return get<EmployeeChangeResponse>('/employee/changes', { params })
}

// ============ Career Timeline ============

export interface CareerTimelineItem {
  type: string
  date: string
  title: string
  description?: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  operator?: string
}

export interface CareerTimelineResponse {
  code: 0
  data: {
    employee: {
      id: number
      employeeNo: string
      name: string
      department: string
      position: string
      status: string
    }
    timeline: CareerTimelineItem[]
  }
}

export function getCareerTimeline(employeeId: number) {
  return get<CareerTimelineResponse>(`/employee/employees/${employeeId}/career-timeline`)
}
