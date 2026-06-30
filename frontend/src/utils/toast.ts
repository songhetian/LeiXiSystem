import { Message } from '@arco-design/web-react'
import type { MessageProps } from '@arco-design/web-react/es/Message/interface'

type ToastType = 'info' | 'success' | 'warning' | 'error' | 'normal'

interface ToastOptions extends Partial<MessageProps> {
  duration?: number
  closable?: boolean
  showIcon?: boolean
}

type ToastCloseFn = () => void

const DEFAULT_DURATION = 3000

function showToast(
  type: ToastType,
  content: string,
  options?: ToastOptions
): ToastCloseFn {
  const { duration = DEFAULT_DURATION, closable = false, showIcon = true, ...rest } = options || {}
  return Message[type]({
    content,
    duration,
    closable,
    showIcon,
    ...rest,
  })
}

export const toast = {
  info: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('info', content, options),

  success: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('success', content, options),

  warning: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('warning', content, options),

  error: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('error', content, options),

  normal: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('normal', content, options),

  loading: (content: string = '加载中...', options?: ToastOptions): ToastCloseFn => {
    const { duration = 0, closable = false, showIcon = true, ...rest } = options || {}
    return Message.loading({
      content,
      duration,
      closable,
      showIcon,
      ...rest,
    })
  },

  config: Message.config,

  clear: Message.clear,
}

export function handleError(error: any, defaultMessage: string = '操作失败') {
  const message = error?.message || error?.msg || defaultMessage
  toast.error(message)
  console.error('[Toast Error]', error)
}
