import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import componentsRoutes from './components'
import structuresRoutes from './structures'
import assignmentsRoutes from './assignments'
import runsRoutes from './runs'
import payslipsRoutes from './payslips'
import adjustmentsRoutes from './adjustments'
import disputesRoutes from './disputes'
import myPayslipsRoutes from './my-payslips'

export default async function payrollRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)
  await fastify.register(componentsRoutes)
  await fastify.register(structuresRoutes)
  await fastify.register(assignmentsRoutes)
  await fastify.register(runsRoutes)
  await fastify.register(payslipsRoutes)
  await fastify.register(adjustmentsRoutes)
  await fastify.register(disputesRoutes)
  await fastify.register(myPayslipsRoutes)
}
