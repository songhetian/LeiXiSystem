import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosRequestConfig } from 'axios'

// ============================================================
// Part 1: requestCache 单元测试
// ============================================================
import {
  getCache,
  setCache,
  clearCache,
  removeCacheByUrl,
} from '../requestCache'

describe('requestCache', () => {
  beforeEach(() => {
    clearCache()
  })

  function makeConfig(overrides: Partial<AxiosRequestConfig> = {}): AxiosRequestConfig {
    return {
      method: 'get',
      url: '/test',
      params: undefined,
      ...overrides,
    }
  }

  it('setCache 后 getCache 应该返回缓存数据', () => {
    const config = makeConfig()
    const data = { id: 1, name: 'test' }

    setCache(config, data)

    const cached = getCache(config)
    expect(cached).toEqual(data)
  })

  it('未命中缓存时应该返回 null', () => {
    const config = makeConfig({ url: '/nonexistent' })
    expect(getCache(config)).toBeNull()
  })

  it('不同 url 应该有不同的缓存键', () => {
    const config1 = makeConfig({ url: '/a' })
    const config2 = makeConfig({ url: '/b' })

    setCache(config1, 'data-a')
    setCache(config2, 'data-b')

    expect(getCache(config1)).toBe('data-a')
    expect(getCache(config2)).toBe('data-b')
  })

  it('不同 params 应该有不同的缓存键', () => {
    const config1 = makeConfig({ params: { page: 1 } })
    const config2 = makeConfig({ params: { page: 2 } })

    setCache(config1, 'page1')
    setCache(config2, 'page2')

    expect(getCache(config1)).toBe('page1')
    expect(getCache(config2)).toBe('page2')
  })

  it('缓存过期后应该返回 null', () => {
    const config = makeConfig()
    // 设置 1ms 缓存
    setCache(config, 'temp', 1)

    // 手动推进时间
    vi.useFakeTimers()
    vi.advanceTimersByTime(10)

    expect(getCache(config)).toBeNull()

    vi.useRealTimers()
  })

  it('自定义 cacheTime 应该生效', () => {
    const config = makeConfig()
    vi.useFakeTimers()

    setCache(config, 'data', 5000)

    vi.advanceTimersByTime(4999)
    expect(getCache(config)).toBe('data')

    vi.advanceTimersByTime(2)
    expect(getCache(config)).toBeNull()

    vi.useRealTimers()
  })

  it('clearCache 应该清空所有缓存', () => {
    setCache(makeConfig({ url: '/a' }), 'a')
    setCache(makeConfig({ url: '/b' }), 'b')

    clearCache()

    expect(getCache(makeConfig({ url: '/a' }))).toBeNull()
    expect(getCache(makeConfig({ url: '/b' }))).toBeNull()
  })

  it('removeCacheByUrl 应该删除匹配的缓存', () => {
    setCache(makeConfig({ url: '/users' }), 'users')
    setCache(makeConfig({ url: '/orders' }), 'orders')

    removeCacheByUrl('/users')

    expect(getCache(makeConfig({ url: '/users' }))).toBeNull()
    expect(getCache(makeConfig({ url: '/orders' }))).toBe('orders')
  })
})

// ============================================================
// Part 2: requestCancel 单元测试
// ============================================================
import {
  addPendingRequest,
  removePendingRequest,
  clearAllPendingRequests,
} from '../requestCancel'

