import Redis from 'ioredis'
import { config } from '../config'

let redisInstance: Redis | null = null
let redisSubscriber: Redis | null = null
let isConnected = false
let isSubscriberConnected = false

function getRedisInstance(): Redis | null {
  if (!config.redis.enabled) {
    return null
  }

  if (redisInstance) {
    return redisInstance
  }

  try {
    redisInstance = new Redis(config.redis.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    })

    redisInstance.on('connect', () => {
      isConnected = true
      console.info('[Redis] 连接成功')
    })

    redisInstance.on('error', (err) => {
      isConnected = false
      console.error('[Redis] 连接错误:', err.message)
    })

    redisInstance.on('close', () => {
      isConnected = false
      console.warn('[Redis] 连接已关闭')
    })

    redisInstance.connect().catch((err) => {
      isConnected = false
      console.error('[Redis] 初始连接失败:', err.message)
    })

    return redisInstance
  } catch (err) {
    isConnected = false
    console.error('[Redis] 创建实例失败:', err instanceof Error ? err.message : String(err))
    return null
  }
}

function getRedisSubscriber(): Redis | null {
  if (!config.redis.enabled) {
    return null
  }

  if (redisSubscriber) {
    return redisSubscriber
  }

  try {
    redisSubscriber = new Redis(config.redis.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    })

    redisSubscriber.on('connect', () => {
      isSubscriberConnected = true
      console.info('[Redis] 订阅端连接成功')
    })

    redisSubscriber.on('error', (err) => {
      isSubscriberConnected = false
      console.error('[Redis] 订阅端连接错误:', err.message)
    })

    redisSubscriber.on('close', () => {
      isSubscriberConnected = false
      console.warn('[Redis] 订阅端连接已关闭')
    })

    redisSubscriber.connect().catch((err) => {
      isSubscriberConnected = false
      console.error('[Redis] 订阅端初始连接失败:', err.message)
    })

    return redisSubscriber
  } catch (err) {
    isSubscriberConnected = false
    console.error('[Redis] 订阅端创建实例失败:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function publish(channel: string, message: string): Promise<boolean> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return false
  }

  try {
    await redis.publish(channel, message)
    return true
  } catch (err) {
    console.error(`[Redis] publish 失败 channel=${channel}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function subscribe(
  channel: string,
  callback: (message: string, channel: string) => void
): Promise<boolean> {
  const subscriber = getRedisSubscriber()
  if (!subscriber) {
    return false
  }

  try {
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(msg, ch)
      }
    })
    await subscriber.subscribe(channel)
    console.info(`[Redis] 订阅频道成功: ${channel}`)
    return true
  } catch (err) {
    console.error(`[Redis] subscribe 失败 channel=${channel}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function unsubscribe(channel: string): Promise<boolean> {
  const subscriber = getRedisSubscriber()
  if (!subscriber || !isSubscriberConnected) {
    return false
  }

  try {
    await subscriber.unsubscribe(channel)
    console.info(`[Redis] 取消订阅频道: ${channel}`)
    return true
  } catch (err) {
    console.error(`[Redis] unsubscribe 失败 channel=${channel}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function sadd(key: string, ...members: string[]): Promise<boolean> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return false
  }

  try {
    await redis.sadd(key, ...members)
    return true
  } catch (err) {
    console.error(`[Redis] sadd 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function srem(key: string, ...members: string[]): Promise<boolean> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return false
  }

  try {
    await redis.srem(key, ...members)
    return true
  } catch (err) {
    console.error(`[Redis] srem 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function sismember(key: string, member: string): Promise<boolean | null> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return null
  }

  try {
    const result = await redis.sismember(key, member)
    return result === 1
  } catch (err) {
    console.error(`[Redis] sismember 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function scard(key: string): Promise<number | null> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return null
  }

  try {
    return await redis.scard(key)
  } catch (err) {
    console.error(`[Redis] scard 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function smembers(key: string): Promise<string[] | null> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return null
  }

  try {
    return await redis.smembers(key)
  } catch (err) {
    console.error(`[Redis] smembers 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function get(key: string): Promise<string | null> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return null
  }

  try {
    return await redis.get(key)
  } catch (err) {
    console.error(`[Redis] get 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function set(key: string, value: string, ttl?: number): Promise<boolean> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return false
  }

  try {
    const ttlSeconds = ttl ?? config.redis.cacheTtl
    await redis.set(key, value, 'EX', ttlSeconds)
    return true
  } catch (err) {
    console.error(`[Redis] set 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function del(key: string): Promise<boolean> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return false
  }

  try {
    await redis.del(key)
    return true
  } catch (err) {
    console.error(`[Redis] del 失败 key=${key}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function delPattern(pattern: string): Promise<boolean> {
  const redis = getRedisInstance()
  if (!redis || !isConnected) {
    return false
  }

  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return true
  } catch (err) {
    console.error(`[Redis] delPattern 失败 pattern=${pattern}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

export function isRedisAvailable(): boolean {
  return config.redis.enabled && isConnected
}

export default getRedisInstance()
