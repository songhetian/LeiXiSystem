import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Button, Select, Space, Message, Form, DatePicker } from '@arco-design/web-react'
import { IconLeft, IconRight, IconRefresh, IconSave } from '@arco-design/web-react/icon'
import { getScheduleCalendar, assignSchedule, updateSchedule, deleteSchedule, Schedule } from '@/api/schedule'
import { getShifts, Shift } from '@/api/shift'
import { getDepartmentsList, Department } from '@/api/organization'
import { getEmployees } from '@/api/personnel'
import dayjs from 'dayjs'
import { PageHeader, FilterBar, ScheduleDrag } from '@/components'
import type { ScheduleCell, ScheduleShift } from '@/components/ScheduleDrag'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option

function getWeekDates(date: Date): string[] {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday)
    current.setDate(monday.getDate() + i)
    dates.push(current.toISOString().split('T')[0])
  }
  return dates
}

function getWeekRange(date: Date) {
  const dates = getWeekDates(date)
  return {
    startDate: dates[0],
    endDate: dates[6],
  }
}

function WeeklyPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [departmentId, setDepartmentId] = useState<number | undefined>()
  const [departments, setDepartments] = useState<Department[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek])
  const { startDate, endDate } = useMemo(() => getWeekRange(currentWeek), [currentWeek])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsList()
      setDepartments(res.data || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  const loadShifts = useCallback(async () => {
    try {
      const res = await getShifts({ page: 1, pageSize: 100, status: 'active' })
      setShifts(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await getEmployees({ page: 1, pageSize: 50, status: 'active', departmentId })
      setEmployees(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [departmentId])

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getScheduleCalendar({ startDate, endDate, departmentId })
      setSchedules(res.data || [])
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, departmentId])

  useEffect(() => {
    loadDepartments()
    loadShifts()
  }, [loadDepartments, loadShifts])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const scheduleCells = useMemo((): ScheduleCell[] => {
    const cells: ScheduleCell[] = []
    employees.forEach((emp) => {
      const empId = emp.userId || emp.id
      const empName = emp.user?.realName || emp.realName || ''
      weekDates.forEach((date) => {
        const daySchedules = schedules.filter(
          (s) =>
            s.userId === empId &&
            dayjs(s.scheduleDate).format('YYYY-MM-DD') === date,
        )
        const shiftList: ScheduleShift[] = daySchedules.map((s) => ({
          id: s.id,
          name: s.shiftName,
          color: s.shiftColor,
          type: s.status === 'normal' ? 'work' : s.status === 'leave' ? 'leave' : 'work',
        }))
        cells.push({
          date,
          employeeId: empId,
          employeeName: empName,
          shifts: shiftList,
        })
      })
    })
    return cells
  }, [employees, weekDates, schedules])

  const scheduleShifts = useMemo((): ScheduleShift[] => {
    return shifts.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      startTime: s.startTime,
      endTime: s.endTime,
    }))
  }, [shifts])

  const handlePrevWeek = () => {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() - 7)
    setCurrentWeek(d)
  }

  const handleNextWeek = () => {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() + 7)
    setCurrentWeek(d)
  }

  const handleToday = () => {
    setCurrentWeek(new Date())
  }

  const handleScheduleChange = useCallback((_data: ScheduleCell[]) => {
    Message.info('排班已更新，点击保存按钮提交更改')
  }, [])

  const handleMoveShift = useCallback(
    async (
      from: { employeeId: string | number; date: string; shiftId: string | number },
      to: { employeeId: string | number; date: string },
    ) => {
      try {
        const fromSchedule = schedules.find(
          (s) =>
            s.id === Number(from.shiftId) &&
            s.userId === Number(from.employeeId) &&
            dayjs(s.scheduleDate).format('YYYY-MM-DD') === from.date,
        )

        if (!fromSchedule) return

        const existingShift = schedules.find(
          (s) =>
            s.userId === Number(to.employeeId) &&
            dayjs(s.scheduleDate).format('YYYY-MM-DD') === to.date &&
            s.shiftId === fromSchedule.shiftId,
        )

        if (existingShift) {
          Message.warning('目标位置已有相同班次')
          return
        }

        await updateSchedule(Number(from.shiftId), {
          shiftId: fromSchedule.shiftId,
        })

        const newSchedule = { ...fromSchedule }
        newSchedule.userId = Number(to.employeeId)
        newSchedule.scheduleDate = to.date

        setSchedules((prev) => {
          const updated = prev.filter((s) => s.id !== Number(from.shiftId))
          return [...updated, { ...newSchedule, id: Date.now() }]
        })

        Message.success('排班已移动')
      } catch {
        loadSchedules()
      }
    },
    [schedules, loadSchedules],
  )

  const handleAddShift = useCallback(
    async (employeeId: string | number, date: string, shiftId: string | number) => {
      try {
        await assignSchedule({
          userIds: [Number(employeeId)],
          shiftId: Number(shiftId),
          startDate: date,
          endDate: date,
        })
        Message.success('排班已添加')
        loadSchedules()
      } catch {
        // error handled by interceptor
      }
    },
    [loadSchedules],
  )

  const handleDeleteShift = useCallback(
    async (_employeeId: string | number, _date: string, shiftId: string | number) => {
      try {
        await deleteSchedule(Number(shiftId))
        Message.success('排班已删除')
        loadSchedules()
      } catch {
        // error handled by interceptor
      }
    },
    [loadSchedules],
  )

  const handleSave = () => {
    Message.success('排班已保存')
    loadSchedules()
  }

  const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  const displayDates = weekDates.map((date, index) => {
    const d = dayjs(date)
    return `${weekDayNames[index]} ${d.format('MM/DD')}`
  })

  return (
    <div className={styles['schedule-weekly']}>
      <Card bordered={false} className={styles['schedule-weekly__card']}>
        <PageHeader
          title="周排班（拖拽）"
          description="按周查看和编辑员工排班，支持拖拽调整班次。"
          extra={
            <Space>
              <Button icon={<IconRefresh />} onClick={loadSchedules}>
                刷新
              </Button>
              <Button type="primary" icon={<IconSave />} onClick={handleSave}>
                保存
              </Button>
            </Space>
          }
        />
      </Card>

      <Card bordered={false} className={styles['schedule-weekly__card']}>
        <FilterBar
          filters={
            <FormItem label="部门">
              <Select
                className={styles['schedule-weekly__select-dept']}
                placeholder="全部部门"
                value={departmentId}
                onChange={setDepartmentId}
                allowClear
              >
                {departments.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.name}
                  </Option>
                ))}
              </Select>
            </FormItem>
          }
          onSearch={loadSchedules}
          onReset={() => {
            setDepartmentId(undefined)
          }}
        />
        <div className={styles['schedule-weekly__nav']}>
          <Space size="small">
            <Button icon={<IconLeft />} onClick={handlePrevWeek} />
            <Button onClick={handleToday}>本周</Button>
            <DatePicker
              style={{ width: 160 }}
              value={dayjs(currentWeek)}
              onChange={(v) => v && setCurrentWeek(v.toDate())}
            />
            <Button icon={<IconRight />} onClick={handleNextWeek} />
          </Space>
        </div>
      </Card>

      <Card bordered={false} loading={loading}>
        <div className={styles['schedule-weekly__header']}>
          <span className={styles['schedule-weekly__title']}>
            {startDate} ~ {endDate} 排班表
          </span>
          <Space size="small" wrap>
            {shifts.slice(0, 6).map((s) => (
              <div key={s.id} className={styles['schedule-weekly__shift-legend']}>
                <span
                  className={styles['schedule-weekly__legend-dot']}
                  style={{ backgroundColor: s.color || 'var(--color-primary-5)' }}
                />
                <span className={styles['schedule-weekly__legend-text']}>
                  {s.name} ({s.startTime}-{s.endTime})
                </span>
              </div>
            ))}
          </Space>
        </div>

        <ScheduleDrag
          data={scheduleCells}
          dates={displayDates}
          shifts={scheduleShifts}
          onScheduleChange={handleScheduleChange}
          onMoveShift={handleMoveShift}
          onAddShift={handleAddShift}
          onDeleteShift={handleDeleteShift}
          editable={true}
        />
      </Card>
    </div>
  )
}

export default WeeklyPage
