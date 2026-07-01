import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { writeAuditLog } from '../services/audit'

declare module 'fastify' {
  interface FastifyRequest {
    auditContext?: AuditContext
  }
}

export interface AuditContext {
  action: string
  module: string
  beforeData?: unknown
  requestData?: unknown
  afterData?: unknown
}

async function auditPlugin(fastify: FastifyInstance) {
  // preHandler: 每个路由设置 auditContext 后重置
  fastify.addHook('preHandler', async (request) => {
    // 重置上下文（每个请求独立）
    request.auditContext = undefined
  })

  // onResponse: 响应发送后自动写审计日志
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.auditContext
    if (!ctx) return

    // 如果 beforeData 或 afterData 未设置，清理空值
    const cleanCtx: AuditContext = {
      action: ctx.action,
      module: ctx.module,
      beforeData: ctx.beforeData ?? undefined,
      requestData: ctx.requestData ?? undefined,
      afterData: ctx.afterData ?? undefined,
    }

    // 异步写审计日志，不阻塞响应
    writeAuditLog(request, cleanCtx).catch((err) => {
      request.log.error({ err, auditCtx: ctx }, '审计日志写入失败')
    })
  })
}

export default fp(auditPlugin, {
  name: 'audit',
  fastify: '5.x',
})

/**
 * 在 handler 开头调用，设置审计上下文
 */
export function setAudit(
  request: FastifyRequest,
  opts: { action: string; module: string; requestData?: unknown; beforeData?: unknown }
) {
  request.auditContext = opts
}

/**
 * 在数据变更前调用，捕获变更前的快照
 */
export function captureBefore<T>(request: FastifyRequest, data: T): T {
  if (request.auditContext) {
    request.auditContext.beforeData = data
  }
  return data
}

/**
 * 在数据变更后调用，捕获变更后的快照
 */
export function setAfter<T>(request: FastifyRequest, data: T): T {
  if (request.auditContext) {
    request.auditContext.afterData = data
  }
  return data
}
