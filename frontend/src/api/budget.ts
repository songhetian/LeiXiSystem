import { get, post, put, del } from './request'

export interface BudgetItem {
  id: number
  budgetId: number
  type: string
  budgetAmount: number
  spentAmount: number
  reservedAmount: number
}

export interface AnnualBudget {
  id: number
  year: number
  departmentId: number
  department?: { id: number; name: string }
  totalBudget: number
  spentAmount: number
  reservedAmount: number
  description?: string | null
  items: BudgetItem[]
  usageRate?: number
  availableAmount?: number
  createdBy: number
  createdAt: string
}

export function getBudgets(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  year?: number
  departmentId?: number
}) {
  return get<{ code: 0; data: { list: AnnualBudget[]; total: number; page: number; pageSize: number } }>('/budgets/', { params })
}

export function getBudget(id: number) {
  return get<{ code: 0; data: AnnualBudget }>(`/budgets/${id}`)
}

export function createBudget(data: {
  year: number
  departmentId: number
  totalBudget: number
  description?: string
  items?: Array<{ type: string; budgetAmount: number }>
}) {
  return post('/budgets/', data)
}

export function updateBudget(id: number, data: {
  totalBudget?: number
  description?: string
  status?: string
}) {
  return put(`/budgets/${id}`, data)
}

export function deleteBudget(id: number) {
  return del(`/budgets/${id}`)
}

export function updateBudgetItems(id: number, items: Array<{ type: string; budgetAmount: number }>) {
  return put(`/budgets/${id}/items`, { items })
}

export function getBudgetStatus(departmentId: number) {
  return get<{ code: 0; data: AnnualBudget | null }>(`/budgets/status/${departmentId}`)
}

export function checkBudget(data: {
  departmentId: number
  amount: number
  type?: string
}) {
  return post<{ code: 0; data: {
    status: 'passed' | 'warning' | 'overdraft' | 'no_budget'
    message: string
    available?: number
    usageRate?: number
  } }>('/budgets/check', data)
}
