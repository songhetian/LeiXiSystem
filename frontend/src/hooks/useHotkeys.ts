import { useEffect, useCallback } from 'react'

export interface Hotkey {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  description?: string
}

export interface UseHotkeysOptions {
  onShortcut?: (shortcut: Hotkey) => void
  enableInInput?: boolean // 是否在输入框中启用
}

function formatShortcut(e: KeyboardEvent): Hotkey {
  const parts: string[] = []

  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Cmd')

  // 特殊键
  const specialKeys: Record<string, string> = {
    Enter: 'Enter',
    Escape: 'Escape',
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
  }

  if (specialKeys[e.key]) {
    parts.push(specialKeys[e.key])
  } else if (e.key.length === 1) {
    parts.push(e.key.toUpperCase())
  } else {
    parts.push(e.key)
  }

  return {
    key: parts.join('+'),
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
  }
}

export function useHotkeys(
  handlers: Record<string, () => void>,
  options: UseHotkeysOptions = {}
) {
  const { onShortcut, enableInInput = false } = options

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 如果在输入框中且不允许快捷键，则跳过
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (isInput && !enableInInput) {
        return
      }

      const shortcut = formatShortcut(e)
      const handler = handlers[shortcut.key]

      if (handler) {
        e.preventDefault()
        e.stopPropagation()
        handler()
        onShortcut?.(shortcut)
      }
    },
    [handlers, enableInInput, onShortcut]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

// 常用快捷键预设
export const SHORTCUTS = {
  // 全局
  NEW: 'Ctrl+N',
  SAVE: 'Ctrl+S',
  SEARCH: 'Ctrl+K',
  REFRESH: 'Ctrl+R',

  // 表格
  SELECT_ALL: 'Ctrl+A',
  ESCAPE: 'Escape',

  // 表单
  SUBMIT: 'Ctrl+Enter',
  CLOSE: 'Escape',

  // 导航
  PREV_PAGE: 'Alt+←',
  NEXT_PAGE: 'Alt+→',
} as const

export default useHotkeys
