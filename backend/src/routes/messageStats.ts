import { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware } from '../middleware/auth'
import {
  getMessageStatsOverview,
  getMessageStatsByTime,
  getMessageStatsBySender,
  getUserMessageStats,
} from '../services/messageStats'

export default async function messageStatsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/overview', async () => {
    const stats = await getMessageStatsOverview()
    return { code: 0, data: stats }
  })

  fastify.get('/by-time', async (request: FastifyRequest<{
    Querystring: {
      startDate: string
      endDate: string
      groupBy?: 'day' | 'week' | 'month'
      type?: string
    }
  }>) => {
    const stats = await getMessageStatsByTime(request.query)
    return { code: 0, data: stats }
  })

  fastify.get('/by-sender', async (request: FastifyRequest<{
    Querystring: {
      startDate?: string
      endDate?: string
      page?: number
      pageSize?: number
    }
  }>) => {
    const stats = await getMessageStatsBySender(request.query)
    return { code: 0, data: stats }
  })

  fastify.get('/user', async (request) => {
    const stats = await getUserMessageStats(request.user.id)
    return { code: 0, data: stats }
  })
}
