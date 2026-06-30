import prisma from '../prisma'

export type NotificationType = 'system' | 'approval' | 'reminder' | 'task' | 'welcome'

export interface SendNotificationInput {
  userId: number
  title: string
  content?: string
  type?: NotificationType
  relatedId?: number
  relatedType?: string
}

export async function sendNotification(input: SendNotificationInput) {
  const { userId, title, content, type = 'system', relatedId, relatedType } = input
  return prisma.notification.create({
    data: {
      userId,
      title,
      content,
      type,
      relatedId,
      relatedType,
    },
  })
}

export async function sendBatchNotifications(inputs: SendNotificationInput[]) {
  if (inputs.length === 0) return
  return prisma.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      title: i.title,
      content: i.content,
      type: i.type || 'system',
      relatedId: i.relatedId,
      relatedType: i.relatedType,
    })),
  })
}

export function getUnreadCount(userId: number) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  })
}
