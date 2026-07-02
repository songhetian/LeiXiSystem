import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Message } from '@arco-design/web-react'
import { toast, handleError } from './toast'

// Mock Message
vi.mock('@arco-design/web-react', () => ({
  Message: {
    success: vi.fn(() => vi.fn()),
    error: vi.fn(() => vi.fn()),
    warning: vi.fn(() => vi.fn()),
    info: vi.fn(() => vi.fn()),
    normal: vi.fn(() => vi.fn()),
    loading: vi.fn(() => vi.fn()),
    config: vi.fn(),
    clear: vi.fn(),
  },
}))

describe('toast 工具', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('toast.success', () => {
    it('应该调用 Message.success 并传递内容', () => {
      const content = '操作成功'
      toast.success(content)
      expect(Message.success).toHaveBeenCalledWith(
        expect.objectContaining({ content })
      )
    })

    it('应该使用默认 duration', () => {
      toast.success('test')
      expect(Message.success).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 2500 })
      )
    })

    it('应该支持自定义 options', () => {
      toast.success('test', { duration: 5000, closable: true })
      expect(Message.success).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 5000, closable: true })
      )
    })

    it('应该返回关闭函数', () => {
      const closeFn = vi.fn()
      ;(Message.success as ReturnType<typeof vi.fn>).mockReturnValue(closeFn)
      const result = toast.success('test')
      expect(result).toBeTypeOf('function')
    })
  })

  describe('toast.error', () => {
    it('应该调用 Message.error 并传递内容', () => {
      const content = '操作失败'
      toast.error(content)
      expect(Message.error).toHaveBeenCalledWith(
        expect.objectContaining({ content })
      )
    })

    it('应该返回关闭函数', () => {
      const closeFn = vi.fn()
      ;(Message.error as ReturnType<typeof vi.fn>).mockReturnValue(closeFn)
      const result = toast.error('test')
      expect(result).toBeTypeOf('function')
    })
  })

  describe('toast.warning', () => {
    it('应该调用 Message.warning 并传递内容', () => {
      const content = '警告信息'
      toast.warning(content)
      expect(Message.warning).toHaveBeenCalledWith(
        expect.objectContaining({ content })
      )
    })
  })

  describe('toast.info', () => {
    it('应该调用 Message.info 并传递内容', () => {
      const content = '提示信息'
      toast.info(content)
      expect(Message.info).toHaveBeenCalledWith(
        expect.objectContaining({ content })
      )
    })
  })

  describe('toast.normal', () => {
    it('应该调用 Message.normal 并传递内容', () => {
      const content = '普通信息'
      toast.normal(content)
      expect(Message.normal).toHaveBeenCalledWith(
        expect.objectContaining({ content })
      )
    })
  })

  describe('toast.loading', () => {
    it('应该调用 Message.loading 并传递内容', () => {
      const content = '加载中...'
      toast.loading(content)
      expect(Message.loading).toHaveBeenCalledWith(
        expect.objectContaining({ content })
      )
    })

    it('应该使用默认内容', () => {
      toast.loading()
      expect(Message.loading).toHaveBeenCalledWith(
        expect.objectContaining({ content: '加载中...' })
      )
    })

    it('应该使用 duration=0 表示不自动关闭', () => {
      toast.loading('加载中')
      expect(Message.loading).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 0 })
      )
    })

    it('应该返回关闭函数', () => {
      const closeFn = vi.fn()
      ;(Message.loading as ReturnType<typeof vi.fn>).mockReturnValue(closeFn)
      const result = toast.loading('加载中')
      expect(result).toBeTypeOf('function')
    })
  })

  describe('toast.config', () => {
    it('应该调用 Message.config', () => {
      const config = { duration: 5000 }
      toast.config(config)
      expect(Message.config).toHaveBeenCalledWith(config)
    })
  })

  describe('toast.clear', () => {
    it('应该调用 Message.clear', () => {
      toast.clear()
      expect(Message.clear).toHaveBeenCalled()
    })
  })
})

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该使用 error.message 显示错误', () => {
    const error = new Error('具体错误信息')
    handleError(error)
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '具体错误信息' })
    )
  })

  it('应该使用 error.msg 显示错误（兼容性）', () => {
    const error = { msg: '接口返回的错误' }
    handleError(error)
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '接口返回的错误' })
    )
  })

  it('应该使用默认消息当没有错误信息时', () => {
    handleError({})
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '操作失败' })
    )
  })

  it('应该支持自定义默认消息', () => {
    handleError({}, '自定义默认消息')
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '自定义默认消息' })
    )
  })

  it('应该输出错误到 console.error', () => {
    const error = new Error('测试错误')
    handleError(error)
    expect(console.error).toHaveBeenCalledWith('[Toast Error]', error)
  })
})

describe('边界用例', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('toast.warning 应该传递 showIcon 选项', () => {
    toast.warning('test', { showIcon: false })
    expect(Message.warning).toHaveBeenCalledWith(
      expect.objectContaining({ showIcon: false })
    )
  })

  it('toast.error 应该支持空字符串作为内容', () => {
    toast.error('')
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '' })
    )
  })

  it('toast.info 应该支持 undefined 作为 options', () => {
    toast.info('test', undefined)
    expect(Message.info).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'test' })
    )
  })

  it('handleError 应该处理 null 错误对象', () => {
    handleError(null)
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '操作失败' })
    )
  })

  it('handleError 应该处理 undefined 错误对象', () => {
    handleError(undefined)
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '操作失败' })
    )
  })

  it('handleError 应该优先使用 message 而非 msg', () => {
    const error = { message: '优先消息', msg: '次要消息' }
    handleError(error)
    expect(Message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: '优先消息' })
    )
  })
})
