import { useEffect, useRef, useCallback } from 'react'
import { wsClient, type NotificationMessage } from '@/utils/websocket'
import { useNotificationStore } from '@/store/notification'
import { useAuthStore } from '@/store/auth'
import { logger } from '@/utils/logger'

export function useWebSocket() {
  const token = useAuthStore((state) => state.token)
  const addNotification = useNotificationStore((state) => state.addNotification)
  const setWsConnected = useNotificationStore((state) => state.setWsConnected)
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)
  const prevTokenRef = useRef<string | null>(null)

  const handleNotification = useCallback(
    (data: NotificationMessage) => {
      addNotification(data as any)
    },
    [addNotification]
  )

  const handleConnected = useCallback(() => {
    setWsConnected(true)
    logger.info('[WebSocket] 已连接')
    fetchNotifications()
  }, [setWsConnected, fetchNotifications])

  const handleDisconnected = useCallback(() => {
    setWsConnected(false)
    logger.info('[WebSocket] 已断开')
  }, [setWsConnected])

  useEffect(() => {
    if (!token) {
      if (prevTokenRef.current) {
        wsClient.disconnect()
        prevTokenRef.current = null
      }
      return
    }

    if (token === prevTokenRef.current) return
    prevTokenRef.current = token

    wsClient.connect(token)

    const offNotification = wsClient.on('notification', handleNotification)
    const offConnected = wsClient.on('connected', handleConnected)
    const offDisconnected = wsClient.on('disconnected', handleDisconnected)

    return () => {
      offNotification()
      offConnected()
      offDisconnected()
    }
  }, [token, handleNotification, handleConnected, handleDisconnected])

  const sendMessage = useCallback((type: string, data?: any) => {
    return wsClient.send(type, data)
  }, [])

  const ackNotification = useCallback((id: number) => {
    wsClient.ackNotification(id)
  }, [])

  const readAllNotifications = useCallback(() => {
    wsClient.readAllNotifications()
  }, [])

  const pullOfflineNotifications = useCallback((lastId?: number, limit?: number) => {
    wsClient.pullOfflineNotifications(lastId, limit)
  }, [])

  return {
    isConnected: wsClient.isConnected,
    sendMessage,
    ackNotification,
    readAllNotifications,
    pullOfflineNotifications,
  }
}

export default useWebSocket
