import { get, put } from './request'

export interface MessagePreference {
  id: number
  userId: number
  mutedTypes?: string[]
  doNotDisturbStart?: string
  doNotDisturbEnd?: string
  enableSound: boolean
  enableDesktop: boolean
  createdAt: string
  updatedAt: string
}

export function getMessagePreferences() {
  return get<{ code: number; data: MessagePreference }>('/message-preferences')
}

export function updateMessagePreferences(data: {
  mutedTypes?: string[]
  doNotDisturbStart?: string
  doNotDisturbEnd?: string
  enableSound?: boolean
  enableDesktop?: boolean
}) {
  return put<{ code: number; data: MessagePreference }>('/message-preferences', data)
}
