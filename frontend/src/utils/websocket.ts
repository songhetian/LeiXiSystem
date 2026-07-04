import { useAuthStore } from '@/store/auth'
import { logger } from './logger'

export interface WsMessage {
  type: string
  data?: any
}

export interface NotificationMessage {
  id: number
  title: string
  content: string
  type: string
  relatedId?: number
  relatedType?: string
  isRead: boolean
  createdAt: string
}

type MessageHandler = (data: any) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private handlers = new Map<string, Set<MessageHandler>>()
  private url: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private baseReconnectDelay = 1000

  connect(token: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = import.meta.env.VITE_WS_BASE_URL || `${protocol}//${window.location.host}`
    this.url = `${baseUrl}/ws?token=${encodeURIComponent(token)}`

    this.doConnect()
  }

  private doConnect() {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        logger.info('[WebSocket] 连接成功')
        this.reconnectAttempts = 0
        this.startHeartbeat()
        this.emit('connected', null)
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (err) {
          logger.error('[WebSocket] 消息解析失败', err)
        }
      }

      this.ws.onclose = (event) => {
        logger.warn(`[WebSocket] 连接关闭: code=${event.code}, reason=${event.reason}`)
        this.stopHeartbeat()
        this.emit('disconnected', { code: event.code, reason: event.reason })

        if (event.code !== 4001) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = (err) => {
        logger.error('[WebSocket] 连接错误', err)
        this.emit('error', err)
      }
    } catch (err) {
      logger.error('[WebSocket] 创建连接失败', err)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('[WebSocket] 达到最大重连次数，停止重连')
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectAttempts++
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    )

    logger.info(`[WebSocket] ${delay / 1000}秒后进行第${this.reconnectAttempts}次重连`)

    this.reconnectTimer = setTimeout(() => {
      this.doConnect()
    }, delay)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', { timestamp: Date.now() })
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private handleMessage(message: WsMessage) {
    const { type, data } = message

    switch (type) {
      case 'pong':
        break
      case 'notification':
        this.emit('notification', data as NotificationMessage)
        break
      case 'notification:offline':
        this.emit('notification:offline', data)
        break
      default:
        this.emit(type, data)
        break
    }
  }

  send(type: string, data?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('[WebSocket] 连接未就绪，无法发送消息')
      return false
    }

    try {
      this.ws.send(JSON.stringify({ type, data }))
      return true
    } catch (err) {
      logger.error('[WebSocket] 发送消息失败', err)
      return false
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)

    return () => this.off(type, handler)
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  private emit(type: string, data: any) {
    const handlers = this.handlers.get(type)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (err) {
          logger.error(`[WebSocket] 事件处理器错误 [${type}]`, err)
        }
      })
    }
  }

  ackNotification(id: number) {
    this.send('notification:ack', { id })
  }

  readAllNotifications() {
    this.send('notification:read-all')
  }

  pullOfflineNotifications(lastId?: number, limit?: number) {
    this.send('notification:pull-offline', { lastId, limit })
  }

  disconnect() {
    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, '主动断开')
      this.ws = null
    }

    this.reconnectAttempts = 0
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const wsClient = new WebSocketClient()

export function initWebSocket() {
  const token = useAuthStore.getState().token
  if (token) {
    wsClient.connect(token)
  }
}

export function destroyWebSocket() {
  wsClient.disconnect()
}

export default wsClient
