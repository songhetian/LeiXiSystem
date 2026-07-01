import { useEffect, useCallback } from 'react'
import type { Form } from '@arco-design/web-react'

interface UseFormHotkeysOptions {
  form?: ReturnType<typeof Form.useForm>[0]
  onSubmit?: () => void | Promise<void>
  onClose?: () => void
  onReset?: () => void
  modalRef?: React.RefObject<HTMLElement>
}

/**
 * 表单快捷键 Hook
 *
 * 支持的快捷键:
 * - Ctrl+Enter / Cmd+Enter: 提交表单
 * - Escape: 关闭弹窗
 * - Ctrl+Shift+Z: 重置表单
 */
export function useFormHotkeys(options: UseFormHotkeysOptions) {
  const { form, onSubmit, onClose, modalRef } = options

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement

      // 只在弹窗内或指定容器内处理
      if (modalRef?.current && !modalRef.current.contains(target)) {
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+Enter / Cmd+Enter: 提交
      if (ctrl && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onSubmit?.()
        return
      }

      // Escape: 关闭
      if (e.key === 'Escape' && !ctrl) {
        // 检查是否在输入框中，如果是则先让输入框处理
        const isInput = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'

        if (isInput && document.activeElement === target) {
          // 输入框中的 Escape 通常用于清除输入，先让输入框处理
          // 只有在弹窗级别才拦截
        }

        e.preventDefault()
        e.stopPropagation()
        onClose?.()
        return
      }

      // Ctrl+Shift+Z: 重置
      if (ctrl && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        form?.resetFields()
        return
      }
    },
    [form, onSubmit, onClose, modalRef]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

export default useFormHotkeys
