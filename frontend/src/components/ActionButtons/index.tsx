import { ReactNode } from 'react'
import { Button, Popconfirm, Space } from '@arco-design/web-react'
import { IconEdit, IconDelete } from '@arco-design/web-react/icon'
import styles from './index.module.css'
interface ActionButtonsProps {
  onEdit?: () => void
  onDelete?: () => void
  editText?: string
  deleteText?: string
  deleteTitle?: string
  deleteContent?: string
  deleteConfirm?: boolean
  extraBefore?: ReactNode
  extraAfter?: ReactNode
  size?: 'mini' | 'small' | 'medium' | 'large'
  /** 是否显示快捷键提示 */
  showShortcutHint?: boolean
}

export default function ActionButtons({
  onEdit,
  onDelete,
  editText = '编辑',
  deleteText = '删除',
  deleteTitle = '确认删除',
  deleteContent = '确定要删除吗？',
  deleteConfirm = true,
  extraBefore,
  extraAfter,
  size = 'small',
  showShortcutHint = false,
}: ActionButtonsProps) {
  const deleteButton = (
    <Button
      type="text"
      size={size}
      status="danger"
      icon={<IconDelete />}
      onClick={deleteConfirm ? undefined : onDelete}
      className={styles['action-buttons__delete']}
    >
      {deleteText}
      {showShortcutHint && <span className={styles['action-buttons__shortcut']}>Del</span>}
    </Button>
  )

  const editButton = onEdit && (
    <Button
      type="text"
      size={size}
      icon={<IconEdit />}
      onClick={onEdit}
      className={styles['action-buttons__edit']}
    >
      {editText}
      {showShortcutHint && <span className={styles['action-buttons__shortcut']}>Ctrl+E</span>}
    </Button>
  )

  return (
    <Space size="small">
      {extraBefore}
      {editButton}
      {extraAfter}
      {onDelete && (deleteConfirm ? (
        <Popconfirm title={deleteTitle} content={deleteContent} onOk={onDelete}>
          {deleteButton}
        </Popconfirm>
      ) : deleteButton)}
    </Space>
  )
}
