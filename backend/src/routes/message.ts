import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { sendMessage, sendMessageByTemplate } from '../services/messageCenter'
import { getTargetUsersWithInfo, getTargetUsers } from '../services/messageTarget'
import { createSendTask, getSendTaskList, getSendTaskDetail, getTaskRecipients, cancelSendTask, deleteSendTask } from '../services/messageTask'

export default async function messageRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.post('/send', async (request: FastifyRequest<{
    Body: {
      title: string
      content: string
      type?: string
      priority?: string
      category?: string
      targetType: string
      targetConfig?: any
      requiresConfirm?: boolean
      relatedId?: number
      relatedType?: string
      sendMode?: 'immediate' | 'scheduled' | 'recurring'
      scheduledAt?: string
      cronExpression?: string
      repeatEndAt?: string
      attachments?: Array<{
        fileName: string
        fileUrl: string
        fileSize?: number
        fileType?: string
      }>
    }
  }>) => {
    const body = request.body
    const sendMode = body.sendMode || 'immediate'

    if (sendMode === 'immediate') {
      const result = await sendMessage({
        title: body.title,
        content: body.content,
        type: body.type,
        priority: body.priority,
        category: body.category,
        targetType: body.targetType,
        targetConfig: body.targetConfig,
        requiresConfirm: body.requiresConfirm,
        relatedId: body.relatedId,
        relatedType: body.relatedType,
        attachments: body.attachments,
      })

      return { code: 0, data: result, message: '发送成功' }
    }

    const task = await createSendTask({
      title: body.title,
      content: body.content,
      type: body.type,
      priority: body.priority,
      targetType: body.targetType,
      targetConfig: body.targetConfig,
      sendMode,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      cronExpression: body.cronExpression,
      repeatEndAt: body.repeatEndAt ? new Date(body.repeatEndAt) : undefined,
      requiresConfirm: body.requiresConfirm,
      createdById: request.user.id,
      attachments: body.attachments,
    })

    return { code: 0, data: { taskId: task.id }, message: '任务创建成功' }
  })

  fastify.post('/send-by-template', async (request: FastifyRequest<{
    Body: {
      templateCode: string
      targetType: string
      targetConfig?: any
      variables?: Record<string, any>
      relatedId?: number
      relatedType?: string
      priority?: string
      requiresConfirm?: boolean
    }
  }>) => {
    const result = await sendMessageByTemplate({
      templateCode: request.body.templateCode,
      targetType: request.body.targetType,
      targetConfig: request.body.targetConfig,
      variables: request.body.variables,
      relatedId: request.body.relatedId,
      relatedType: request.body.relatedType,
      priority: request.body.priority,
      requiresConfirm: request.body.requiresConfirm,
    })

    return { code: 0, data: result, message: '发送成功' }
  })

  fastify.post('/preview-recipients', async (request: FastifyRequest<{
    Body: {
      targetType: string
      targetConfig?: any
      page?: number
      pageSize?: number
    }
  }>) => {
    const { targetType, targetConfig, page = 1, pageSize = 20 } = request.body

    const result = await getTargetUsersWithInfo(targetType, targetConfig, page, pageSize)

    return { code: 0, data: result }
  })

  fastify.get('/tasks', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      type?: string
      keyword?: string
    }
  }>) => {
    const result = await getSendTaskList({
      page: request.query.page,
      pageSize: request.query.pageSize,
      status: request.query.status,
      type: request.query.type,
      keyword: request.query.keyword,
    })

    return { code: 0, data: result }
  })

  fastify.get('/tasks/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const task = await getSendTaskDetail(parseInt(request.params.id))
    if (!task) {
      return { code: 404, message: '任务不存在' }
    }
    return { code: 0, data: task }
  })

  fastify.get('/tasks/:id/recipients', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      keyword?: string
    }
  }>) => {
    const result = await getTaskRecipients(parseInt(request.params.id), {
      page: request.query.page,
      pageSize: request.query.pageSize,
      status: request.query.status,
      keyword: request.query.keyword,
    })

    return { code: 0, data: result }
  })

  fastify.post('/tasks/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    await cancelSendTask(parseInt(request.params.id))
    return { code: 0, message: '取消成功' }
  })

  fastify.delete('/tasks/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    await deleteSendTask(parseInt(request.params.id))
    return { code: 0, message: '删除成功' }
  })
}
