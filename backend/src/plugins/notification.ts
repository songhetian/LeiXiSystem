import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { sendAndPushBatchNotifications, SendNotificationInput } from '../services/websocket'

declare module 'fastify' {
  interface FastifyRequest {
    notificationQueue?: SendNotificationInput[]
  }
}

async function notificationPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    request.notificationQueue = []
  })

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const queue = request.notificationQueue
    if (!queue || queue.length === 0) return

    sendAndPushBatchNotifications(queue).catch((err) => {
      request.log.error({ err, count: queue.length }, '通知发送失败')
    })
  })
}

export default fp(notificationPlugin, {
  name: 'notification',
  fastify: '5.x',
})

export function enqueueNotification(request: FastifyRequest, notification: SendNotificationInput) {
  if (!request.notificationQueue) {
    request.notificationQueue = []
  }
  request.notificationQueue.push(notification)
}

export function enqueueNotifications(request: FastifyRequest, notifications: SendNotificationInput[]) {
  if (!request.notificationQueue) {
    request.notificationQueue = []
  }
  request.notificationQueue.push(...notifications)
}
