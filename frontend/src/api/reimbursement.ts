import { get, post } from './request'

export interface Reimbursement {
  id: number
  userId: number
  employeeId: number
  title: string
  type: string
  amount: number
  expenseDate: string
  description?: string | null
  status: string
  currentStep: number
  createdAt: string
  updatedAt: string
}

export interface ReimbursementListResponse {
  code: 0
  data: {
    list: Reimbursement[]
    total: number
    page: number
    pageSize: number
  }
}

export interface PendingReimbursement {
  id: number
  title: string
  type: string
  amount: number
  applicantName: string
  departmentName: string
  status: string
  createdAt: string
}

export interface PendingReimbursementListResponse {
  code: 0
  data: {
    list: PendingReimbursement[]
    total: number
    page: number
    pageSize: number
  }
}

export function getReimbursementList(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  keyword?: string
}) {
  return get<ReimbursementListResponse>('/reimbursements', { params })
}

export function applyReimbursement(data: {
  title: string
  type: string
  amount: number
  expenseDate: string
  description?: string
}) {
  return post('/reimbursement/apply', data)
}

export function getReimbursementDetail(id: number) {
  return get<{
    code: 0
    data: Reimbursement & {
      attachments?: { id: number; url: string; filename: string }[]
      comments?: { id: number; content: string; createdAt: string }[]
      workflowHistory?: { step: number; status: string; assigneeName?: string; createdAt: string }[]
    }
  }>(`/reimbursement/${id}`)
}

export function cancelReimbursement(id: number) {
  return post(`/reimbursement/${id}/cancel`)
}

export function getPendingReimbursement(params?: {
  page?: number
  pageSize?: number
  type?: string
}) {
  return get<PendingReimbursementListResponse>('/reimbursement/approval/pending', { params })
}

export function approveReimbursement(id: number, data?: { opinion?: string }) {
  return post(`/reimbursement/approval/${id}/approve`, data)
}

export function rejectReimbursement(id: number, data?: { opinion?: string }) {
  return post(`/reimbursement/${id}/reject`, data)
}

export function batchApproveReimbursement(ids: number[], opinion?: string) {
  return post('/reimbursement/batch-approve', { ids, opinion })
}

export function batchRejectReimbursement(ids: number[], opinion?: string) {
  return post('/reimbursement/batch-reject', { ids, opinion })
}

// 预算预警检查
export function checkBudget(data: { type: string; amount: number; departmentId?: number }) {
  return post<{
    code: 0
    data: {
      status: 'passed' | 'warning' | 'overdraft' | 'no_budget'
      message: string
      available?: number
      totalBudget?: number
      spentAmount?: number
      usageRate?: number
      categoryBudget?: number
      categoryAvailable?: number
    }
  }>('/budgets/check', data)
}

// 费用标准校验
export function validateExpenseStandard(data: { type: string; amount: number; departmentId?: number }) {
  return post<{
    code: 0
    data: {
      passed: boolean
      warnings: string[]
      standard?: {
        amountLimit: number
        dailyLimit?: number
        monthlyLimit?: number
        requireInvoice: boolean
      }
    }
  }>('/expense-standards/check', data)
}

// 保存报销草稿
export function saveReimbursementDraft(data: {
  title?: string
  type?: string
  amount?: number
  expenseDate?: string
  description?: string
}) {
  return post('/reimbursement/draft', data)
}

// 获取草稿
export function getReimbursementDraft() {
  return get<{
    code: 0
    data: {
      title: string
      type: string
      amount: number
      expenseDate: string
      description: string
    } | null
  }>('/reimbursement/draft')
}
