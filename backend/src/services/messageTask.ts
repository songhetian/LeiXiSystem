import prisma from '../prisma'
import { getTargetUsers, type TargetConfig } from './messageTarget'
import { sendMessage } from './messageCenter'

export interface CreateSendTaskInput {
  title: string
  content: string
  type?: string
  priority?: string
  targetType: string
  targetConfig?: TargetConfig
  sendMode: 'immediate' | 'scheduled' | 'recurring'
  scheduledAt?: Date
  cronExpression?: string
  repeatEndAt?: Date
  requiresConfirm?: boolean
  createdById: number
  attachments?: Array<{
    fileName: string
    fileUrl: string
    fileSize?: number
    fileType?: string
  }>
}

export async function createSendTask(input: CreateSendTaskInput) {
  const targetUserIds = await getTargetUsers(input.targetType, input.targetConfig)
  const totalReceivers = targetUserIds.length

  const task = await prisma.messageSendTask.create({
    data: {
      title: input.title,
      content: input.content,
      type: input.type || 'system',
      priority: input.priority || 'normal',
      targetType: input.targetType,
      targetConfig: input.targetConfig as any,
      sendMode: input.sendMode,
      scheduledAt: input.scheduledAt,
      cronExpression: input.cronExpression,
      repeatEndAt: input.repeatEndAt,
      requiresConfirm: input.requiresConfirm || false,
      status: input.sendMode === 'immediate' ? 'sending' : 'pending',
      totalReceivers,
      createdById: input.createdById,
    },
  })

  if (input.attachments && input.attachments.length > 0) {
    await prisma.messageAttachment.createMany({
      data: input.attachments.map(a => ({
        taskId: task.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize,
        fileType: a.fileType,
      })),
    })
  }

  if (input.sendMode === 'immediate') {
    setImmediate(async () => {
      try {
        await sendMessage({
          title: input.title,
          content: input.content,
          type: input.type || 'system',
          priority: input.priority || 'normal',
          targetType: input.targetType,
          targetConfig: input.targetConfig,
          requiresConfirm: input.requiresConfirm,
          sendTaskId: task.id,
          attachments: input.attachments,
        })
      } catch (err) {
        console.error('[MessageTask] 立即发送失败:', err)
        await prisma.messageSendTask.update({
          where: { id: task.id },
          data: { status: 'failed' },
        })
      }
    })
  }

  return task
}

export async function getSendTaskList(params: {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  keyword?: string
  createdById?: number
}) {
  const { page = 1, pageSize = 10, status, type, keyword, createdById } = params

  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type
  if (createdById) where.createdById = createdById
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { content: { contains: keyword } },
    ]
  }

  const [total, list] = await Promise.all([
    prisma.messageSendTask.count({ where }),
    prisma.messageSendTask.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, realName: true, avatar: true } },
        _count: {
          select: { recipients: true, attachments: true },
        },
      },
    }),
  ])

  return { total, list, page, pageSize }
}

export async function getSendTaskDetail(id: number) {
  return prisma.messageSendTask.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, realName: true, avatar: true } },
      attachments: true,
      _count: {
        select: { recipients: true, notifications: true },
      },
    },
  })
}

export async function getTaskRecipients(taskId: number, params: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}) {
  const { page = 1, pageSize = 20, status, keyword } = params

  const where: any = { taskId }
  if (status) where.status = status

  if (keyword) {
    where.user = {
      OR: [
        { realName: { contains: keyword } },
        { username: { contains: keyword } },
      ],
    }
  }

  const [total, list] = await Promise.all([
    prisma.messageRecipient.count({ where }),
    prisma.messageRecipient.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            realName: true,
            username: true,
            avatar: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
  ])

  return { total, list, page, pageSize }
}

export async function cancelSendTask(id: number) {
  const task = await prisma.messageSendTask.findUnique({ where: { id } })
  if (!task) throw new Error('任务不存在')
  if (task.status === 'sent' || task.status === 'failed') {
    throw new Error('任务已执行，无法取消')
  }

  return prisma.messageSendTask.update({
    where: { id },
    data: { status: 'cancelled' },
  })
}

export async function deleteSendTask(id: number) {
  return prisma.messageSendTask.delete({ where: { id } })
}

export async function getPendingScheduledTasks() {
  const now = new Date()
  return prisma.messageSendTask.findMany({
    where: {
      status: 'pending',
      sendMode: 'scheduled',
      scheduledAt: { lte: now },
    },
  })
}

export async function markTaskSent(taskId: number, sentCount: number) {
  return prisma.messageSendTask.update({
    where: { id: taskId },
    data: {
      status: 'sent',
      sentCount,
      sentAt: new Date(),
    },
  })
}
