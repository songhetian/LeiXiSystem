import { get, post, put, del } from './request'

export interface ExpenseStandard {
  id: number
  name: string
  type: string
  amountLimit: number
  dailyLimit?: number | null
  monthlyLimit?: number | null
  departmentId?: number | null
  department?: { id: number; name: string }
  requireInvoice: boolean
  description?: string | null
  status: string
  sortOrder: number
}

export const EXPENSE_TYPES = [
  { value: '差旅费', label: '差旅费' },
  { value: '餐饮费', label: '餐饮费' },
  { value: '交通费', label: '交通费' },
  { value: '招待费', label: '招待费' },
  { value: '办公用品', label: '办公用品' },
  { value: '通讯费', label: '通讯费' },
  { value: '培训费', label: '培训费' },
  { value: '其他', label: '其他' },
]

export function getExpenseStandards(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
  departmentId?: number
  status?: string
}) {
  return get<{ code: 0; data: { list: ExpenseStandard[]; total: number; page: number; pageSize: number } }>('/expense-standards/', { params })
}

export function getExpenseStandard(id: number) {
  return get<{ code: 0; data: ExpenseStandard }>(`/expense-standards/${id}`)
}

export function createExpenseStandard(data: Partial<ExpenseStandard>) {
  return post('/expense-standards/', data)
}

export function updateExpenseStandard(id: number, data: Partial<ExpenseStandard>) {
  return put(`/expense-standards/${id}`, data)
}

export function deleteExpenseStandard(id: number) {
  return del(`/expense-standards/${id}`)
}

export function getExpenseTypes() {
  return get<{ code: 0; data: typeof EXPENSE_TYPES }>('/expense-standards/types/list')
}

export function checkExpenseStandard(data: {
  type: string
  amount: number
  departmentId?: number
}) {
  return post<{ code: 0; data: {
    passed: boolean
    warnings: string[]
    standard?: {
      amountLimit: number
      dailyLimit?: number | null
      monthlyLimit?: number | null
      requireInvoice: boolean
    }
  } }>('/expense-standards/check', data)
}
