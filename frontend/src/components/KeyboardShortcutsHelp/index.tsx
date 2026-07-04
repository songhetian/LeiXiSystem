import { Button, Tooltip, Divider } from '@arco-design/web-react'
import { IconCommand } from '@arco-design/web-react/icon'
import styles from './index.module.css'
interface ShortcutItem {
  key: string
  description: string
  macKey?: string
}

interface ShortcutCategory {
  title: string
  items: ShortcutItem[]
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

const globalShortcuts: ShortcutCategory[] = [
  {
    title: '全局',
    items: [
      { key: 'Ctrl + N', description: '新建', macKey: '⌘ N' },
      { key: 'Ctrl + S', description: '保存', macKey: '⌘ S' },
      { key: 'Ctrl + K', description: '搜索', macKey: '⌘ K' },
      { key: 'Ctrl + R', description: '刷新', macKey: '⌘ R' },
      { key: 'Escape', description: '关闭弹窗/取消' },
    ],
  },
  {
    title: '表格',
    items: [
      { key: 'Ctrl + E', description: '编辑', macKey: '⌘ E' },
      { key: 'Delete', description: '删除' },
      { key: 'Ctrl + D', description: '导出', macKey: '⌘ D' },
      { key: 'Ctrl + A', description: '全选', macKey: '⌘ A' },
      { key: '↑ / ↓', description: '行导航' },
      { key: 'Enter', description: '确认/编辑' },
    ],
  },
  {
    title: '表单',
    items: [
      { key: 'Ctrl + Enter', description: '提交', macKey: '⌘ ↵' },
      { key: 'Escape', description: '关闭', macKey: '⌘ .' },
      { key: 'Tab', description: '下一个字段' },
      { key: 'Shift + Tab', description: '上一个字段' },
    ],
  },
]

interface ShortcutBadgeProps {
  shortcut: string
  className?: string
}

function ShortcutBadge({ shortcut, className = '' }: ShortcutBadgeProps) {
  // 转换为 Mac 风格显示
  const displayKey = isMac
    ? shortcut
        .replace(/Ctrl/g, '⌘')
        .replace(/Enter/g, '↵')
        .replace(/\+/g, '')
    : shortcut.replace(/Ctrl/g, 'Ctrl+')

  return (
    <kbd className={`${styles['shortcut-badge']} ${className}`}>
      {displayKey.split('+').map((key, i, arr) => (
        <span key={key}>
          <span className={styles['shortcut-badge__key']}>{key}</span>
          {i < arr.length - 1 && <span className={styles['shortcut-badge__plus']}>+</span>}
        </span>
      ))}
    </kbd>
  )
}

interface KeyboardShortcutsHelpProps {
  className?: string
}

export function KeyboardShortcutsHelp({ className = '' }: KeyboardShortcutsHelpProps) {
  const content = (
    <div className={styles['shortcuts-help']}>
      {globalShortcuts.map((category, index) => (
        <div key={category.title} className={styles['shortcuts-help__category']}>
          <div className={styles['shortcuts-help__title']}>{category.title}</div>
          {category.items.map((item) => (
            <div key={item.key} className={styles['shortcuts-help__item']}>
              <ShortcutBadge
                shortcut={isMac && item.macKey ? item.macKey : item.key}
              />
              <span className={styles['shortcuts-help__desc']}>{item.description}</span>
            </div>
          ))}
          {index < globalShortcuts.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  )

  return (
    <Tooltip content={content} position="left" trigger="click" className={`${styles['shortcuts-help-trigger']} ${className}`}>
      <Button icon={<IconCommand />} size="small" type="text">
        快捷键
      </Button>
    </Tooltip>
  )
}

export { ShortcutBadge }
export default KeyboardShortcutsHelp
