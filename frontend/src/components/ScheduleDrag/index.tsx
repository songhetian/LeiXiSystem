import { useState, useCallback, useMemo } from 'react'
import { Tag, Button } from '@arco-design/web-react'
import { IconDelete, IconPlus } from '@arco-design/web-react/icon'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './index.module.css'
export interface ScheduleShift {
  id: string | number
  name: string
  color?: string
  startTime?: string
  endTime?: string
  type?: 'work' | 'off' | 'leave' | 'overtime' | 'business'
  [key: string]: any
}

export interface ScheduleCell {
  date: string
  employeeId: string | number
  employeeName: string
  shifts: ScheduleShift[]
}

interface ScheduleDragProps {
  /** 排班数据 */
  data: ScheduleCell[]
  /** 日期列表 */
  dates: string[]
  /** 班次列表 */
  shifts: ScheduleShift[]
  /** 排班更新回调 */
  onScheduleChange?: (data: ScheduleCell[]) => void
  /** 是否可编辑，默认 true */
  editable?: boolean
  /** 删除班次回调 */
  onDeleteShift?: (employeeId: string | number, date: string, shiftId: string | number) => void
  /** 添加班次回调 */
  onAddShift?: (employeeId: string | number, date: string, shiftId: string | number) => void
  /** 移动班次回调 */
  onMoveShift?: (
    from: { employeeId: string | number; date: string; shiftId: string | number },
    to: { employeeId: string | number; date: string },
  ) => void
}

function SortableShift({
  shift,
  onDelete,
  disabled,
}: {
  shift: ScheduleShift
  onDelete?: () => void
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shift.id,
    disabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'default' : 'grab',
  }

  const colorMap: Record<string, string> = {
    work: 'blue',
    off: 'gray',
    leave: 'orange',
    overtime: 'red',
    business: 'purple',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles['schedule-drag__shift']}
      {...attributes}
      {...listeners}
    >
      <Tag color={shift.color || colorMap[shift.type || 'work']} size="small">
        {shift.name}
      </Tag>
      {!disabled && onDelete && (
        <Button
          size="mini"
          type="text"
          icon={<IconDelete />}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={styles['schedule-drag__shift-delete']}
        />
      )}
    </div>
  )
}

function ScheduleCellComponent({
  cell,
  editable,
  onAdd,
  onDelete,
}: {
  cell: ScheduleCell
  editable?: boolean
  onAdd?: () => void
  onDelete?: (shiftId: string | number) => void
}) {
  const { setNodeRef } = useSortable({
    id: `${cell.employeeId}-${cell.date}`,
    disabled: true,
  })

  return (
    <div ref={setNodeRef} className={styles['schedule-drag__cell']}>
      <SortableContext
        items={cell.shifts.map((s) => s.id)}
        strategy={horizontalListSortingStrategy}
      >
        {cell.shifts.map((shift) => (
          <SortableShift
            key={shift.id}
            shift={shift}
            disabled={!editable}
            onDelete={editable ? () => onDelete?.(shift.id) : undefined}
          />
        ))}
      </SortableContext>
      {editable && cell.shifts.length === 0 && (
        <Button size="mini" type="dashed" icon={<IconPlus />} onClick={onAdd}>
          添加
        </Button>
      )}
    </div>
  )
}

