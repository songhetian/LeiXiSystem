import prisma from '../prisma'
import { getTargetUsers, type TargetConfig } from './messageTarget'
import { sendAndPushBatchNotifications } from './websocket'
import type { SendNotificationInput } from './notification'

export interface SendMessageInput {
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
  sendTaskId?: number
  senderId?: number
  skipDedup?: boolean
  dedupKey?: string
  attachments?: Array<{
    fileName: string
    fileUrl: string
    fileSize?: number
    fileType?: string
  }>
}

export interface SendMessageResult {
  success: boolean
  totalTargets: number
  sentCount: number
  skippedCount: number
  failedCount: number
  failedUserIds: number[]
}

function generateDedupKey(
  messageType: string,
  relatedId: number | undefined,
  userId: number
): string {
  return `${messageType}:${relatedId || 'none'}:${userId}`
}

async function checkAndMarkDedup(
  dedupKey: string,
  messageType: string,
  relatedId: number | undefined,
  userId: number
): Promise<boolean> {
  try {
    const existing = await prisma.messageDeduplication.findUnique({
      where: { dedupKey },
    })
    if (existing) return false

    await prisma.messageDeduplication.create({
      data: {
        dedupKey,
        messageType,
        relatedId,
        userId,
      },
    })
    return true
  } catch {
    return true
  }
}

async function filterByPreferences(
  userIds: number[],
  messageType: string
): Promise<number[]> {
  const preferences = await prisma.messagePreference.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, mutedTypes: true, doNotDisturbStart: true, doNotDisturbEnd: true },
  })

  const prefMap = new Map<number, typeof preferences[0]>()
  preferences.forEach(p => prefMap.set(p.userId, p))

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return userIds.filter(userId => {
    const pref = prefMap.get(userId)
    if (!pref) return true

    if (pref.mutedTypes && Array.isArray(pref.mutedTypes)) {
      if ((pref.mutedTypes as string[]).includes(messageType)) {
        return false
      }
    }

    if (pref.doNotDisturbStart && pref.doNotDisturbEnd) {
      const start = pref.doNotDisturbStart
      const end = pref.doNotDisturbEnd
      if (start < end) {
        if (currentTime >= start && currentTime <= end) return false
      } else {
        if (currentTime >= start || currentTime <= end) return false
      }
    }

    return true
  })
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const {
    title,
    content,
    type = 'system',
    priority = 'normal',
    category,
    targetType,
    targetConfig,
    requiresConfirm = false,
    relatedId,
    relatedType,
    sendTaskId,
    skipDedup = false,
    dedupKey: customDedupKey,
    attachments = [],
  } = input

  const targetUserIds = await getTargetUsers(targetType, targetConfig)
  if (targetUserIds.length === 0) {
    return {
      success: true,
      totalTargets: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failedUserIds: [],
    }
  }

  const filteredUserIds = await filterByPreferences(targetUserIds, type)

  const finalUserIds: number[] = []
  let dedupSkippedCount = 0

  for (const userId of filteredUserIds) {
    if (!skipDedup) {
      const key = customDedupKey || generateDedupKey(type, relatedId, userId)
      const isNew = await checkAndMarkDedup(key, type, relatedId, userId)
      if (!isNew) {
        dedupSkippedCount++
        continue
      }
    }
    finalUserIds.push(userId)
  }

  const notificationInputs: SendNotificationInput[] = finalUserIds.map(userId => ({
    userId,
    title,
    content,
    type,
    relatedId,
    relatedType,
  }))

  let sentCount = 0
  let failedCount = 0
  const failedUserIds: number[] = []

  if (notificationInputs.length > 0) {
    const result = await sendAndPushBatchNotifications(notificationInputs)
    sentCount = result.pushedCount || 0
    failedCount = notificationInputs.length - (result.count || 0)

    if (sendTaskId) {
      // 查找刚创建的通知（通过标题+时间窗口）
      const notifications = await prisma.notification.findMany({
        where: {
          userId: { in: finalUserIds },
          title,
          createdAt: { gte: new Date(Date.now() - 60000) },
        },
        select: { id: true, userId: true },
        orderBy: { createdAt: 'desc' },
        take: finalUserIds.length,
      })

      // 创建收件人记录
      await prisma.messageRecipient.createMany({
        data: finalUserIds.map(userId => ({
          taskId: sendTaskId,
          userId,
          status: 'sent',
          sentAt: new Date(),
        })),
        skipDuplicates: true,
      })

      // 创建附件（关联到通知）
      if (attachments.length > 0 && notifications.length > 0) {
        const attachmentRecords: Array<{
          notificationId: number
          fileName: string
          fileUrl: string
          fileSize?: number
          fileType?: string
        }> = []
        for (const notif of notifications) {
          for (const a of attachments) {
            attachmentRecords.push({
              notificationId: notif.id,
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              fileSize: a.fileSize,
              fileType: a.fileType,
            })
          }
        }
        if (attachmentRecords.length > 0) {
          await prisma.messageAttachment.createMany({
            data: attachmentRecords,
          })
        }
      }

      // 更新通知的额外字段
      if (notifications.length > 0) {
        await prisma.notification.updateMany({
          where: { id: { in: notifications.map(n => n.id) } },
          data: {
            priority,
            category: category || null,
            requiresConfirm,
            sendTaskId,
          },
        })
      }

      // 更新任务统计
      await prisma.messageSendTask.update({
        where: { id: sendTaskId },
        data: {
          sentCount: { increment: finalUserIds.length },
          sentAt: new Date(),
          status: 'sent',
        },
      })
    }
  }

  return {
    success: true,
    totalTargets: targetUserIds.length,
    sentCount: finalUserIds.length,
    skippedCount: dedupSkippedCount + (targetUserIds.length - filteredUserIds.length),
    failedCount,
    failedUserIds,
  }
}

export async function sendMessageByTemplate(params: {
  templateCode: string
  targetType: string
  targetConfig?: TargetConfig
  variables?: Record<string, any>
  relatedId?: number
  relatedType?: string
  priority?: string
  requiresConfirm?: boolean
  skipDedup?: boolean
  dedupKey?: string
  sendTaskId?: number
}) {
  const template = await prisma.messageTemplate.findUnique({
    where: { code: params.templateCode },
  })

  if (!template) {
    throw new Error(`模板不存在: ${params.templateCode}`)
  }

  const { renderTemplate } = await import('./messageTemplate')
  const title = renderTemplate(template.title, params.variables || {})
  const content = renderTemplate(template.content, params.variables || {})

  return sendMessage({
    title,
    content,
    type: template.type,
    priority: params.priority || 'normal',
    targetType: params.targetType,
    targetConfig: params.targetConfig,
    relatedId: params.relatedId,
    relatedType: params.relatedType,
    requiresConfirm: params.requiresConfirm,
    skipDedup: params.skipDedup,
    dedupKey: params.dedupKey,
    sendTaskId: params.sendTaskId,
  })
}
