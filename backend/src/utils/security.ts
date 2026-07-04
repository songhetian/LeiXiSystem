import net from 'net'
import { config } from '../config'
import { HttpError } from './validation'

const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  const [a, b] = parts
  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    a === 0
}

export function parseSafeHttpUrl(rawUrl: string, options?: {
  allowedHosts?: string[]
  allowPrivateHosts?: boolean
}) {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new HttpError(400, 'URL 格式不正确')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError(400, '仅允许 http 或 https 地址')
  }

  if (url.username || url.password) {
    throw new HttpError(400, 'URL 不能包含用户名或密码')
  }

  const hostname = url.hostname.toLowerCase()
  const allowPrivateHosts = options?.allowPrivateHosts ?? config.security.allowPrivateSsoHosts
  if (!allowPrivateHosts) {
    const isIp = net.isIP(hostname) !== 0
    if (PRIVATE_HOSTS.has(hostname) || (isIp && isPrivateIPv4(hostname))) {
      throw new HttpError(400, '不允许配置内网或本机地址')
    }
  }

  const allowedHosts = options?.allowedHosts ?? config.security.ssoAllowedHosts
  if (allowedHosts.length && !allowedHosts.includes(hostname)) {
    throw new HttpError(400, '应用地址不在允许的域名白名单内')
  }

  return url.toString()
}

export function sanitizeSpreadsheetCell(value: unknown) {
  if (typeof value !== 'string') return value
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

export function assertSpreadsheetFile(input: {
  filename?: string
  mimetype?: string
  size?: number
}) {
  const filename = input.filename || ''
  const lowerName = filename.toLowerCase()
  const allowedExt = ['.xlsx', '.xls', '.csv']
  if (!allowedExt.some((ext) => lowerName.endsWith(ext))) {
    throw new HttpError(400, '仅支持 .xlsx、.xls 或 .csv 文件')
  }

  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream',
  ]
  if (input.mimetype && !allowedMimeTypes.includes(input.mimetype)) {
    throw new HttpError(400, '文件类型不合法')
  }

  if (input.size && input.size > config.security.uploadFileSize) {
    throw new HttpError(400, '文件大小超过限制')
  }
}
