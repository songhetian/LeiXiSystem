import { sendNotification, type SendNotificationInput } from './notification'
import * as redis from '../utils/redis'
import { WS_CHANNEL, wsOnlineUsersKey, wsNodeUsersKey } from '../types/cache'

export type { SendNotificationInput }

interface ConnectedClient {
  userId: number
  socket: any
}

const connectedClients = new Map<number, Set<any>>()

const nodeId =
  process.env.NODE_ID ||
  `node-${process.pid}-${Date.now().toString(36)}`

let redisInitialized = false
let redisAvailable = false

function initRedisPubSub() {
  if (redisInitialized) return
  redisInitialized = true

  const available = redis.isRedisAvailable()
  if (!available) {
    console.info('[WebSocket] Redis 不可用，使用单机模式')
    return
  }

  redisAvailable = true

  redis.subscribe(WS_CHANNEL.PUSH, (message) => {
    try {
      const { userId, message: msg } = JSON.parse(message)
      pushLocal(userId, msg)
    } catch (err) {
      console.error('[WebSocket] 解析广播消息失败:', err instanceof Error ? err.message : String(err))
    }
  }).then((success) => {
    if (success) {
      console.info(`[WebSocket] 节点 ${nodeId} 已订阅消息广播频道`)
    }
  })

  process.on('beforeExit', cleanupNode)
  process.on('SIGTERM', cleanupNode)
  process.on('SIGINT', cleanupNode)
}

async function cleanupNode() {
  if (!redisAvailable) return

  try {
    const nodeKey = wsNodeUsersKey(nodeId)
    const userIds = await redis.smembers(nodeKey)
    if (userIds && userIds.length > 0) {
      const onlineKey = wsOnlineUsersKey()
      await redis.srem(onlineKey, ...userIds)
      await redis.srem(nodeKey, ...userIds)
    }
    console.info(`[WebSocket] 节点 ${nodeId} 已清理在线状态`)
  } catch (err) {
    console.error('[WebSocket] 清理节点状态失败:', err instanceof Error ? err.message : String(err))
  }
}

function pushLocal(userId: number, message: any): boolean {
  const userSockets = connectedClients.get(userId)
  if (!userSockets || userSockets.size === 0) return false

  const payload = typeof message === 'string' ? message : JSON.stringify(message)
  let successCount = 0
  userSockets.forEach(socket => {
    try {
      if (socket.readyState === 1) {
        socket.send(payload)
        successCount++
      }
    } catch (err) {
      console.error(`[WebSocket] 推送给用户 ${userId} 失败:`, err instanceof Error ? err.message : String(err))
    }
  })

  return successCount > 0
}

export function registerWebSocketClient(userId: number, socket: any) {
  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set())
  }
  const wasOnline = connectedClients.get(userId)!.size > 0
  connectedClients.get(userId)!.add(socket)

  initRedisPubSub()

  if (redisAvailable && !wasOnline) {
    const userIdStr = String(userId)
    redis.sadd(wsOnlineUsersKey(), userIdStr).catch(() => {})
    redis.sadd(wsNodeUsersKey(nodeId), userIdStr).catch(() => {})
  }

  console.info(`[WebSocket] 用户 ${userId} 已连接，当前在线用户: ${connectedClients.size}`)
}

export function unregisterWebSocketClient(userId: number, socket: any) {
  const userSockets = connectedClients.get(userId)
  if (userSockets) {
    userSockets.delete(socket)
    if (userSockets.size === 0) {
      connectedClients.delete(userId)

      if (redisAvailable) {
        const userIdStr = String(userId)
        redis.srem(wsOnlineUsersKey(), userIdStr).catch(() => {})
        redis.srem(wsNodeUsersKey(nodeId), userIdStr).catch(() => {})
      }
    }
  }
  console.info(`[WebSocket] 用户 ${userId} 已断开，当前在线用户: ${connectedClients.size}`)
}

export async function pushToUser(userId: number, message: any): Promise<boolean> {
  const localSuccess = pushLocal(userId, message)
  if (localSuccess) return true

  initRedisPubSub()

  if (redisAvailable) {
    const isOnline = await redis.sismember(wsOnlineUsersKey(), String(userId))
    if (isOnline) {
      const payload = JSON.stringify({ userId, message, fromNode: nodeId })
      return redis.publish(WS_CHANNEL.PUSH, payload)
    }
  }

  return false
}

export async function sendAndPushNotification(input: SendNotificationInput) {
  const notification = await sendNotification(input)

  const pushed = await pushToUser(input.userId, {
    type: 'notification',
    data: {
      id: notification.id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
      relatedId: notification.relatedId,
      relatedType: notification.relatedType,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    },
  })

  return { notification, pushed }
}

export async function sendAndPushBatchNotifications(inputs: SendNotificationInput[]) {
  if (inputs.length === 0) return { count: 0, pushedCount: 0 }

  const results = await Promise.all(inputs.map(input => sendAndPushNotification(input)))
  const pushedCount = results.filter(r => r.pushed).length

  return { count: results.length, pushedCount }
}

export function getOnlineUserCount(): number {
  return connectedClients.size
}

export async function getOnlineUserCountGlobal(): Promise<number> {
  initRedisPubSub()

  if (redisAvailable) {
    const count = await redis.scard(wsOnlineUsersKey())
    return count ?? connectedClients.size
  }

  return connectedClients.size
}

export function isUserOnline(userId: number): boolean {
  return connectedClients.has(userId)
}

export async function isUserOnlineGlobal(userId: number): Promise<boolean> {
  if (connectedClients.has(userId)) return true

  initRedisPubSub()

  if (redisAvailable) {
    const result = await redis.sismember(wsOnlineUsersKey(), String(userId))
    return result ?? false
  }

  return false
}

export function getNodeId(): string {
  return nodeId
}

export function isRedisMode(): boolean {
  return redisAvailable
}
