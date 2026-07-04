import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import eventsRoutes from './events'
import onboardingTasksRoutes from './onboarding-tasks'
import onboardingFlowRoutes from './onboarding-flows'
import offboardingTasksRoutes from './offboarding-tasks'
import documentsRoutes from './documents'
import contractsRoutes from './contracts'
import emergencyContactsRoutes from './emergency-contacts'

export default async function lifecycleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)
  await fastify.register(eventsRoutes)
  await fastify.register(onboardingTasksRoutes)
  await fastify.register(onboardingFlowRoutes)
  await fastify.register(offboardingTasksRoutes)
  await fastify.register(documentsRoutes)
  await fastify.register(contractsRoutes)
  await fastify.register(emergencyContactsRoutes)
}
