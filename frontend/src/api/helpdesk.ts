import { get, post, put, del } from './request'

export interface HelpdeskCategory {
  id: number
  name: string
  code: string
  description?: string
  status: string
  sortOrder: number
}

export interface HelpdeskTicket {
  id: number
  ticketNo: string
  title: string
  description?: string
  priority: string
  status: string
  createdAt?: string
  updatedAt?: string
  resolvedAt?: string
  category?: HelpdeskCategory
  creator?: { id?: number; realName: string }
  assignee?: { id?: number; realName: string }
  employee?: { id: number; employeeNo: string; user?: { realName: string } }
  comments?: Comment[]
}

export interface Comment {
  id: number
  content: string
  isInternal: boolean
  createdAt?: string
  user?: { realName: string }
}

export function getHelpdeskCategories() {
  return get<{ code: 0; data: HelpdeskCategory[] }>('/helpdesk/categories')
}

export function createHelpdeskCategory(data: {
  name: string
  code: string
  description?: string
  status?: string
  sortOrder?: number
}) {
  return post('/helpdesk/categories', data)
}

export function deleteHelpdeskCategory(id: number) {
  return del(`/helpdesk/categories/${id}`)
}

export function getHelpdeskTickets(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  categoryId?: number
  priority?: string
}) {
  return get<{ code: 0; data: { list: HelpdeskTicket[]; total: number; page: number; pageSize: number } }>('/helpdesk/tickets', { params })
}

export function createHelpdeskTicket(data: {
  title: string
  description?: string
  categoryId: number
  priority?: string
  assigneeId?: number
}) {
  return post('/helpdesk/tickets', data)
}

export function getHelpdeskTicket(id: number) {
  return get(`/helpdesk/tickets/${id}`)
}

export function getHelpdeskTicketDetail(id: number) {
  return get<{ code: 0; data: HelpdeskTicket }>(`/helpdesk/tickets/${id}`)
}

export function updateHelpdeskTicket(id: number, data: {
  title?: string
  description?: string
  categoryId?: number
  priority?: string
  status?: string
  assigneeId?: number
}) {
  return put(`/helpdesk/tickets/${id}`, data)
}

export function createHelpdeskComment(id: number, data: {
  content: string
  isInternal?: boolean
}) {
  return post(`/helpdesk/tickets/${id}/comments`, data)
}

export function batchAssignTickets(ids: number[], assignedTo: number) {
  return post('/helpdesk/tickets/batch-assign', { ids, assignedTo })
}

export function batchResolveTickets(ids: number[], resolution?: string) {
  return post('/helpdesk/tickets/batch-resolve', { ids, resolution })
}

export function batchCloseTickets(ids: number[]) {
  return post('/helpdesk/tickets/batch-close', { ids })
}

// ─── Customers (N5) ───

export interface Customer {
  id: number
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  slaId?: number
  tags?: string
  status: string
  _count?: { tickets: number }
}

export function getCustomers(params?: any) {
  return get<{ code: number; data: { total: number; list: Customer[] } }>('/helpdesk/customers', params)
}

export function createCustomer(data: any) {
  return post<{ code: number; data: Customer }>('/helpdesk/customers', data)
}

export function getCustomer(id: number) {
  return get<{ code: number; data: Customer & { tickets: any[] } }>(`/helpdesk/customers/${id}`)
}

export function updateCustomer(id: number, data: any) {
  return put<{ code: number; data: Customer }>(`/helpdesk/customers/${id}`, data)
}

export function deleteCustomer(id: number) {
  return del<{ code: number }>(`/helpdesk/customers/${id}`)
}

export function getCustomerTickets(id: number, params?: any) {
  return get<{ code: number; data: { total: number; list: any[] } }>(`/helpdesk/customers/${id}/tickets`, params)
}

// ─── Canned Responses (N8) ───

export interface CannedResponse {
  id: number
  title: string
  content: string
  category?: string
  isGlobal: boolean
  usageCount: number
  status: string
}

export function getCannedResponses(params?: any) {
  return get<{ code: number; data: { list: CannedResponse[] } }>('/helpdesk/canned-responses', params)
}

export function createCannedResponse(data: any) {
  return post<{ code: number; data: CannedResponse }>('/helpdesk/canned-responses', data)
}

export function updateCannedResponse(id: number, data: any) {
  return put<{ code: number; data: CannedResponse }>(`/helpdesk/canned-responses/${id}`, data)
}

export function deleteCannedResponse(id: number) {
  return del<{ code: number }>(`/helpdesk/canned-responses/${id}`)
}

export function searchCannedResponses(q: string) {
  return get<{ code: number; data: { list: CannedResponse[] } }>('/helpdesk/canned-responses/search', { q })
}

// ─── Satisfaction (N3) ───

export function submitSatisfaction(ticketId: number, data: { rating: number; comment?: string }) {
  return post<{ code: number; data: any }>(`/helpdesk/tickets/${ticketId}/satisfaction`, data)
}

export function getSatisfactionStats(params?: any) {
  return get<{ code: number; data: { total: number; avgRating: number; distribution: Record<number, number> } }>('/helpdesk/satisfaction/stats', params)
}

// ─── Assignment Engine (G1) ───

export function getAssignableEmployees() {
  return get<{ code: number; data: { employeeId: number; userId: number; realName: string; activeTickets: number; maxTickets: number; available: boolean }[] }>('/helpdesk/tickets/assignable-employees')
}

export function autoAssignTicket(ticketId: number) {
  return post<{ code: number; data: any }>(`/helpdesk/tickets/${ticketId}/auto-assign`)
}

export function getQueueStatus() {
  return get<{ code: number; data: { queueLength: number; avgWaitMinutes: number; priorities: { high: number; medium: number; low: number } } }>('/helpdesk/tickets/queue-status')
}

// ─── SLA (G2) ───

export interface HelpdeskSLA {
  id: number
  name: string
  description?: string
  categoryId?: number
  priority?: string
  customerTier?: string
  responseTime: number
  resolutionTime: number
  workdaysOnly: boolean
  holidayListId?: number
  status: string
}

export function getSLAs() {
  return get<{ code: number; data: { list: HelpdeskSLA[] } }>('/helpdesk/slas')
}

export function createSLA(data: any) {
  return post<{ code: number; data: HelpdeskSLA }>('/helpdesk/slas', data)
}

export function updateSLA(id: number, data: any) {
  return put<{ code: number; data: HelpdeskSLA }>(`/helpdesk/slas/${id}`, data)
}

export function deleteSLA(id: number) {
  return del<{ code: number }>(`/helpdesk/slas/${id}`)
}

export function getTicketSLAStatus(ticketId: number) {
  return get<{ code: number; data: any }>(`/helpdesk/tickets/${ticketId}/sla-status`)
}
