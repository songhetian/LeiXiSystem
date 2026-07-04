import React, { useState, useRef, useCallback } from 'react'
import { Button, Dropdown, Menu, Message } from '@arco-design/web-react'
import { IconExport, IconFile, IconFileImage } from '@arco-design/web-react/icon'
import { createExportTask, getExportTask, downloadExportTask, type ReportType, type ExportFormat } from '@/api/export'

export interface ExportButtonProps {
  reportType: ReportType
  params?: Record<string, any>
  fields?: string[]
  text?: string
  type?: 'primary' | 'secondary' | 'outline' | 'text'
  size?: 'mini' | 'small' | 'default' | 'large'
  disabled?: boolean
  formats?: ExportFormat[]
  className?: string
  onExported?: (taskId: number) => void
}

const ExportButton: React.FC<ExportButtonProps> = ({
  reportType,
  params,
  fields,
  text = '导出',
  type = 'secondary',
  size = 'default',
  disabled = false,
  formats = ['xlsx', 'csv'],
  className,
  onExported,
}) => {
  const [loading, setLoading] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerDownload = useCallback(async (taskId: number) => {
    try {
      const blob = await downloadExportTask(taskId)
      const url = window.URL.createObjectURL(blob as unknown as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_${taskId}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      Message.error('下载文件失败，请到导出任务列表手动下载')
    }
  }, [])

  const pollTask = useCallback(async (taskId: number) => {
    try {
      const res = await getExportTask(taskId)
      const task = res

      if (task.status === 'completed') {
        setLoading(false)
        Message.success(`导出完成，共 ${task.totalRows} 条数据`)
        onExported?.(taskId)
        triggerDownload(taskId)
        return
      }

      if (task.status === 'failed') {
        setLoading(false)
        Message.error(`导出失败：${task.errorMsg || '未知错误'}`)
        return
      }

      pollTimerRef.current = setTimeout(() => pollTask(taskId), 2000)
    } catch {
      setLoading(false)
      Message.error('查询导出状态失败')
    }
  }, [onExported, triggerDownload])

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (loading) return
    setLoading(true)

    try {
      const res = await createExportTask({
        reportType,
        format,
        filters: params,
        ...(fields ? { templateId: undefined } : {}),
      })

      const taskId = (res as any).taskId || (res as any).id
      if (!taskId) {
        Message.error('创建导出任务失败')
        setLoading(false)
        return
      }

      Message.info('正在生成导出文件，请稍候...')
      pollTask(taskId)
    } catch {
      setLoading(false)
      Message.error('创建导出任务失败')
    }
  }, [reportType, params, fields, loading, pollTask])

  React.useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
    }
  }, [])

  if (formats.length === 1) {
    return (
      <Button
        type={type}
        size={size}
        icon={<IconExport />}
        loading={loading}
        disabled={disabled}
        onClick={() => handleExport(formats[0])}
        className={className}
      >
        {text}
      </Button>
    )
  }

  const droplist = (
    <Menu onClickMenuItem={(key) => handleExport(key as ExportFormat)}>
      {formats.map((fmt) => (
        <Menu.Item key={fmt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {fmt === 'xlsx' ? <IconFile style={{ color: '#00b42a' }} /> : <IconFileImage style={{ color: '#165dff' }} />}
            {fmt === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
          </div>
        </Menu.Item>
      ))}
    </Menu>
  )

  return (
    <Dropdown.Button
      type={type}
      size={size}
      icon={<IconExport />}
      disabled={disabled || loading}
      className={className}
      onClick={() => handleExport('xlsx')}
      droplist={droplist}
    >
      {loading ? '导出中...' : text}
    </Dropdown.Button>
  )
}

export default ExportButton
