import { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware } from '../middleware/auth'
import { getUserPreferences, updateUserPreferences } from '../services/messagePreference'

export default async function messagePreferenceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/', async (request) => {
    const prefs = await getUserPreferences(request.user.id)
    return { code: 0, data: prefs }
  })

  fastify.put('/', async (request: FastifyRequest<{
    Body: {
      mutedTypes?: string[]
      doNotDisturbStart?: string
      doNotDisturbEnd?: string
      enableSound?: boolean
      enableDesktop?: boolean
    }
  }>) => {
    const prefs = await updateUserPreferences(request.user.id, request.body)
    return { code: 0, data: prefs, message: '更新成功' }
  })
}
