import { ReactNode } from 'react'
import { Button, Space, Typography } from '@arco-design/web-react'
import { IconRefresh } from '@arco-design/web-react/icon'
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp'
import styles from './index.module.css'
const { Title, Text } = Typography

interface PageHeaderProps {
  title: string
  description?: string
  extra?: ReactNode
  /** 是否显示刷新按钮，默认 true */
  showRefresh?: boolean
  /** 刷新按钮点击回调 */
  onRefresh?: () => void
  /** 是否显示快捷键帮助，默认 true */
  showShortcuts?: boolean
}

function PageHeader({
  title,
  description,
  extra,
  showRefresh = true,
  onRefresh,
  showShortcuts = true,
}: PageHeaderProps) {
  return (
    <div className={styles['page-header']}>
      <Space direction="vertical" size={4} className={styles['page-header__space']}>
        <div className={styles['page-header__row']}>
          <Title heading={5} className={styles['page-header__title']}>{title}</Title>
          <div className={styles['page-header__actions']}>
            {showRefresh && onRefresh && (
              <Button
                type="text"
                icon={<IconRefresh />}
                onClick={onRefresh}
                className={styles['page-header__refresh']}
                title="刷新 (Ctrl+R)"
              >
                刷新
              </Button>
            )}
            {showShortcuts && <KeyboardShortcutsHelp />}
            {extra && <div className={styles['page-header__extra']}>{extra}</div>}
          </div>
        </div>
        {description && <Text type="secondary">{description}</Text>}
      </Space>
    </div>
  )
}

export default PageHeader
