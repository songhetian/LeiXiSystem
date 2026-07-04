import { useCallback, useEffect, useState } from 'react'
import type { FormInstance } from '@arco-design/web-react/es/Form/interface'

export interface BaseRecord {
  id?: number | string
  [key: string]: any
}

export interface UseCrudModalOptions<T extends BaseRecord = BaseRecord> {
  form?: FormInstance
  onSubmit: (values: Record<string, any>, id?: number | null) => Promise<void>
  onSuccess?: () => void
  successMessage?: { create?: string; update?: string }
  mapRecordToForm?: (record: T) => Record<string, any>
  initialValues?: Record<string, any>
  enableHotkeys?: boolean
}

export interface UseCrudModalResult<T extends BaseRecord = BaseRecord> {
  visible: boolean
  editingId: number | null
  saving: boolean
  openCreate: () => void
  openEdit: (record: T) => void
  close: () => void
  handleOk: () => Promise<void>
}

export function useCrudModal<T extends BaseRecord = BaseRecord>({
  form,
  onSubmit,
  onSuccess,
  successMessage: _successMessage,
  mapRecordToForm,
  initialValues,
  enableHotkeys = true,
}: UseCrudModalOptions<T>): UseCrudModalResult<T> {
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const openCreate = useCallback(() => {
    setEditingId(null)
    form?.resetFields?.()
    if (initialValues) {
      form?.setFieldsValue?.(initialValues)
    }
    setVisible(true)
  }, [form, initialValues])

  const openEdit = useCallback((record: T) => {
    setEditingId(Number(record.id) ?? null)
    const formValues = mapRecordToForm ? mapRecordToForm(record) : record
    form?.setFieldsValue?.(formValues)
    setVisible(true)
  }, [form, mapRecordToForm])

  const close = useCallback(() => {
    setVisible(false)
  }, [])

  const handleOk = useCallback(async () => {
    try {
      const values = form ? await form.validate() : {}
      setSaving(true)
      await onSubmit(values, editingId)
      setVisible(false)
      onSuccess?.()
    } finally {
      setSaving(false)
    }
  }, [form, onSubmit, editingId, onSuccess])

  // 键盘快捷键：Escape 关闭，Ctrl+Enter 提交
  useEffect(() => {
    if (!enableHotkeys || !visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      const ctrl = e.ctrlKey || e.metaKey

      // Escape: 关闭弹窗
      if (e.key === 'Escape' && !ctrl) {
        e.preventDefault()
        close()
        return
      }

      // Ctrl+Enter / Cmd+Enter: 提交表单
      if (ctrl && e.key === 'Enter') {
        e.preventDefault()
        handleOk()
        return
      }

      // Tab 导航到第一个可提交按钮后 Enter 提交
      if (e.key === 'Enter' && !isInput) {
        e.preventDefault()
        handleOk()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enableHotkeys, visible, close, handleOk])

  return {
    visible,
    editingId,
    saving,
    openCreate,
    openEdit,
    close,
    handleOk,
  }
}

export default useCrudModal

