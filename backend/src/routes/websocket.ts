import { FastifyInstance } from 'fastify'
import { registerWebSocketClient, unregisterWebSocketClient, pushToUser } from '../services/websocket'
import prisma from '../prisma'

interface WsMessage {
  type: string
  data?: any
}

export default async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    const socket = connection.socket
    let userId = 0

    const token = (request.query as any)?.token
    if (!token) {
      socket.close(4001, '未授权')
      return
    }

    try {
      const decoded = fastify.jwt.verify(token) as any
      userId = decoded.userId || decoded.id
    } catch {
      socket.close(4001, 'Token 无效')
      return
    }

    if (!userId) {
      socket.close(4001, '用户信息无效')
      return
    }

    registerWebSocketClient(userId, socket)

    pushToUser(userId, {
      type: 'connected',
      data: {
        userId,
        timestamp: Date.now(),
      },
    })

    socket.on('message', async (raw: Buffer) => {
      try {
        const message: WsMessage = JSON.parse(raw.toString())

        switch (message.type) {
          case 'ping':
            socket.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }))
            break

          case 'notification:ack': {
            const notificationId = message.data?.id
            if (notificationId) {
              await prisma.notification.update({
                where: { id: parseInt(notificationId), userId },
                data: { isRead: true, readAt: new Date() },
              }).catch(() => {})
            }
            break
          }

          case 'notification:read-all':
            await prisma.notification.updateMany({
              where: { userId, isRead: false },
              data: { isRead: true, readAt: new Date() },
            }).catch(() => {})
            break

          case 'notification:pull-offline': {
            const { lastId = 0, limit = 50 } = message.data || {}
            const notifications = await prisma.notification.findMany({
              where: {
                userId,
                id: { gt: parseInt(lastId) || 0 },
              },
              orderBy: { id: 'asc' },
              take: Math.min(parseInt(limit) || 50, 200),
            })
            socket.send(JSON.stringify({
              type: 'notification:offline',
              data: { list: notifications },
            }))
            break
          }

          default:
            break
        }
      } catch (err) {
        console.error('[WebSocket] 消息处理失败:', err instanceof Error ? err.message : String(err))
      }
    })

    socket.on('close', () => {
      if (userId) {
        unregisterWebSocketClient(userId, socket)
      }
    })

    socket.on('error', (err) => {
      console.error(`[WebSocket] 用户 ${userId} 连接错误:`, err.message)
    })
  })
}