describe('requestCancel', () => {
  beforeEach(() => {
    clearAllPendingRequests()
  })

  it('addPendingRequest 应该设置 signal', () => {
    const config: AxiosRequestConfig = {
      method: 'get',
      url: '/test',
    }

    addPendingRequest(config)

    expect(config.signal).toBeDefined()
    expect(config.signal).toBeInstanceOf(AbortSignal)
  })

  it('重复添加相同请求应该 abort 之前的', () => {
    const config: AxiosRequestConfig = {
      method: 'get',
      url: '/test',
    }

    addPendingRequest(config)
    const firstSignal = config.signal!

    addPendingRequest(config)
    const secondSignal = config.signal!

    // 第一个 signal 应该被 abort
    expect(firstSignal.aborted).toBe(true)
    // 第二个 signal 应该有效
    expect(secondSignal.aborted).toBe(false)
    expect(secondSignal).not.toBe(firstSignal)
  })

  it('不同请求应该有不同的 signal', () => {
    const config1: AxiosRequestConfig = { method: 'get', url: '/a' }
    const config2: AxiosRequestConfig = { method: 'get', url: '/b' }

    addPendingRequest(config1)
    addPendingRequest(config2)

    expect(config1.signal).not.toBe(config2.signal)
    expect(config1.signal!.aborted).toBe(false)
    expect(config2.signal!.aborted).toBe(false)
  })

  it('removePendingRequest 后再次 add 不应该 abort', () => {
    const config: AxiosRequestConfig = { method: 'get', url: '/test' }

    addPendingRequest(config)
    const firstSignal = config.signal!

    removePendingRequest(config)

    addPendingRequest(config)
    // 第一次的 signal 不应该被 abort（因为已经被移除了）
    expect(firstSignal.aborted).toBe(false)
  })

  it('clearAllPendingRequests 应该 abort 所有请求', () => {
    const config1: AxiosRequestConfig = { method: 'get', url: '/a' }
    const config2: AxiosRequestConfig = { method: 'post', url: '/b' }

    addPendingRequest(config1)
    addPendingRequest(config2)

    const signal1 = config1.signal!
    const signal2 = config2.signal!

    clearAllPendingRequests()

    expect(signal1.aborted).toBe(true)
    expect(signal2.aborted).toBe(true)
  })
})

// ============================================================
// Part 3: requestRetry 单元测试
// ============================================================
import { requestWithRetry } from '../requestRetry'

// Mock logger for retry tests
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('requestWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('成功时应该直接返回结果', async () => {
    const requestFn = vi.fn().mockResolvedValue({ data: 'ok' })

    const resultPromise = requestWithRetry(requestFn, {
      retryConfig: { retries: 3, retryDelay: 100 },
    })

    const result = await resultPromise

    expect(result).toEqual({ data: 'ok' })
    expect(requestFn).toHaveBeenCalledTimes(1)
  })

  it('失败后应该重试指定次数', async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValue({ data: 'ok' })

    const resultPromise = requestWithRetry(requestFn, {
      retryConfig: { retries: 3, retryDelay: 100 },
    })

    // 推进延迟计时器
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)

    const result = await resultPromise
    expect(result).toEqual({ data: 'ok' })
    expect(requestFn).toHaveBeenCalledTimes(3)
  })

  it('超过最大重试次数应该抛出错误', async () => {
    // 使用真实计时器避免 fake timer 与 delay() 的协调问题
    vi.useRealTimers()
    const error = { response: { status: 500 } }
    const requestFn = vi.fn().mockRejectedValue(error)

    await expect(
      requestWithRetry(requestFn, {
        retryConfig: { retries: 2, retryDelay: 1 },
      }),
    ).rejects.toEqual(error)

    expect(requestFn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries

    // 恢复 fake timers 给后续测试
    vi.useFakeTimers()
  })

  it('不满足 retryCondition 时不应该重试', async () => {
    const error = { response: { status: 400 } }
    const requestFn = vi.fn().mockRejectedValue(error)

    const resultPromise = requestWithRetry(requestFn, {
      retryConfig: {
        retries: 3,
        retryDelay: 100,
        retryCondition: (err: any) => err.response?.status >= 500,
      },
    })

    await expect(resultPromise).rejects.toEqual(error)
    expect(requestFn).toHaveBeenCalledTimes(1)
  })

  it('默认应该对 5xx 错误重试', async () => {
    const error500 = { response: { status: 500 } }
    const requestFn = vi
      .fn()
      .mockRejectedValueOnce(error500)
      .mockResolvedValue('ok')

    const resultPromise = requestWithRetry(requestFn, {
      retryConfig: { retries: 1, retryDelay: 50 },
    })

    await vi.advanceTimersByTimeAsync(50)

    const result = await resultPromise
    expect(result).toBe('ok')
    expect(requestFn).toHaveBeenCalledTimes(2)
  })

  it('默认应该对无 response 的网络错误重试', async () => {
    const networkError = { response: undefined, message: 'Network Error' }
    const requestFn = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('ok')

    const resultPromise = requestWithRetry(requestFn, {
      retryConfig: { retries: 1, retryDelay: 50 },
    })

    await vi.advanceTimersByTimeAsync(50)

    const result = await resultPromise
    expect(result).toBe('ok')
  })
})

