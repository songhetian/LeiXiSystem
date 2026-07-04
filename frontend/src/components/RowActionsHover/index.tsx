import { useState } from 'react'
import { Space, Tooltip } from '@arco-design/web-react'
import styles from './index.module.css'
interface RowAction {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

interface RowActionsHoverProps {
  actions: RowAction[]
  trigger?: 'hover' | 'click'
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * 行操作悬停显示组件
 *
 * 默认只在悬停时显示操作按钮，节省表格空间
 *
 * @example
 * <RowActionsHover
 *   actions={[
 *     { key: 'edit', label: '编辑', icon: <IconEdit />, onClick: () => {} },
 *     { key: 'delete', label: '删除', danger: true, onClick: () => {} },
 *   ]}
 * />
 */
export function RowActionsHover({ actions, trigger = 'hover', placement = 'top' }: RowActionsHoverProps) {
  const [visible, setVisible] = useState(false)

  const triggerProps = trigger === 'hover'
    ? {
        onMouseEnter: () => setVisible(true),
        onMouseLeave: () => setVisible(false),
      }
    : {
        onClick: () => setVisible(!visible),
      }

  const content = (
    <Space size="small" className={styles['row-actions-hover__actions']}>
      {actions.map((action) => (
        <button
          key={action.key}
          className={`${styles['row-actions-hover__btn']} ${action.danger ? styles['row-actions-hover__btn--danger'] : ''}`}
          disabled={action.disabled}
          onClick={(e) => {
            e.stopPropagation()
            action.onClick()
          }}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </Space>
  )

  if (trigger === 'hover') {
    return (
      <div
        className={`${styles['row-actions-hover']} ${visible ? styles['row-actions-hover--visible'] : ''}`}
        {...triggerProps}
      >
        <Tooltip content={content} position={placement} trigger="hover">
          <span className={styles['row-actions-hover__trigger']}>...</span>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={`${styles['row-actions-hover']} ${visible ? styles['row-actions-hover--visible'] : ''}`} {...triggerProps}>
      {content}
    </div>
  )
}

export default RowActionsHover
