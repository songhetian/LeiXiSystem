const isProduction = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET

if (isProduction && !jwtSecret) {
  throw new Error('生产环境必须配置 JWT_SECRET')
}

const corsOrigin = process.env.CORS_ORIGIN

if (isProduction && (!corsOrigin || corsOrigin === '*')) {
  throw new Error('生产环境必须配置明确的 CORS_ORIGIN，不能使用 *')
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '2h'

function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/)
  if (!match) {
    return 7200
  }
  const value = parseInt(match[1], 10)
  const unit = match[2]
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return 7200
  }
}

export const config = {
  isProduction,
  appVersion: process.env.APP_VERSION || '1.0.0',
  port: parseInt(process.env.PORT || '3001', 10),
  jwt: {
    secret: jwtSecret || 'dev-only-leixi-hr-system-secret-key',
    expiresIn: jwtExpiresIn,
    expiresInSeconds: parseDurationToSeconds(jwtExpiresIn),
  },
  cookie: {
    name: 'token',
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
  },
  cors: {
    origin: corsOrigin || true,
  },
  security: {
    bodyLimit: parseInt(process.env.BODY_LIMIT || `${2 * 1024 * 1024}`, 10),
    uploadFileSize: parseInt(process.env.UPLOAD_FILE_SIZE || `${10 * 1024 * 1024}`, 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
    rateLimitTimeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
    ssoAllowedHosts: (process.env.SSO_ALLOWED_HOSTS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    allowPrivateSsoHosts: process.env.ALLOW_PRIVATE_SSO_HOSTS === 'true',
    loginMaxFailures: parseInt(process.env.LOGIN_MAX_FAILURES || '5', 10),
    loginLockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES || '15', 10),
  },
  pagination: {
    defaultPageSize: 10,
    maxPageSize: 100,
  },
  redis: {
    url: process.env.REDIS_URL || '',
    enabled: !!process.env.REDIS_URL,
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL || '1800', 10),
  },
}
