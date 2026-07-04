import React, { useRef } from 'react'
import { Button, Message, Space } from '@arco-design/web-react'
import { IconUpload } from '@arco-design/web-react/icon'

export interface ImportButtonProps {
  /** 导入接口 */
  onImport: (file: File) => Promise<void>
  /** 导入模板下载 */
  onDownloadTemplate?: () => void
  /** 按钮文字 */
  text?: string
  /** 按钮类型 */
  type?: 'primary' | 'secondary' | 'outline' | 'text'
  /** 接受的文件类型 */
  accept?: string
  /** 是否显示模板下载按钮 */
  showTemplate?: boolean
  /** 加载状态 */
  loading?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 导入按钮组件
 *
 * @example
 * <ImportButton
 *   onImport={handleImport}
 *   onDownloadTemplate={handleDownloadTemplate}
 *   text="导入员工"
 * />
 */
const ImportButton: React.FC<ImportButtonProps> = ({
  onImport,
  onDownloadTemplate,
  text = '导入',
  type = 'secondary',
  accept = '.xlsx,.xls,.csv',
  showTemplate = true,
  loading = false,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await onImport(file)
      Message.success('导入成功')
    } catch (error) {
      Message.error('导入失败，请检查文件格式')
    } finally {
      // 清空 input 值，允许重复选择同一文件
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <Space className={className}>
      <Button
        type={type}
        icon={<IconUpload />}
        onClick={handleClick}
        loading={loading}
      >
        {text}
      </Button>
      {showTemplate && onDownloadTemplate && (
        <Button type="text" onClick={onDownloadTemplate}>
          下载模板
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </Space>
  )
}

export default ImportButton
