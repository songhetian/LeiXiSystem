import prisma from '../prisma'

export type NotificationType = 'system' | 'approval' | 'reminder' | 'task' | 'welcome' | 'attendance' | 'schedule' | 'payroll'

export interface SendNotificationInput {
  userId: number
  title: string
  content?: string
  type?: NotificationType | string
  priority?: string
  category?: string
  relatedId?: number
  relatedType?: string
  requiresConfirm?: boolean
  sendTaskId?: number
  skipDedup?: boolean
  dedupKey?: string
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
  userId: number,
  messageType: string
): Promise<boolean> {
  try {
    const pref = await prisma.messagePreference.findUnique({
      where: { userId },
      select: { mutedTypes: true, doNotDisturbStart: true, doNotDisturbEnd: true },
    })

    if (!pref) return true

    if (pref.mutedTypes && Array.isArray(pref.mutedTypes)) {
      if ((pref.mutedTypes as string[]).includes(messageType)) {
        return false
      }
    }

    if (pref.doNotDisturbStart && pref.doNotDisturbEnd) {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const start = pref.doNotDisturbStart
      const end = pref.doNotDisturbEnd
      if (start < end) {
        if (currentTime >= start && currentTime <= end) return false
      } else {
        if (currentTime >= start || currentTime <= end) return false
      }
    }

    return true
  } catch {
    return true
  }
}

export async function sendNotification(input: SendNotificationInput) {
  const {
    userId,
    title,
    content,
    type = 'system',
    priority = 'normal',
    category,
    relatedId,
    relatedType,
    requiresConfirm = false,
    sendTaskId,
    skipDedup = false,
    dedupKey: customDedupKey,
  } = input

  const allowed = await filterByPreferences(userId, type)
  if (!allowed) {
    return null as any
  }

  if (!skipDedup) {
    const key = customDedupKey || generateDedupKey(type, relatedId, userId)
    const isNew = await checkAndMarkDedup(key, type, relatedId, userId)
    if (!isNew) {
      return null as any
    }
  }

  return prisma.notification.create({
    data: {
      userId,
      title,
      content,
      type,
      priority,
      category,
      relatedId,
      relatedType,
      requiresConfirm,
      sendTaskId,
    },
  })
}

export async function sendBatchNotifications(inputs: SendNotificationInput[]) {
  if (inputs.length === 0) return

  const validInputs: SendNotificationInput[] = []

  for (const input of inputs) {
    const allowed = await filterByPreferences(input.userId, input.type || 'system')
    if (!allowed) continue

    if (!input.skipDedup) {
      const key = input.dedupKey || generateDedupKey(input.type || 'system', input.relatedId, input.userId)
      const isNew = await checkAndMarkDedup(key, input.type || 'system', input.relatedId, input.userId)
      if (!isNew) continue
    }

    validInputs.push(input)
  }

  if (validInputs.length === 0) return

  return prisma.notification.createMany({
    data: validInputs.map((i) => ({
      userId: i.userId,
      title: i.title,
      content: i.content,
      type: i.type || 'system',
      priority: i.priority || 'normal',
      category: i.category,
      relatedId: i.relatedId,
      relatedType: i.relatedType,
      requiresConfirm: i.requiresConfirm || false,
      sendTaskId: i.sendTaskId,
    })),
  })
}

export function getUnreadCount(userId: number) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  })
}

export async function markAsConfirmed(userId: number, id: number) {
  return prisma.notification.update({
    where: { id, userId },
    data: { confirmedAt: new Date() },
  })
}

export async function getNotificationDetail(userId: number, id: number) {
  return prisma.notification.findUnique({
    where: { id, userId },
    include: {
      attachments: true,
    },
  })
}
