import fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { config } from './config'
import { HttpError } from './utils/validation'
import authRoutes from './routes/auth'
import personnelRoutes from './routes/personnel'
import organizationRoutes from './routes/organization'
import attendanceRoutes from './routes/attendance'
import vacationRoutes from './routes/vacation'
import reimbursementRoutes from './routes/reimbursement'
import adjustmentRoutes from './routes/adjustment'
import approvalRoutes from './routes/approval'
import shiftRoutes from './routes/shift'
import scheduleRoutes from './routes/schedule'
import rbacRoutes from './routes/rbac'
import notificationRoutes from './routes/notification'
import dashboardRoutes from './routes/dashboard'
import payslipRoutes from './routes/payslip'
import payrollRoutes from './routes/payroll'
import securityRoutes from './routes/security'
import ssoRoutes from './routes/sso'
import dataRoutes from './routes/data'
import lifecycleRoutes from './routes/lifecycle'
import assetRoutes from './routes/asset'
import helpdeskRoutes from './routes/helpdesk'
import recruitmentRoutes from './routes/recruitment'
import performanceRoutes from './routes/performance'
import trainingRoutes from './routes/training'
import healthRoutes from './routes/health'
import prisma from './prisma'

const app = fastify({
  logger: true,
  bodyLimit: config.security.bodyLimit,
})

let isShuttingDown = false

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return
  isShuttingDown = true

  app.log.info({ signal }, '收到关闭信号，开始优雅关闭')

  try {
    await app.close()
    app.log.info('服务已优雅关闭')
    process.exit(0)
  } catch (error) {
    app.log.error({ error }, '服务关闭失败')
    process.exit(1)
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

function buildErrorResponse(input: {
  statusCode: number
  message: string
  requestId?: string
  details?: unknown
}) {
  return {
    code: input.statusCode,
    message: input.message,
    requestId: input.requestId,
    ...(input.details !== undefined ? { details: input.details } : {}),
  }
}

async function start() {
  try {
    await app.register(cors, {
      origin: config.cors.origin,
      credentials: true,
    })

    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
    })

    await app.register(rateLimit, {
      max: config.security.rateLimitMax,
      timeWindow: config.security.rateLimitTimeWindow,
      errorResponseBuilder: () => ({
        code: 429,
        message: '请求过于频繁，请稍后再试',
      }),
    })

    app.addHook('onRequest', async (request, reply) => {
      reply.header('X-Request-Id', request.id)
    })

    await app.register(jwt, {
      secret: config.jwt.secret,
    })

    await app.register(multipart, {
      limits: {
        fileSize: config.security.uploadFileSize,
      },
    })

    app.addHook('onClose', async () => {
      await prisma.$disconnect()
    })

    app.setErrorHandler((error, request, reply) => {
      const requestId = request.id

      if (error instanceof HttpError) {
        request.log.warn({ error, requestId }, '请求参数或业务校验失败')
        return reply.status(error.statusCode).send({
          ...buildErrorResponse({
            statusCode: error.statusCode,
            message: error.message,
            requestId,
            details: error.details,
          }),
        })
      }

      if (error instanceof ZodError) {
        request.log.warn({ error, requestId }, '请求参数 Zod 校验失败')
        return reply.status(400).send(buildErrorResponse({
          statusCode: 400,
          message: '请求参数不合法',
          requestId,
          details: error.flatten(),
        }))
      }

      const err = error as Error & { statusCode?: number; code?: string; meta?: unknown }
      if (err.code === 'P2002') {
        return reply.status(409).send(buildErrorResponse({
          statusCode: 409,
          message: '数据已存在，请检查唯一字段',
          requestId,
        }))
      }
      if (err.code === 'P2025') {
        return reply.status(404).send(buildErrorResponse({
          statusCode: 404,
          message: '数据不存在或已被删除',
          requestId,
        }))
      }
      if (err.code === 'P2003') {
        return reply.status(400).send(buildErrorResponse({
          statusCode: 400,
          message: '关联数据不存在或仍被引用，无法完成操作',
          requestId,
        }))
      }
      if (err.code === 'P2000') {
        return reply.status(400).send(buildErrorResponse({
          statusCode: 400,
          message: '字段内容超过长度限制',
          requestId,
        }))
      }
      if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE' || err.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send(buildErrorResponse({
          statusCode: 413,
          message: '请求体或上传文件超过大小限制',
          requestId,
        }))
      }

      const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500

      if (statusCode >= 500) {
        request.log.error({ error, requestId }, '请求处理失败')
      } else {
        request.log.warn({ error, requestId }, '请求处理失败')
      }

      return reply.status(statusCode).send({
        ...buildErrorResponse({
          statusCode,
          message: statusCode === 500 ? '服务器内部错误' : err.message,
          requestId,
          details: !config.isProduction && statusCode === 500 ? { name: err.name, code: err.code } : undefined,
        }),
      })
    })

    app.setNotFoundHandler((request, reply) => {
      return reply.status(404).send(buildErrorResponse({
        statusCode: 404,
        message: '接口不存在',
        requestId: request.id,
      }))
    })

    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(personnelRoutes, { prefix: '/api/personnel' })
    app.register(organizationRoutes, { prefix: '/api/organization' })
    app.register(attendanceRoutes, { prefix: '/api/attendance' })
    app.register(vacationRoutes, { prefix: '/api/vacation' })
    app.register(reimbursementRoutes, { prefix: '/api/reimbursement' })
    app.register(adjustmentRoutes, { prefix: '/api/adjustment' })
    app.register(approvalRoutes, { prefix: '/api/approval' })
    app.register(shiftRoutes, { prefix: '/api/shift' })
    app.register(scheduleRoutes, { prefix: '/api/schedule' })
    app.register(rbacRoutes, { prefix: '/api/rbac' })
    app.register(notificationRoutes, { prefix: '/api/notification' })
    app.register(dashboardRoutes, { prefix: '/api/dashboard' })
    app.register(payslipRoutes, { prefix: '/api/payslip' })
    app.register(payrollRoutes, { prefix: '/api/payroll' })
    app.register(securityRoutes, { prefix: '/api/security' })
    app.register(ssoRoutes, { prefix: '/api/sso' })
    app.register(dataRoutes, { prefix: '/api/data' })
    app.register(lifecycleRoutes, { prefix: '/api/lifecycle' })
    app.register(assetRoutes, { prefix: '/api/asset' })
    app.register(helpdeskRoutes, { prefix: '/api/helpdesk' })
    app.register(recruitmentRoutes, { prefix: '/api/recruitment' })
    app.register(performanceRoutes, { prefix: '/api/performance' })
    app.register(trainingRoutes, { prefix: '/api/training' })
    app.register(healthRoutes, { prefix: '/api' })

    await app.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`🚀 Server running on http://localhost:${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
