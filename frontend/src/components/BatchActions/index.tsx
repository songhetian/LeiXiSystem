import { ReactNode } from 'react'
import { Button, Space, Popconfirm, Message, Badge } from '@arco-design/web-react'
import { IconDelete, IconStop, IconCheckCircle } from '@arco-design/web-react/icon'
import styles from './index.module.css'
interface BatchActionsProps {
  /** 选中的数量 */
  selectedCount: number
  /** 是否显示 */
  visible?: boolean
  /** 清空选择回调 */
  onClear?: () => void
  /** 批量删除 */
  onBatchDelete?: () => Promise<void>
  /** 批量启用 */
  onBatchEnable?: () => Promise<void>
  /** 批量禁用 */
  onBatchDisable?: () => Promise<void>
  /** 批量导出 */
  onBatchExport?: () => void
  /** 自定义操作 */
  actions?: ReactNode
  /** 删除按钮文本 */
  deleteText?: string
  /** 启用按钮文本 */
  enableText?: string
  /** 禁用按钮文本 */
  disableText?: string
  /** 导出按钮文本 */
  exportText?: string
  /** 是否显示删除确认，默认 true */
  confirmDelete?: boolean
  /** 删除确认文本 */
  deleteConfirmText?: string
  /** 删除确认内容 */
  deleteConfirmContent?: string
}

export function BatchActions({
  selectedCount,
  visible = true,
  onClear,
  onBatchDelete,
  onBatchEnable,
  onBatchDisable,
  onBatchExport,
  actions,
  deleteText = '删除',
  enableText = '启用',
  disableText = '禁用',
  exportText = '导出',
  confirmDelete = true,
  deleteConfirmText = '确认删除',
  deleteConfirmContent = '确定要删除选中的数据吗？此操作不可恢复。',
}: BatchActionsProps) {
  if (!visible || selectedCount === 0) {
    return null
  }

  const handleBatchDelete = async () => {
    try {
      await onBatchDelete?.()
      Message.success(`成功删除 ${selectedCount} 条数据`)
      onClear?.()
    } catch {
      Message.error('删除失败')
    }
  }

  const handleBatchEnable = async () => {
    try {
      await onBatchEnable?.()
      Message.success(`成功启用 ${selectedCount} 条数据`)
      onClear?.()
    } catch {
      Message.error('启用失败')
    }
  }

  const handleBatchDisable = async () => {
    try {
      await onBatchDisable?.()
      Message.success(`成功禁用 ${selectedCount} 条数据`)
      onClear?.()
    } catch {
      Message.error('禁用失败')
    }
  }

  const deleteButton = onBatchDelete ? (
    confirmDelete ? (
      <Popconfirm
        title={deleteConfirmText}
        content={deleteConfirmContent}
        onOk={handleBatchDelete}
      >
        <Button type="primary" status="danger" icon={<IconDelete />}>
          {deleteText}
        </Button>
      </Popconfirm>
    ) : (
      <Button type="primary" status="danger" icon={<IconDelete />} onClick={handleBatchDelete}>
        {deleteText}
      </Button>
    )
  ) : null

  return (
    <div className={styles['batch-actions']}>
      <div className={styles['batch-actions__left']}>
        <Space>
          <Badge count={selectedCount} dot>
            <span className={styles['batch-actions__label']}>已选择</span>
          </Badge>
          {onClear && (
            <Button type="text" size="small" onClick={onClear}>
              清空
            </Button>
          )}
        </Space>
      </div>
      <div className={styles['batch-actions__right']}>
        <Space>
          {actions}
          {onBatchExport && (
            <Button icon={<IconDelete />} onClick={onBatchExport}>
              {exportText}
            </Button>
          )}
          {onBatchDisable && (
            <Button icon={<IconStop />} onClick={handleBatchDisable}>
              {disableText}
            </Button>
          )}
          {onBatchEnable && (
            <Button type="primary" icon={<IconCheckCircle />} onClick={handleBatchEnable}>
              {enableText}
            </Button>
          )}
          {deleteButton}
        </Space>
      </div>
    </div>
  )
}

export default BatchActions
