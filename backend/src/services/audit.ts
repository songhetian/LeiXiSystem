import { FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import prisma from '../prisma'

type AuditInput = {
  action: string
  module: string
  status?: 'success' | 'failed'
  requestData?: unknown
  responseData?: unknown
  requestId?: string
  beforeData?: unknown
  afterData?: unknown
}

const SENSITIVE_KEY_PATTERN = /password|passwd|pwd|token|secret|authorization|cookie|salary|amount|idCard|identity|phone|mobile|email|bank|card|credential|private|key/i
const MAX_AUDIT_DEPTH = 6
const MAX_ARRAY_LENGTH = 50
const MAX_STRING_LENGTH = 1000
const MAX_JSON_LENGTH = 20000

function maskStringValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return value

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const [name, domain] = trimmed.split('@')
    const maskedName = name.length > 0 ? `${name.charAt(0)}***` : '***'
    return `${maskedName}@${domain}`
  }

  if (/^1[3-9]\d{9}$/.test(trimmed)) {
    return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`
  }

  if (/^\d{15}$|^\d{17}[\dXx]$/.test(trimmed)) {
    return `${trimmed.slice(0, 3)}***********${trimmed.slice(-4)}`
  }

  if (/^\d{12,19}$/.test(trimmed)) {
    return `**** **** **** ${trimmed.slice(-4)}`
  }

  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]` : value
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key)
}

function maskSensitive(value: unknown, depth = 0): unknown {
  if (depth > MAX_AUDIT_DEPTH) return '[MAX_DEPTH_EXCEEDED]'
  if (typeof value === 'string') return maskStringValue(value)
  if (!value || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_LENGTH).map((item) => maskSensitive(item, depth + 1))
    if (value.length > MAX_ARRAY_LENGTH) {
      items.push(`[${value.length - MAX_ARRAY_LENGTH} ITEMS_TRUNCATED]`)
    }
    return items
  }

  const masked: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      masked[key] = maskSensitiveValueByKey(key, item)
    } else if (item && typeof item === 'object') {
      masked[key] = maskSensitive(item, depth + 1)
    } else {
      masked[key] = maskSensitive(item, depth + 1)
    }
  }
  return masked
}

function maskSensitiveValueByKey(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase()

  if (lowerKey.includes('password') || lowerKey.includes('passwd') || lowerKey.includes('pwd') ||
      lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('authorization')) {
    return '***'
  }

  if (lowerKey.includes('salary') || lowerKey.includes('amount')) {
    return '***'
  }

  if (lowerKey.includes('idcard') || lowerKey.includes('identity')) {
    if (typeof value === 'string') {
      return maskStringValue(value)
    }
    return '***'
  }

  if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
    if (typeof value === 'string') {
      return maskStringValue(value)
    }
    return '***'
  }

  if (lowerKey.includes('email')) {
    if (typeof value === 'string') {
      return maskStringValue(value)
    }
    return '***'
  }

  if (lowerKey.includes('bank') || lowerKey.includes('card')) {
    if (typeof value === 'string') {
      return maskStringValue(value)
    }
    return '***'
  }

  return '***'
}

function toSafeJson(value: unknown): unknown {
  const masked = maskSensitive(value)
  const json = JSON.stringify(masked)
  if (json.length <= MAX_JSON_LENGTH) return masked
  return {
    truncated: true,
    preview: json.slice(0, MAX_JSON_LENGTH),
  }
}

export async function writeAuditLog(request: FastifyRequest, input: AuditInput): Promise<void> {
  try {
    const data: Prisma.SystemLogCreateInput = {
      action: input.action,
      module: input.module,
      status: input.status || 'success',
      requestId: input.requestId || request.id,
      userId: request.user?.id,
      username: request.user?.username,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    }

    if (input.requestData !== undefined) {
      data.requestData = toSafeJson(input.requestData) as Prisma.InputJsonValue
    }
    if (input.responseData !== undefined) {
      data.responseData = toSafeJson(input.responseData) as Prisma.InputJsonValue
    }
    if (input.beforeData !== undefined) {
      data.beforeData = toSafeJson(input.beforeData) as Prisma.InputJsonValue
    }
    if (input.afterData !== undefined) {
      data.afterData = toSafeJson(input.afterData) as Prisma.InputJsonValue
    }

    await prisma.systemLog.create({ data })
  } catch (error) {
    request.log.warn({ error }, '写入审计日志失败')
  }
}

type LogOperationInput = {
  action: string
  module: string
  beforeData?: unknown
  afterData?: unknown
  requestData?: unknown
  responseData?: unknown
  status?: 'success' | 'failed'
}

export async function logOperation(
  request: FastifyRequest,
  input: LogOperationInput,
): Promise<void> {
  await writeAuditLog(request, {
    action: input.action,
    module: input.module,
    status: input.status,
    requestData: input.requestData,
    responseData: input.responseData,
    beforeData: input.beforeData,
    afterData: input.afterData,
    requestId: request.id,
  })
}