// ============================================================
// Part 4: request (get/post/put/del) 集成测试
// ============================================================

// 使用 vi.hoisted 创建共享的 mock，确保 vi.mock 工厂和测试代码都能引用
const { mockGet, mockPost, mockPut, mockDelete, mockAxiosInstance } = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()
  const mockDelete = vi.fn()

  return {
    mockGet,
    mockPost,
    mockPut,
    mockDelete,
    mockAxiosInstance: {
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  }
})

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

// Mock auth store
vi.mock('@/store/auth', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      logout: vi.fn(),
    })),
  },
}))

// 需要在 axios mock 之后导入
import { get, post, put, del } from '../request'

describe('request 工具', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('应该调用 axios.get', async () => {
      mockGet.mockResolvedValue({ success: true, data: [1, 2, 3] })

      await get('/users')

      expect(mockGet).toHaveBeenCalledWith('/users', undefined)
    })

    it('应该传递 config 参数', async () => {
      mockGet.mockResolvedValue({ success: true })
      const config = { cancelDuplicate: false }

      await get('/users', config)

      expect(mockGet).toHaveBeenCalledWith('/users', config)
    })
  })

  describe('post', () => {
    it('应该调用 axios.post 并传递 data', async () => {
      mockPost.mockResolvedValue({ success: true })
      const data = { name: 'test' }

      await post('/users', data)

      expect(mockPost).toHaveBeenCalledWith('/users', data, undefined)
    })

    it('应该传递 config', async () => {
      mockPost.mockResolvedValue({ success: true })
      const data = { name: 'test' }
      const config = { cancelDuplicate: false }

      await post('/users', data, config)

      expect(mockPost).toHaveBeenCalledWith('/users', data, config)
    })
  })

  describe('put', () => {
    it('应该调用 axios.put 并传递 data', async () => {
      mockPut.mockResolvedValue({ success: true })
      const data = { name: 'updated' }

      await put('/users/1', data)

      expect(mockPut).toHaveBeenCalledWith('/users/1', data, undefined)
    })
  })

  describe('del', () => {
    it('应该调用 axios.delete', async () => {
      mockDelete.mockResolvedValue({ success: true })

      await del('/users/1')

      expect(mockDelete).toHaveBeenCalledWith('/users/1', undefined)
    })

    it('应该传递 config', async () => {
      mockDelete.mockResolvedValue({ success: true })
      const config = { cancelDuplicate: false }

      await del('/users/1', config)

      expect(mockDelete).toHaveBeenCalledWith('/users/1', config)
    })
  })

  describe('错误处理（通过 mock reject）', () => {
    it('GET 请求失败时应该 reject', async () => {
      const error = {
        response: { status: 500, data: { message: '服务器错误' } },
        config: { method: 'get', url: '/test' },
      }
      mockGet.mockRejectedValue(error)

      await expect(get('/test')).rejects.toEqual(error)
    })

    it('POST 请求失败时应该 reject', async () => {
      const error = {
        response: { status: 403, data: { message: '无权限' } },
        config: { method: 'post', url: '/test' },
      }
      mockPost.mockRejectedValue(error)

      await expect(post('/test', {})).rejects.toEqual(error)
    })

    it('401 错误时应该 reject', async () => {
      const error = {
        response: { status: 401, data: { message: '未授权' } },
        config: { method: 'get', url: '/test' },
      }
      mockGet.mockRejectedValue(error)

      await expect(get('/test')).rejects.toEqual(error)
    })
  })
})
