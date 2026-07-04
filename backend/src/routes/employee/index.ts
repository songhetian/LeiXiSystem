import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import employeesRoutes from './employees'
import certificatesRoutes from './certificates'
import employeeChangeRoutes from './employee-change'

export default async function employeeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)
  await fastify.register(employeesRoutes)
  await fastify.register(certificatesRoutes)
  await fastify.register(employeeChangeRoutes)
}
