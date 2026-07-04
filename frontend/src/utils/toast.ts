import { Message, Notification, Modal } from '@arco-design/web-react'
import type { MessageProps } from '@arco-design/web-react/es/Message/interface'

type ToastType = 'info' | 'success' | 'warning' | 'error' | 'normal'

interface ToastOptions extends Partial<MessageProps> {
  duration?: number
  closable?: boolean
  showIcon?: boolean
}

interface NotifyOptions {
  title?: string
  content: string
  duration?: number
  closable?: boolean
  btn?: React.ReactNode
  action?: string
  onAction?: () => void
}

type ToastCloseFn = () => void

const DEFAULT_DURATION = 3000

function showToast(
  type: ToastType,
  content: string,
  options?: ToastOptions
): ToastCloseFn {
  const {
    duration = DEFAULT_DURATION,
    closable = type === 'error',
    showIcon = true,
    ...rest
  } = options || {}
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
    showToast('success', content, { duration: 2500, ...options }),

  warning: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('warning', content, { duration: 4000, closable: true, ...options }),

  error: (content: string, options?: ToastOptions): ToastCloseFn =>
    showToast('error', content, { duration: 5000, closable: true, ...options }),

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

  /** Rich notification with title + content + optional action button */
  notify: (type: 'info' | 'success' | 'warning' | 'error', options: NotifyOptions) => {
    const { title, content, duration = 4500, closable = true, btn, ...rest } = options
    return Notification[type]({
      title: title || '',
      content,
      duration,
      closable,
      btn,
      ...rest,
    })
  },

  config: Message.config,
  clear: Message.clear,
} as any

/** Confirm dialog — returns a Promise that resolves on OK, rejects on Cancel */
toast.confirm = (options: {
  title: string
  content?: string
  okText?: string
  cancelText?: string
  type?: 'info' | 'warning' | 'error' | 'success'
}) => {
  return new Promise<void>((resolve, reject) => {
    const method = options.type === 'error' ? Modal.error
      : options.type === 'warning' ? Modal.warning
      : options.type === 'success' ? Modal.success
      : Modal.confirm
    method({
      title: options.title,
      content: options.content,
      okText: options.okText || '确定',
      cancelText: options.cancelText || '取消',
      onOk: () => resolve(),
      onCancel: () => reject(new Error('cancelled')),
    })
  })
}

/** Delete confirmation — danger-styled confirm */
toast.confirmDelete = (itemLabel: string) => {
  return toast.confirm({
    title: '确认删除',
    content: `确定要删除「${itemLabel}」吗？此操作不可撤销。`,
    okText: '删除',
    type: 'error',
  })
}

export function handleError(error: any, defaultMessage: string = '操作失败') {
  const message = error?.response?.data?.message || error?.message || error?.msg || defaultMessage
  toast.error(message)
  console.error('[Toast Error]', error)
}

export default toast
