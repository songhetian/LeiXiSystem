import { FastifyRequest } from 'fastify'
import prisma from '../prisma'

type AuditInput = {
  action: string
  module: string
  status?: 'success' | 'failed'
  requestData?: unknown
  responseData?: unknown
}

const SENSITIVE_KEY_PATTERN = /password|passwd|pwd|token|secret|authorization|cookie|salary|amount|idCard|identity|phone|mobile|email|bank|card|credential|private|key/i
const MAX_AUDIT_DEPTH = 6
const MAX_ARRAY_LENGTH = 50
const MAX_STRING_LENGTH = 1000
const MAX_JSON_LENGTH = 20000

function maskStringValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return value

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const [name, domain] = trimmed.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }

  if (/^1[3-9]\d{9}$/.test(trimmed)) {
    return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`
  }

  if (/^\d{15}$|^\d{17}[\dXx]$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}**********${trimmed.slice(-4)}`
  }

  if (/^\d{12,19}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}********${trimmed.slice(-4)}`
  }

  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]` : value
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
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      masked[key] = '[MASKED]'
    } else if (item && typeof item === 'object') {
      masked[key] = maskSensitive(item, depth + 1)
    } else {
      masked[key] = maskSensitive(item, depth + 1)
    }
  }
  return masked
}

function toSafeJson(value: unknown) {
  const masked = maskSensitive(value)
  const json = JSON.stringify(masked)
  if (json.length <= MAX_JSON_LENGTH) return masked
  return {
    truncated: true,
    preview: json.slice(0, MAX_JSON_LENGTH),
  }
}

export async function writeAuditLog(request: FastifyRequest, input: AuditInput) {
  try {
    await prisma.systemLog.create({
      data: {
        userId: request.user?.id,
        username: request.user?.username,
        action: input.action,
        module: input.module,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestData: input.requestData ? toSafeJson(input.requestData) as any : undefined,
        responseData: input.responseData ? toSafeJson(input.responseData) as any : undefined,
        status: input.status || 'success',
      },
    })
  } catch (error) {
    request.log.warn({ error }, '写入审计日志失败')
  }
}
