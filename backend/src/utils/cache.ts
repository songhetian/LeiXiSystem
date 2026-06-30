import * as redis from './redis'
import {
  CACHE_TTL, CACHE_PREFIX } from '../types/cache'

const lockMap = new Map<string, Promise<any>>()

function jitter(baseTtl: number, jitterFactor = 0.1): number {
  const jitter = baseTtl * jitterFactor
  return Math.round(baseTtl + (Math.random() - 0.5) * 2 * jitter)
}

export async function getJSON<T = any>(key: string): Promise<T | null> {
  const value = await redis.get(key)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function setJSON(key: string, value: any, ttl?: number): Promise<boolean> {
  const serialized = JSON.stringify(value)
  const finalTtl = ttl !== undefined ? jitter(ttl) : undefined
  return redis.set(key, serialized, finalTtl)
}

export async function getOrSet<T = any>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  options?: { lockTimeout?: number }
): Promise<T> {
  const cached = await getJSON<T>(key)
  if (cached !== null) {
    return cached
  }

  const lockKey = `lock:${key}`
  const lockTimeout = options?.lockTimeout ?? 5000

  if (lockMap.has(key)) {
    await lockMap.get(key)
    const cached2 = await getJSON<T>(key)
    if (cached2 !== null) return cached2
  }

  let resolveLock: (value: any) => void
  const lockPromise = new Promise(resolve => {
    resolveLock = resolve
  })
  lockMap.set(key, lockPromise)

  try {
    const result = await fetcher()
    await setJSON(key, result, ttl)
    return result
  } finally {
    lockMap.delete(key)
    resolveLock!(undefined)
  }
}

export async function invalidate(key: string): Promise<boolean> {
  return redis.del(key)
}

export async function invalidatePattern(pattern: string): Promise<boolean> {
  return redis.delPattern(pattern)
}

export function isAvailable(): boolean {
  return redis.isRedisAvailable()
}

export { jitter, CACHE_TTL, CACHE_PREFIX }
