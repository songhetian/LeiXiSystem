import { useState, useCallback, useMemo } from 'react'
import { Button, Card, Tag } from '@arco-design/web-react'
import { IconPlus, IconDelete, IconDragDotVertical } from '@arco-design/web-react/icon'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './index.module.css'
export interface FormField {
  id: string | number
  type: 'input' | 'select' | 'date' | 'number' | 'textarea' | 'switch' | 'radio' | 'checkbox'
  label: string
  field: string
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string | number }[]
  [key: string]: any
}

interface FormBuilderProps {
  /** 表单字段列表 */
  fields: FormField[]
  /** 字段变化回调 */
  onFieldsChange?: (fields: FormField[]) => void
  /** 可选字段类型列表 */
  availableFields?: Omit<FormField, 'id' | 'field'>[]
  /** 是否可编辑 */
  editable?: boolean
}

const defaultAvailableFields: Omit<FormField, 'id' | 'field'>[] = [
  { type: 'input', label: '单行文本', placeholder: '请输入' },
  { type: 'textarea', label: '多行文本', placeholder: '请输入' },
  { type: 'number', label: '数字输入', placeholder: '请输入数字' },
  { type: 'select', label: '下拉选择', placeholder: '请选择' },
  { type: 'date', label: '日期选择', placeholder: '请选择日期' },
  { type: 'switch', label: '开关' },
  { type: 'radio', label: '单选框' },
  { type: 'checkbox', label: '多选框' },
]

const typeTagColors: Record<string, string> = {
  input: 'blue',
  textarea: 'cyan',
  number: 'green',
  select: 'purple',
  date: 'orange',
  switch: 'red',
  radio: 'pink',
  checkbox: 'indigo',
}

function SortableFieldItem({
  field,
  onDelete,
  disabled,
}: {
  field: FormField
  onDelete?: () => void
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles['form-builder__field-item']}>
      <div className={styles['form-builder__field-handle']} {...attributes} {...listeners}>
        <IconDragDotVertical />
      </div>
      <div className={styles['form-builder__field-content']}>
        <div className={styles['form-builder__field-label']}>
          {field.label}
          {field.required && <span className={styles['form-builder__required']}>*</span>}
        </div>
        <Tag size="small" color={typeTagColors[field.type] || 'gray'}>
          {field.type}
        </Tag>
      </div>
      {!disabled && onDelete && (
        <Button
          size="mini"
          type="text"
          icon={<IconDelete />}
          onClick={onDelete}
          className={styles['form-builder__field-delete']}
        />
      )}
    </div>
  )
}

export default function FormBuilder(props: FormBuilderProps) {
  const {
    fields,
    onFieldsChange,
    availableFields = defaultAvailableFields,
    editable = true,
  } = props

  const [activeId, setActiveId] = useState<string | number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields])

  const activeField = useMemo(() => {
    if (!activeId) return null
    return fields.find((f) => f.id === activeId) || null
  }, [activeId, fields])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const activeIndex = fields.findIndex((f) => f.id === active.id)
      const overIndex = fields.findIndex((f) => f.id === over.id)

      if (activeIndex !== -1 && overIndex !== -1) {
        const newFields = arrayMove(fields, activeIndex, overIndex)
        onFieldsChange?.(newFields)
      }
    },
    [fields, onFieldsChange],
  )

  const handleDeleteField = useCallback(
    (index: number) => {
      const newFields = fields.filter((_, i) => i !== index)
      onFieldsChange?.(newFields)
    },
    [fields, onFieldsChange],
  )

  const handleAddField = useCallback(
    (template: Omit<FormField, 'id' | 'field'>) => {
      const newField: FormField = {
        ...template,
        id: `${template.type}-${Date.now()}`,
        field: `field_${Date.now()}`,
        type: template.type,
        label: template.label,
      }
      onFieldsChange?.([...fields, newField])
    },
    [fields, onFieldsChange],
  )

  return (
    <div className={styles['form-builder']}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={styles['form-builder__layout']}>
          <div className={styles['form-builder__sidebar']}>
            <Card size="small" title="字段库" className={styles['form-builder__sidebar-card']}>
              <div className={styles['form-builder__templates']}>
                {availableFields.map((template) => (
                  <div
                    key={`${template.type}-${template.label}`}
                    className={styles['form-builder__template-item']}
                    onClick={() => editable && handleAddField(template)}
                  >
                    <IconPlus style={{ fontSize: 14 }} />
                    <span>{template.label}</span>
                    <Tag size="small" color={typeTagColors[template.type] || 'gray'}>
                      {template.type}
                    </Tag>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className={styles['form-builder__main']}>
            <Card size="small" title="表单设计" className={styles['form-builder__main-card']}>
              <SortableContext items={fieldIds} strategy={verticalListSortingStrategy} disabled={!editable}>
                <div className={styles['form-builder__fields']}>
                  {fields.length === 0 ? (
                    <div className={styles['form-builder__empty']}>
                      <p>点击左侧字段添加到表单</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                        支持拖拽调整顺序
                      </p>
                    </div>
                  ) : (
                    fields.map((field, index) => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        disabled={!editable}
                        onDelete={() => handleDeleteField(index)}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </Card>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeField ? (
            <div className={styles['form-builder__drag-overlay']}>
              <IconDragDotVertical />
              <span>{activeField.label}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
