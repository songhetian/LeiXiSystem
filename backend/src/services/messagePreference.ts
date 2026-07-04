import prisma from '../prisma'

export interface MessagePreferenceInput {
  mutedTypes?: string[]
  doNotDisturbStart?: string
  doNotDisturbEnd?: string
  enableSound?: boolean
  enableDesktop?: boolean
}

export async function getUserPreferences(userId: number) {
  let prefs = await prisma.messagePreference.findUnique({
    where: { userId },
  })

  if (!prefs) {
    prefs = await prisma.messagePreference.create({
      data: {
        userId,
        mutedTypes: [],
        enableSound: true,
        enableDesktop: true,
      },
    })
  }

  return prefs
}

export async function updateUserPreferences(
  userId: number,
  data: MessagePreferenceInput
) {
  const existing = await prisma.messagePreference.findUnique({
    where: { userId },
  })

  if (existing) {
    return prisma.messagePreference.update({
      where: { userId },
      data: {
        ...data,
        mutedTypes: data.mutedTypes as any,
      },
    })
  }

  return prisma.messagePreference.create({
    data: {
      userId,
      mutedTypes: (data.mutedTypes || []) as any,
      doNotDisturbStart: data.doNotDisturbStart,
      doNotDisturbEnd: data.doNotDisturbEnd,
      enableSound: data.enableSound ?? true,
      enableDesktop: data.enableDesktop ?? true,
    },
  })
}
