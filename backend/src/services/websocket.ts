import { sendNotification, type SendNotificationInput } from './notification'
import * as redis from '../utils/redis'
import { WS_CHANNEL, wsOnlineUsersKey, wsNodeUsersKey } from '../types/cache'

export type { SendNotificationInput }

interface ConnectedClient {
  userId: number
  socket: any
  lastHeartbeat: number
}

const connectedClients = new Map<number, ConnectedClient>()

const nodeId =
  process.env.NODE_ID ||
  `node-${process.pid}-${Date.now().toString(36)}`

let redisInitialized = false
let redisAvailable = false

// 离线消息队列
const OFFLINE_QUEUE_KEY = 'ws:offline_queue'
const MAX_OFFLINE_MESSAGES = 100
const OFFLINE_MESSAGE_TTL = 7 * 24 * 60 * 60 // 7 天

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
  const client = connectedClients.get(userId)
  if (!client) return false

  try {
    if (client.socket.readyState === 1) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message)
      client.socket.send(payload)
      client.lastHeartbeat = Date.now()
      return true
    }
  } catch (err) {
    console.error(`[WebSocket] 推送给用户 ${userId} 失败:`, err instanceof Error ? err.message : String(err))
  }

  return false
}

export function registerWebSocketClient(userId: number, socket: any) {
  const existingClient = connectedClients.get(userId)

  connectedClients.set(userId, {
    userId,
    socket,
    lastHeartbeat: Date.now(),
  })

  initRedisPubSub()

  if (redisAvailable) {
    const userIdStr = String(userId)
    redis.sadd(wsOnlineUsersKey(), userIdStr).catch(() => {})
    redis.sadd(wsNodeUsersKey(nodeId), userIdStr).catch(() => {})

    // 用户重新上线，同步离线消息
    syncOfflineMessages(userId).catch(err => {
      console.error(`[WebSocket] 同步离线消息失败:`, err)
    })
  }

  const onlineCount = connectedClients.size
  console.info(`[WebSocket] 用户 ${userId} 已连接，当前在线用户: ${onlineCount}`)
}

export function unregisterWebSocketClient(userId: number, socket: any) {
  const client = connectedClients.get(userId)
  if (client && client.socket === socket) {
    connectedClients.delete(userId)

    if (redisAvailable) {
      const userIdStr = String(userId)
      redis.srem(wsOnlineUsersKey(), userIdStr).catch(() => {})
      redis.srem(wsNodeUsersKey(nodeId), userIdStr).catch(() => {})
    }
  }

  console.info(`[WebSocket] 用户 ${userId} 已断开，当前在线用户: ${connectedClients.size}`)
}

// 心跳检测
export function heartbeat(userId: number): boolean {
  const client = connectedClients.get(userId)
  if (client) {
    client.lastHeartbeat = Date.now()
    return true
  }
  return false
}

// 获取断开的连接并清理
export function cleanupStaleConnections(timeoutMs: number = 60000): number {
  const now = Date.now()
  let cleaned = 0

  for (const [userId, client] of connectedClients.entries()) {
    if (now - client.lastHeartbeat > timeoutMs) {
      try {
        client.socket.close(4000, 'Heartbeat timeout')
      } catch {}
      connectedClients.delete(userId)
      cleaned++

      if (redisAvailable) {
        redis.srem(wsOnlineUsersKey(), String(userId)).catch(() => {})
        redis.srem(wsNodeUsersKey(nodeId), String(userId)).catch(() => {})
      }
    }
  }

  if (cleaned > 0) {
    console.info(`[WebSocket] 清理了 ${cleaned} 个超时连接`)
  }

  return cleaned
}

// 存储离线消息
async function storeOfflineMessage(userId: number, message: any) {
  if (!redisAvailable) return

  const key = `${OFFLINE_QUEUE_KEY}:${userId}`
  const payload = JSON.stringify({
    message,
    timestamp: Date.now(),
  })

  try {
    // 添加到队列
    await redis.lpush(key, payload)
    // 限制队列长度
    await redis.ltrim(key, 0, MAX_OFFLINE_MESSAGES - 1)
    // 设置过期时间
    await redis.expire(key, OFFLINE_MESSAGE_TTL)
  } catch (err) {
    console.error('[WebSocket] 存储离线消息失败:', err)
  }
}

// 同步离线消息
async function syncOfflineMessages(userId: number): Promise<number> {
  if (!redisAvailable) return 0

  const key = `${OFFLINE_QUEUE_KEY}:${userId}`

  try {
    // 获取所有离线消息
    const messages = await redis.lrange(key, 0, -1)
    if (!messages || messages.length === 0) return 0

    // 逐条发送
    let synced = 0
    for (const msgStr of messages) {
      try {
        const msg = JSON.parse(msgStr)
        if (pushLocal(userId, msg.message)) {
          synced++
        }
      } catch {}
    }

    // 清空已同步的消息
    if (synced > 0) {
      await redis.del(key)
      console.info(`[WebSocket] 用户 ${userId} 上线，同步了 ${synced} 条离线消息`)
    }

    return synced
  } catch (err) {
    console.error('[WebSocket] 同步离线消息失败:', err)
    return 0
  }
}

// 获取离线消息数量
export async function getOfflineMessageCount(userId: number): Promise<number> {
  if (!redisAvailable) return 0

  const key = `${OFFLINE_QUEUE_KEY}:${userId}`
  try {
    const len = await redis.llen(key)
    return len ?? 0
  } catch {
    return 0
  }
}

export async function pushToUser(userId: number, message: any): Promise<{ pushed: boolean; stored: boolean }> {
  const localSuccess = pushLocal(userId, message)
  if (localSuccess) return { pushed: true, stored: false }

  initRedisPubSub()

  if (redisAvailable) {
    // 先尝试推送给其他节点的用户
    const isOnline = await redis.sismember(wsOnlineUsersKey(), String(userId))
    if (isOnline) {
      const payload = JSON.stringify({ userId, message, fromNode: nodeId })
      await redis.publish(WS_CHANNEL.PUSH, payload)
      return { pushed: true, stored: false }
    }

    // 用户不在线，存储离线消息
    await storeOfflineMessage(userId, message)
    return { pushed: false, stored: true }
  }

  return { pushed: false, stored: false }
}

export async function sendAndPushNotification(input: SendNotificationInput) {
  const notification = await sendNotification(input)

  const { pushed } = await pushToUser(input.userId, {
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
