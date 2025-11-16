// 性能优化工具函数

/**
 * 防抖函数 - 延迟执行
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 延迟时间（毫秒）
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数 - 限制执行频率
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Function}
 */
export function throttle(func, limit = 300) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 本地存储缓存
 */
export const cache = {
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（秒），默认1小时
   */
  set(key, value, ttl = 3600) {
    const item = {
      value,
      expiry: Date.now() + ttl * 1000
    }
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item))
    } catch (error) {
      console.error('缓存设置失败:', error)
    }
  },

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any|null}
   */
  get(key) {
    try {
      const itemStr = localStorage.getItem(`cache_${key}`)
      if (!itemStr) return null

      const item = JSON.parse(itemStr)
      if (Date.now() > item.expiry) {
        localStorage.removeItem(`cache_${key}`)
        return null
      }

      return item.value
    } catch (error) {
      console.error('缓存读取失败:', error)
      return null
    }
  },

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  remove(key) {
    localStorage.removeItem(`cache_${key}`)
  },

  /**
   * 清空所有缓存
   */
  clear() {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key)
      }
    })
  }
}

/**
 * 图片懒加载
 * @param {string} selector - 图片选择器
 */
export function lazyLoadImages(selector = 'img[data-src]') {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target
          img.src = img.dataset.src
          img.classList.remove('lazy')
          observer.unobserve(img)
        }
      })
    })

    const images = document.querySelectorAll(selector)
    images.forEach(img => imageObserver.observe(img))
  } else {
    // 降级方案：直接加载所有图片
    const images = document.querySelectorAll(selector)
    images.forEach(img => {
      img.src = img.dataset.src
    })
  }
}

/**
 * 请求去重
 */
export class RequestDeduplicator {
  constructor() {
    this.pending = new Map()
  }

  /**
   * 执行请求（自动去重）
   * @param {string} key - 请求唯一标识
   * @param {Function} requestFn - 请求函数
   * @returns {Promise}
   */
  async request(key, requestFn) {
    // 如果已有相同请求在进行中，返回该请求的 Promise
    if (this.pending.has(key)) {
      return this.pending.get(key)
    }

    // 创建新请求
    const promise = requestFn()
      .finally(() => {
        // 请求完成后移除
        this.pending.delete(key)
      })

    this.pending.set(key, promise)
    return promise
  }

  /**
   * 取消所有待处理的请求
   */
  clear() {
    this.pending.clear()
  }
}

/**
 * 批量请求合并
 */
export class BatchRequestManager {
  constructor(batchFn, delay = 50) {
    this.batchFn = batchFn
    this.delay = delay
    this.queue = []
    this.timer = null
  }

  /**
   * 添加请求到批处理队列
   * @param {any} item - 请求项
   * @returns {Promise}
   */
  add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })

      if (this.timer) {
        clearTimeout(this.timer)
      }

      this.timer = setTimeout(() => {
        this.flush()
      }, this.delay)
    })
  }

  /**
   * 执行批处理
   */
  async flush() {
    if (this.queue.length === 0) return

    const batch = this.queue.splice(0)
    const items = batch.map(b => b.item)

    try {
      const results = await this.batchFn(items)
      batch.forEach((b, index) => {
        b.resolve(results[index])
      })
    } catch (error) {
      batch.forEach(b => {
        b.reject(error)
      })
    }
  }
}

/**
 * 性能监控
 */
export const performance = {
  /**
   * 标记性能点
   * @param {string} name - 标记名称
   */
  mark(name) {
    if (window.performance && window.performance.mark) {
      window.performance.mark(name)
    }
  },

  /**
   * 测量性能
   * @param {string} name - 测量名称
   * @param {string} startMark - 开始标记
   * @param {string} endMark - 结束标记
   * @returns {number} 耗时（毫秒）
   */
  measure(name, startMark, endMark) {
    if (window.performance && window.performance.measure) {
      window.performance.measure(name, startMark, endMark)
      const measure = window.performance.getEntriesByName(name)[0]
      return measure ? measure.duration : 0
    }
    return 0
  },

  /**
   * 清除性能标记
   */
  clear() {
    if (window.performance) {
      window.performance.clearMarks()
      window.performance.clearMeasures()
    }
  }
}
