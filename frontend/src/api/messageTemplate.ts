import { get, post, put, del } from './request'

export interface MessageTemplate {
  id: number
  name: string
  code: string
  type: string
  title: string
  content: string
  variables?: any
  isSystem: boolean
  status: string
  createdById: number
  createdBy?: { id: number; realName: string }
  createdAt: string
  updatedAt: string
}

export function getMessageTemplateList(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  keyword?: string
}) {
  return get<{
    code: number
    data: { total: number; list: MessageTemplate[]; page: number; pageSize: number }
  }>('/message-templates', { params })
}

export function getMessageTemplate(id: number) {
  return get<{ code: number; data: MessageTemplate }>(`/message-templates/${id}`)
}

export function getMessageTemplateByCode(code: string) {
  return get<{ code: number; data: MessageTemplate }>(`/message-templates/code/${code}`)
}

export function createMessageTemplate(data: {
  name: string
  code: string
  type: string
  title: string
  content: string
  variables?: any
  status?: string
}) {
  return post<{ code: number; data: MessageTemplate }>('/message-templates', data)
}

export function updateMessageTemplate(
  id: number,
  data: {
    name?: string
    type?: string
    title?: string
    content?: string
    variables?: any
    status?: string
  }
) {
  return put<{ code: number; data: MessageTemplate }>(`/message-templates/${id}`, data)
}

export function deleteMessageTemplate(id: number) {
  return del(`/message-templates/${id}`)
}

export function previewMessageTemplate(id: number, variables?: Record<string, any>) {
  return post<{
    code: number
    data: {
      title: string
      content: string
      originalTitle: string
      originalContent: string
    }
  }>(`/message-templates/${id}/preview`, { variables })
}
