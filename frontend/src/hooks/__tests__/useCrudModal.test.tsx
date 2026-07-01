import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCrudModal } from '../useCrudModal'
import type { BaseRecord } from '../useCrudModal'

interface TestRecord extends BaseRecord {
  id: number
  name: string
}

describe('useCrudModal', () => {
  let mockForm: any
  let mockOnSubmit: ReturnType<typeof vi.fn>
  let mockOnSuccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockForm = {
      validate: vi.fn().mockResolvedValue({ name: 'test' }),
      resetFields: vi.fn(),
      setFieldsValue: vi.fn(),
    }
    mockOnSubmit = vi.fn().mockResolvedValue(undefined)
    mockOnSuccess = vi.fn()
  })

  describe('基础状态', () => {
    it('应该以关闭状态初始化', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit }),
      )
      expect(result.current.visible).toBe(false)
      expect(result.current.editingId).toBeNull()
      expect(result.current.saving).toBe(false)
    })
  })

  describe('openCreate', () => {
    it('应该打开弹窗并清空 editingId', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      expect(result.current.visible).toBe(true)
      expect(result.current.editingId).toBeNull()
    })

    it('应该重置表单字段', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      expect(mockForm.resetFields).toHaveBeenCalled()
    })

    it('应该设置 initialValues 到表单', () => {
      const initialValues = { name: '默认名称' }
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({
          form: mockForm,
          onSubmit: mockOnSubmit,
          initialValues,
        }),
      )

      act(() => {
        result.current.openCreate()
      })

      expect(mockForm.setFieldsValue).toHaveBeenCalledWith(initialValues)
    })

    it('无 form 时也应该能打开弹窗', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      expect(result.current.visible).toBe(true)
    })
  })

  describe('openEdit', () => {
    it('应该打开弹窗并设置 editingId', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      const record: TestRecord = { id: 42, name: '张三' }

      act(() => {
        result.current.openEdit(record)
      })

      expect(result.current.visible).toBe(true)
      expect(result.current.editingId).toBe(42)
    })

    it('应该将 record 数据设置到表单', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      const record: TestRecord = { id: 1, name: '李四' }

      act(() => {
        result.current.openEdit(record)
      })

      expect(mockForm.setFieldsValue).toHaveBeenCalledWith(record)
    })

    it('应该使用 mapRecordToForm 转换数据', () => {
      const mapRecordToForm = vi.fn((r: TestRecord) => ({ fullName: r.name }))
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({
          form: mockForm,
          onSubmit: mockOnSubmit,
          mapRecordToForm,
        }),
      )

      const record: TestRecord = { id: 1, name: '王五' }

      act(() => {
        result.current.openEdit(record)
      })

      expect(mapRecordToForm).toHaveBeenCalledWith(record)
      expect(mockForm.setFieldsValue).toHaveBeenCalledWith({ fullName: '王五' })
    })
  })

  describe('close', () => {
    it('应该关闭弹窗', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })
      expect(result.current.visible).toBe(true)

      act(() => {
        result.current.close()
      })
      expect(result.current.visible).toBe(false)
    })
  })

  describe('handleOk', () => {
    it('应该验证表单并提交数据', async () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        await result.current.handleOk()
      })

      expect(mockForm.validate).toHaveBeenCalled()
      expect(mockOnSubmit).toHaveBeenCalledWith({ name: 'test' }, null)
    })

    it('提交成功后应该关闭弹窗', async () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        await result.current.handleOk()
      })

      expect(result.current.visible).toBe(false)
    })

    it('提交成功后应该调用 onSuccess 回调', async () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({
          form: mockForm,
          onSubmit: mockOnSubmit,
          onSuccess: mockOnSuccess,
        }),
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        await result.current.handleOk()
      })

      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('编辑模式下应该传递 editingId', async () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      const record: TestRecord = { id: 10, name: '赵六' }

      act(() => {
        result.current.openEdit(record)
      })

      await act(async () => {
        await result.current.handleOk()
      })

      expect(mockOnSubmit).toHaveBeenCalledWith({ name: 'test' }, 10)
    })

    it('提交失败后 saving 应该恢复为 false', async () => {
      mockOnSubmit.mockRejectedValueOnce(new Error('提交失败'))
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ form: mockForm, onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        try {
          await result.current.handleOk()
        } catch {
          // expected
        }
      })

      expect(result.current.saving).toBe(false)
    })

    it('无 form 时应该提交空对象', async () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit }),
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        await result.current.handleOk()
      })

      expect(mockOnSubmit).toHaveBeenCalledWith({}, null)
    })
  })

  describe('快捷键', () => {
    it('Escape 键应该关闭弹窗', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit, enableHotkeys: true }),
      )

      act(() => {
        result.current.openCreate()
      })
      expect(result.current.visible).toBe(true)

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(result.current.visible).toBe(false)
    })

    it('Ctrl+Enter 应该提交表单', async () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({
          form: mockForm,
          onSubmit: mockOnSubmit,
          enableHotkeys: true,
        }),
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
        )
        // allow async handleOk to settle
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(mockOnSubmit).toHaveBeenCalled()
    })

    it('弹窗关闭时不应该响应快捷键', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit, enableHotkeys: true }),
      )

      // 弹窗默认关闭
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(result.current.visible).toBe(false)
    })

    it('enableHotkeys=false 时不应该响应快捷键', () => {
      const { result } = renderHook(() =>
        useCrudModal<TestRecord>({ onSubmit: mockOnSubmit, enableHotkeys: false }),
      )

      act(() => {
        result.current.openCreate()
      })

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(result.current.visible).toBe(true)
    })
  })
})
