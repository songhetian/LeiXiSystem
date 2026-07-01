import { ReactNode } from 'react'
import { Tag, Button } from '@arco-design/web-react'
import { IconRefresh } from '@arco-design/web-react/icon'
import type { TagProps } from '@arco-design/web-react'
import styles from './index.module.css'
interface TableHeaderProps {
  title: string
  total?: number
  totalText?: string
  totalTagColor?: TagProps['color']
  totalTagText?: string
  extra?: ReactNode
  /** 是否显示刷新按钮，默认 false */
  showRefresh?: boolean
  /** 刷新按钮点击回调 */
  onRefresh?: () => void
}

export default function TableHeader({
  title,
  total,
  totalText = '条',
  totalTagColor = 'blue',
  totalTagText,
  extra,
  showRefresh = false,
  onRefresh,
}: TableHeaderProps) {
  return (
    <div className={styles['table-header']}>
      <div className={styles['table-header__left']}>
        <span className={styles['table-header__title']}>{title}</span>
        {total !== undefined && (
          <Tag color={totalTagColor} className={styles['table-header__total']}>
            {totalTagText || `共 ${total} ${totalText}`}
          </Tag>
        )}
      </div>
      <div className={styles['table-header__right']}>
        {showRefresh && onRefresh && (
          <Button
            type="text"
            icon={<IconRefresh />}
            onClick={onRefresh}
            className={styles['table-header__refresh']}
            title="刷新 (Ctrl+R)"
          >
            刷新
          </Button>
        )}
        {extra}
      </div>
    </div>
  )
}
