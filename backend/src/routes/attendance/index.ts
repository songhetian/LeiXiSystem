import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import recordsRoutes from './records'
import checkinsRoutes from './checkins'
import clockInRoutes from './clock-in'
import correctionsRoutes from './corrections'
import monthlyRoutes from './monthly'
import exceptionsRoutes from './exceptions'
import exceptionRulesRoutes from './exception-rules'
import deductionRulesRoutes from './deduction-rules'
import locationRoutes from './locations'
import overtimeRoutes from './overtime'
import overtimeTypesRoutes from './overtime-types'
import leaveRoutes from './leave'

export default async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)
  await fastify.register(recordsRoutes)
  await fastify.register(checkinsRoutes)
  await fastify.register(clockInRoutes)
  await fastify.register(correctionsRoutes)
  await fastify.register(monthlyRoutes)
  await fastify.register(exceptionsRoutes)
  await fastify.register(exceptionRulesRoutes)
  await fastify.register(deductionRulesRoutes)
  await fastify.register(locationRoutes)
  await fastify.register(overtimeRoutes)
  await fastify.register(overtimeTypesRoutes)
  await fastify.register(leaveRoutes)
}