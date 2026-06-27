import { FastifyInstance } from 'fastify'
import prisma from '../prisma'
import { config } from '../config'

function baseHealthData() {
  return {
    service: 'LeiXi HR System Backend',
    version: config.appVersion,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }
}

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request) => {
    return {
      code: 0,
      message: 'OK',
      requestId: request.id,
      data: {
        ...baseHealthData(),
        status: 'running',
      },
    }
  })

  fastify.get('/ready', async (request, reply) => {
    const startedAt = Date.now()

    try {
      await prisma.$queryRawUnsafe('SELECT 1')
      return {
        code: 0,
        message: 'READY',
        requestId: request.id,
        data: {
          ...baseHealthData(),
          status: 'ready',
          checks: {
            database: {
              status: 'ok',
              latencyMs: Date.now() - startedAt,
            },
          },
        },
      }
    } catch (error) {
      request.log.error({ error, requestId: request.id }, '就绪检查失败')
      return reply.status(503).send({
        code: 503,
        message: '服务尚未就绪',
        requestId: request.id,
        data: {
          ...baseHealthData(),
          status: 'not_ready',
          checks: {
            database: {
              status: 'failed',
              latencyMs: Date.now() - startedAt,
            },
          },
          details: config.isProduction ? undefined : String(error),
        },
      })
    }
  })
}
