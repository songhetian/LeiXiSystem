import { get, post, put, del } from './request'

export interface SalaryComponent {
  id: number
  name: string
  type: 'fixed' | 'variable' | 'allowance' | 'deduction'
  amount: number
  description?: string
  status: string
}

export interface PayrollRun {
  id: number
  name: string
  period?: string
  payrollPeriod?: { year: number; month: number }
  status: 'draft' | 'calculating' | 'ready' | 'published'
  totalAmount?: number
  employeeCount?: number
  createdAt: string
  publishedAt?: string
  creator?: { realName: string }
  scopeType?: string
}

export interface Payslip {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  department: string
  baseSalary: number
  totalEarnings: number
  totalDeductions: number
  netSalary: number
  status: string
  payPeriod: string
  paidAt?: string
  payrollRun?: { id: number; name: string; payrollPeriod?: { year: number; month: number } }
  employee?: {
    id: number
    user?: { realName: string; department?: { name: string } }
  }
  grossPay?: number
  totalDeduction?: number
  netPay?: number
  paidDays?: number
  attendanceSnapshot?: Record<string, unknown>
  items?: PayslipItem[]
  disputes?: PayslipDispute[]
  year?: number
  month?: number
}

export interface PayslipItem {
  id: number
  component?: { id: number; name: string }
  type: string
  amount: number
}

export interface SalaryStructure {
  id: number
  name: string
  payrollFrequency: string
  status: string
  effectiveFrom: string
  effectiveTo?: string
  items: SalaryStructureItem[]
  createdAt?: string
}

export interface SalaryStructureItem {
  componentId?: number
  amount?: number
  formula?: string
  condition?: string
  sortOrder: number
}

export interface SalaryAssignment {
  id: number
  employeeId: number
  salaryStructureId: number
  baseSalary: number
  effectiveFrom: string
  effectiveTo?: string
  status: string
  employee?: {
    id: number
    user?: { realName: string; department?: { name: string } }
  }
  salaryStructure?: { id: number; name: string }
}

export interface PayrollAdjustment {
  id: number
  year: number
  month: number
  type: string
  amount: number
  reason?: string
  status: string
  employee?: {
    id: number
    user?: { realName: string; department?: { name: string } }
  }
  component?: { id: number; name: string }
}

export interface PayslipDispute {
  id: number
  reason?: string
  status: string
  handlerReply?: string
  employee?: {
    id: number
    user?: { realName: string; department?: { name: string } }
  }
  payslip?: {
    id: number
    payrollRun?: { payrollPeriod?: { year: number; month: number } }
  }
}

export interface PayrollRunDetail {
  run: PayrollRun
  payslips: Payslip[]
  adjustments: PayrollAdjustment[]
  disputes: PayslipDispute[]
  summary: {
    payslipCount?: number
    netPay?: number
    adjustmentCount?: number
    disputeCount?: number
  }
}

export interface MyPayslip {
  id: number
  year: number
  month: number
  netPayMasked?: string
  status: string
  publishedAt?: string
  grossPay?: number
  totalDeduction?: number
  netPay?: number
  items?: PayslipItem[]
  disputes?: PayslipDispute[]
}

export function getSalaryComponents() {
  return get<{ code: 0; data: SalaryComponent[] }>('/payroll/components')
}

export function createSalaryComponent(data: Omit<SalaryComponent, 'id'>) {
  return post<{ code: 0; data: SalaryComponent }>('/payroll/components', data)
}

export function updateSalaryComponent(id: number, data: Partial<Omit<SalaryComponent, 'id'>>) {
  return put<{ code: 0; data: SalaryComponent }>(`/payroll/components/${id}`, data)
}

export function deleteSalaryComponent(id: number) {
  return del(`/payroll/components/${id}`)
}

export function batchDeleteSalaryComponents(ids: number[]) {
  return post('/payroll/components/batch-delete', { ids })
}

export function batchUpdateSalaryComponentStatus(ids: number[], status: string) {
  return post('/payroll/components/batch-status', { ids, status })
}

export function getSalaryStructures() {
  return get('/payroll/structures')
}

export function createSalaryStructure(data: any) {
  return post('/payroll/structures', data)
}

export function updateSalaryStructure(id: number, data: any) {
  return put(`/payroll/structures/${id}`, data)
}

export function getSalaryAssignments(params?: any) {
  return get('/payroll/assignments', { params })
}

export function createSalaryAssignment(data: any) {
  return post('/payroll/assignments', data)
}

export function updateSalaryAssignment(id: number, data: any) {
  return put(`/payroll/assignments/${id}`, data)
}

export function getPayrollRuns() {
  return get<{ code: 0; data: PayrollRun[] }>('/payroll/runs')
}

export function getPayrollRunDetail(id: number) {
  return get<{ code: 0; data: PayrollRunDetail }>(`/payroll/runs/${id}/detail`)
}

export function createPayrollRun(data: any) {
  return post('/payroll/runs', data)
}

export function calculatePayrollRun(id: number) {
  return post(`/payroll/runs/${id}/calculate`)
}

export function publishPayrollRun(id: number) {
  return post(`/payroll/runs/${id}/publish`)
}

export function getPayslips(params?: { page?: number; pageSize?: number; status?: string }) {
  return get<{ code: 0; data: { list: Payslip[]; total: number; page: number; pageSize: number } }>('/payroll/payslips', { params })
}

export function recalculatePayslip(id: number) {
  return post(`/payroll/payslips/${id}/recalculate`)
}

export function withdrawPayslip(id: number) {
  return post(`/payroll/payslips/${id}/withdraw`)
}

export function getPayrollAdjustments(params?: any) {
  return get('/payroll/adjustments', { params })
}

export function createPayrollAdjustment(data: any) {
  return post('/payroll/adjustments', data)
}

export function approvePayrollAdjustment(id: number, data?: { opinion?: string }) {
  return post(`/payroll/adjustments/${id}/approve`, data)
}

export function rejectPayrollAdjustment(id: number, data?: { opinion?: string }) {
  return post(`/payroll/adjustments/${id}/reject`, data)
}

export function getPayslipDisputes(params?: any) {
  return get('/payroll/disputes', { params })
}

export function handlePayslipDispute(id: number, data: { status: 'resolved' | 'rejected'; handlerReply?: string }) {
  return post(`/payroll/disputes/${id}/handle`, data)
}

export function getMyPayslips() {
  return get<{ code: 0; data: Payslip[] }>('/payroll/my-payslips')
}

export function getMyPayslipDetail(id: number, payslipAccessToken: string) {
  return get(`/payroll/my-payslips/${id}`, {
    headers: {
      'x-payslip-access-token': payslipAccessToken,
    },
  })
}

export function confirmMyPayslip(id: number) {
  return post(`/payroll/my-payslips/${id}/confirm`)
}

export function disputeMyPayslip(id: number, data: { reason: string }) {
  return post(`/payroll/my-payslips/${id}/dispute`, data)
}

export function getPayslipPasswordStatus() {
  return get('/payslip/password-status')
}

export function setPayslipPassword(data: { password: string; confirmPassword: string }) {
  return post('/payslip/set-password', data)
}

export function confirmPayslip(id: number) {
  return post(`/payroll/payslips/${id}/confirm`)
}

export function disputePayslip(id: number, data: { reason: string }) {
  return post(`/payroll/payslips/${id}/dispute`, data)
}

export function verifyPayslipPassword(data: { password: string }) {
  return post<{ code: 0; data: { payslipAccessToken?: string } }>('/payslip/verify-password', data)
}