export default function ScheduleDrag(props: ScheduleDragProps) {
  const {
    data,
    dates,
    shifts,
    onScheduleChange,
    editable = true,
    onDeleteShift,
    onAddShift,
    onMoveShift,
  } = props

  const [activeId, setActiveId] = useState<string | number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const allCellIds = useMemo(() => {
    return data.map((c) => `${c.employeeId}-${c.date}`)
  }, [data])

  const activeShift = useMemo(() => {
    if (!activeId) return null
    for (const cell of data) {
      const shift = cell.shifts.find((s) => s.id === activeId)
      if (shift) return shift
    }
    return null
  }, [activeId, data])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const overIdStr = String(over.id)

      const isOverCell = allCellIds.includes(overIdStr)

      if (isOverCell) {
        const [toEmployeeId, toDate] = overIdStr.split('-')
        const numericEmployeeId = isNaN(Number(toEmployeeId)) ? toEmployeeId : Number(toEmployeeId)

        let fromEmployeeId: string | number = ''
        let fromDate = ''
        for (const cell of data) {
          if (cell.shifts.find((s) => s.id === active.id)) {
            fromEmployeeId = cell.employeeId
            fromDate = cell.date
            break
          }
        }

        if (fromEmployeeId && fromDate && fromDate !== toDate && fromEmployeeId !== numericEmployeeId) {
          onMoveShift?.(
            { employeeId: fromEmployeeId, date: fromDate, shiftId: active.id },
            { employeeId: numericEmployeeId, date: toDate },
          )
        }
      } else {
        let cellIndex = -1
        let shiftIndex = -1
        for (let i = 0; i < data.length; i++) {
          const idx = data[i].shifts.findIndex((s) => s.id === active.id)
          if (idx !== -1) {
            cellIndex = i
            shiftIndex = idx
            break
          }
        }

        let targetShiftIndex = -1
        let targetCellIndex = -1
        for (let i = 0; i < data.length; i++) {
          const idx = data[i].shifts.findIndex((s) => s.id === over.id)
          if (idx !== -1) {
            targetCellIndex = i
            targetShiftIndex = idx
            break
          }
        }

        if (cellIndex === targetCellIndex && shiftIndex !== -1 && targetShiftIndex !== -1) {
          const newShifts = arrayMove(data[cellIndex].shifts, shiftIndex, targetShiftIndex)
          const newData = [...data]
          newData[cellIndex] = { ...newData[cellIndex], shifts: newShifts }
          onScheduleChange?.(newData)
        } else if (cellIndex !== -1 && targetCellIndex !== -1 && cellIndex !== targetCellIndex) {
          const shift = data[cellIndex].shifts[shiftIndex]
          const newFromShifts = data[cellIndex].shifts.filter((s) => s.id !== active.id)
          const newToShifts = [...data[targetCellIndex].shifts]
          newToShifts.splice(targetShiftIndex, 0, shift)
          const newData = [...data]
          newData[cellIndex] = { ...newData[cellIndex], shifts: newFromShifts }
          newData[targetCellIndex] = { ...newData[targetCellIndex], shifts: newToShifts }
          onScheduleChange?.(newData)
        }
      }
    },
    [data, allCellIds, onScheduleChange, onMoveShift],
  )

  const handleDeleteShift = useCallback(
    (employeeId: string | number, date: string, shiftId: string | number) => {
      onDeleteShift?.(employeeId, date, shiftId)
    },
    [onDeleteShift],
  )

  const handleAddShift = useCallback(
    (employeeId: string | number, date: string) => {
      if (shifts.length > 0) {
        onAddShift?.(employeeId, date, shifts[0].id)
      }
    },
    [shifts, onAddShift],
  )

  return (
    <div className={styles['schedule-drag']}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allCellIds} strategy={rectSortingStrategy} disabled={true}>
          <div className={styles['schedule-drag__grid']}>
            <div className={styles['schedule-drag__header']}>
              <div className={styles['schedule-drag__header-cell']}>员工</div>
              {dates.map((date) => (
                <div key={date} className={styles['schedule-drag__header-cell']}>
                  {date}
                </div>
              ))}
            </div>
            {getUniqueEmployees(data).map((employee) => (
              <div key={employee.id} className={styles['schedule-drag__row']}>
                <div className={styles['schedule-drag__employee-cell']}>{employee.name}</div>
                {dates.map((date) => {
                  const cell = data.find(
                    (c) => c.employeeId === employee.id && c.date === date,
                  )
                  return (
                    <ScheduleCellComponent
                      key={`${employee.id}-${date}`}
                      cell={cell || { employeeId: employee.id, employeeName: employee.name, date, shifts: [] }}
                      editable={editable}
                      onAdd={() => handleAddShift(employee.id, date)}
                      onDelete={(shiftId) => handleDeleteShift(employee.id, date, shiftId)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeShift ? (
            <div className={styles['schedule-drag__drag-overlay']}>
              <Tag color="blue" size="small">{activeShift.name}</Tag>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function getUniqueEmployees(data: ScheduleCell[]): { id: string | number; name: string }[] {
  const map = new Map<string | number, string>()
  data.forEach((cell) => {
    if (!map.has(cell.employeeId)) {
      map.set(cell.employeeId, cell.employeeName)
    }
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
}
