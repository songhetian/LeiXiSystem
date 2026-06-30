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
  employee?: any
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

export function createHelpdeskCategory(data: any) {
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

export function createHelpdeskTicket(data: any) {
  return post('/helpdesk/tickets', data)
}

export function getHelpdeskTicket(id: number) {
  return get(`/helpdesk/tickets/${id}`)
}

export function getHelpdeskTicketDetail(id: number) {
  return get<{ code: 0; data: HelpdeskTicket }>(`/helpdesk/tickets/${id}`)
}

export function updateHelpdeskTicket(id: number, data: any) {
  return put(`/helpdesk/tickets/${id}`, data)
}

export function createHelpdeskComment(id: number, data: any) {
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
