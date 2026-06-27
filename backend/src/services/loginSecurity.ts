import { HttpError } from '../utils/validation'

type LoginAttempt = {
  failures: number
  lockedUntil?: number
  lastFailureAt: number
}

const attempts = new Map<string, LoginAttempt>()

const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

function cleanupExpiredAttempts(now = Date.now()) {
  for (const [key, attempt] of attempts) {
    const lockActive = attempt.lockedUntil && attempt.lockedUntil > now
    const windowActive = now - attempt.lastFailureAt <= WINDOW_MS
    if (!lockActive && !windowActive) {
      attempts.delete(key)
    }
  }
}

function getAttempt(key: string) {
  cleanupExpiredAttempts()
  return attempts.get(key)
}

export function buildLoginAttemptKeys(username: string, ip: string) {
  const normalizedUsername = username.trim().toLowerCase()
  return [`user:${normalizedUsername}`, `ip:${ip}`, `user-ip:${normalizedUsername}:${ip}`]
}

export function assertLoginAllowed(keys: string[]) {
  const now = Date.now()
  for (const key of keys) {
    const attempt = getAttempt(key)
    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      throw new HttpError(429, '登录失败次数过多，请稍后再试')
    }
  }
}

export function recordLoginFailure(keys: string[]) {
  const now = Date.now()
  for (const key of keys) {
    const current = getAttempt(key)
    const failures = current && now - current.lastFailureAt <= WINDOW_MS
      ? current.failures + 1
      : 1

    attempts.set(key, {
      failures,
      lastFailureAt: now,
      lockedUntil: failures >= MAX_FAILURES ? now + LOCK_MS : current?.lockedUntil,
    })
  }
}

export function clearLoginFailures(keys: string[]) {
  for (const key of keys) {
    attempts.delete(key)
  }
}
