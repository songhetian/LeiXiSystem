import { get, post, put } from './request'

export function getHelpdeskCategories() {
  return get('/helpdesk/categories')
}

export function createHelpdeskCategory(data: any) {
  return post('/helpdesk/categories', data)
}

export function getHelpdeskTickets(params?: any) {
  return get('/helpdesk/tickets', { params })
}

export function createHelpdeskTicket(data: any) {
  return post('/helpdesk/tickets', data)
}

export function getHelpdeskTicket(id: number) {
  return get(`/helpdesk/tickets/${id}`)
}

export function updateHelpdeskTicket(id: number, data: any) {
  return put(`/helpdesk/tickets/${id}`, data)
}

export function createHelpdeskComment(id: number, data: any) {
  return post(`/helpdesk/tickets/${id}/comments`, data)
}
