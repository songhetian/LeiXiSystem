import { get, post, del } from './request'

export interface TargetConfig {
  departmentIds?: number[]
  roleIds?: number[]
  tagIds?: number[]
  positionIds?: number[]
  userIds?: number[]
}

export interface MessageAttachment {
  fileName: string
  fileUrl: string
  fileSize?: number
  fileType?: string
}

export interface SendMessageParams {
  title: string
  content: string
  type?: string
  priority?: string
  category?: string
  targetType: string
  targetConfig?: TargetConfig
  requiresConfirm?: boolean
  relatedId?: number
  relatedType?: string
  sendMode?: 'immediate' | 'scheduled' | 'recurring'
  scheduledAt?: string
  cronExpression?: string
  repeatEndAt?: string
  attachments?: MessageAttachment[]
}

export interface SendMessageResult {
  success: boolean
  totalTargets: number
  sentCount: number
  skippedCount: number
  failedCount: number
  failedUserIds: number[]
}

export function sendMessage(params: SendMessageParams) {
  return post<{ code: number; data: SendMessageResult }>('/messages/send', params)
}

export function sendMessageByTemplate(params: {
  templateCode: string
  targetType: string
  targetConfig?: TargetConfig
  variables?: Record<string, any>
  relatedId?: number
  relatedType?: string
  priority?: string
  requiresConfirm?: boolean
}) {
  return post<{ code: number; data: SendMessageResult }>('/messages/send-by-template', params)
}

export function previewRecipients(params: {
  targetType: string
  targetConfig?: TargetConfig
  page?: number
  pageSize?: number
}) {
  return post<{
    code: number
    data: {
      total: number
      list: Array<{
        id: number
        realName: string
        username: string
        avatar?: string
        department?: { id: number; name: string }
        position?: { id: number; name: string }
      }>
    }
  }>('/messages/preview-recipients', params)
}

export interface MessageSendTask {
  id: number
  title: string
  content: string
  type: string
  priority: string
  targetType: string
  targetConfig?: any
  sendMode: string
  scheduledAt?: string
  cronExpression?: string
  repeatEndAt?: string
  requiresConfirm: boolean
  status: string
  totalReceivers: number
  sentCount: number
  readCount: number
  createdById: number
  createdBy: { id: number; realName: string; avatar?: string }
  createdAt: string
  updatedAt: string
  sentAt?: string
  _count?: { recipients: number; attachments: number }
}

export function getMessageTaskList(params?: {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  keyword?: string
}) {
  return get<{
    code: number
    data: { total: number; list: MessageSendTask[]; page: number; pageSize: number }
  }>('/messages/tasks', { params })
}

export function getMessageTaskDetail(id: number) {
  return get<{ code: number; data: MessageSendTask }>(`/messages/tasks/${id}`)
}

export function getMessageTaskRecipients(taskId: number, params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}) {
  return get<{
    code: number
    data: {
      total: number
      list: Array<{
        id: number
        userId: number
        status: string
        isRead: boolean
        readAt?: string
        sentAt?: string
        user: {
          id: number
          realName: string
          username: string
          avatar?: string
          department?: { name: string }
        }
      }>
      page: number
      pageSize: number
    }
  }>(`/messages/tasks/${taskId}/recipients`, { params })
}

export function cancelMessageTask(id: number) {
  return post(`/messages/tasks/${id}/cancel`)
}

export function deleteMessageTask(id: number) {
  return del(`/messages/tasks/${id}`)
}
