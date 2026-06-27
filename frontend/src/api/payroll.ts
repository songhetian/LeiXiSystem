import { get, post, put } from './request'

export function getSalaryComponents() {
  return get('/payroll/components')
}

export function createSalaryComponent(data: any) {
  return post('/payroll/components', data)
}

export function updateSalaryComponent(id: number, data: any) {
  return put(`/payroll/components/${id}`, data)
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
  return get('/payroll/runs')
}

export function getPayrollRunDetail(id: number) {
  return get(`/payroll/runs/${id}/detail`)
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

export function getPayslips(params?: any) {
  return get('/payroll/payslips', { params })
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
  return get('/payroll/my-payslips')
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

export function verifyPayslipPassword(data: { password: string }) {
  return post('/payslip/verify-password', data)
}
