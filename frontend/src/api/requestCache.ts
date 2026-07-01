import type { AxiosRequestConfig } from 'axios'

interface CacheEntry {
  data: unknown
  timestamp: number
  expireTime: number
}

const cache = new Map<string, CacheEntry>()

const DEFAULT_CACHE_TIME = 5 * 60 * 1000

function generateCacheKey(config: AxiosRequestConfig): string {
  const { method, url, params } = config
  return [method, url, JSON.stringify(params)].join('&')
}

export function getCache(config: AxiosRequestConfig): unknown | null {
  const key = generateCacheKey(config)
  const entry = cache.get(key)

  if (!entry) return null

  if (Date.now() > entry.expireTime) {
    cache.delete(key)
    return null
  }

  return entry.data
}

export function setCache(config: AxiosRequestConfig, data: unknown, cacheTime?: number): void {
  const key = generateCacheKey(config)
  cache.set(key, {
    data,
    timestamp: Date.now(),
    expireTime: Date.now() + (cacheTime ?? DEFAULT_CACHE_TIME),
  })
}

export function clearCache(): void {
  cache.clear()
}

export function removeCacheByUrl(url: string): void {
  cache.forEach((_, key) => {
    if (key.includes(url)) {
      cache.delete(key)
    }
  })
}

export default {
  getCache,
  setCache,
  clearCache,
  removeCacheByUrl,
}
