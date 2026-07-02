import { ReactNode } from 'react'
import { Table as ArcoTable, TableProps as ArcoTableProps } from '@arco-design/web-react'
import styles from './index.module.css'
export interface EnhancedTableProps<T = any> extends Omit<ArcoTableProps<T>, 'size'> {
  /** 表格密度 */
  size?: 'mini' | 'small' | 'default'
  /** 是否显示斑马纹 */
  stripe?: boolean
  /** 表头固定 */
  stickyHeader?: boolean
  /** 工具栏（设置按钮等） */
  toolbar?: ReactNode
  /** 表格下方工具栏 */
  footerToolbar?: ReactNode
  /** 自定义 className */
  className?: string
}

function EnhancedTable<T = any>({
  size = 'default',
  stripe = false,
  stickyHeader = false,
  toolbar,
  footerToolbar,
  className = '',
  ...props
}: EnhancedTableProps<T>) {
  const tableClassName = [
    'enhanced-table',
    stripe && 'enhanced-table--stripe',
    stickyHeader && 'enhanced-table--sticky',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={styles['enhanced-table-wrapper']}>
      {toolbar && (
        <div className={styles['enhanced-table__toolbar']}>
          {toolbar}
        </div>
      )}

      <ArcoTable
        size={size}
        className={tableClassName}
        {...props}
      />

      {footerToolbar && (
        <div className={styles['enhanced-table__footer']}>
          {footerToolbar}
        </div>
      )}
    </div>
  )
}

export default EnhancedTable
