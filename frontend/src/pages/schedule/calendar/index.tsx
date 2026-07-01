import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Button, Select, Space, Modal, Form, Message, Tag, Calendar, Badge, Input, DatePicker, Table } from '@arco-design/web-react'
import { IconLeft, IconRight, IconPlus } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getScheduleCalendar, assignSchedule, updateSchedule, deleteSchedule } from '@/api/schedule'
import { getShifts, Shift } from '@/api/shift'
import { getDepartmentsList, Department } from '@/api/organization'
import { getEmployees, Employee } from '@/api/personnel'
import dayjs, { Dayjs } from 'dayjs'
import { PageHeader, FilterBar } from '@/components'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option
const RangePicker = DatePicker.RangePicker

interface ScheduleDetail {
  id: number; userId: number; userName: string; departmentName?: string; shiftId: number; shiftName: string; shiftColor?: string; scheduleDate: string; status: string; note?: string
}

function getMonthRange(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0)
  return {
    startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month + 1).padStart(2, '0')}-${lastDay.getDate()}`,
  }
}

function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [schedules, setSchedules] = useState<ScheduleDetail[]>([])
  const [_loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [departmentId, setDepartmentId] = useState<number | undefined>()
  const [departments, setDepartments] = useState<Department[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<(Employee & { userId?: number; user?: { realName: string } })[]>([])
  const [daySchedules, setDaySchedules] = useState<ScheduleDetail[]>([])
  const [editVisible, setEditVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ScheduleDetail | null>(null)
  const [editForm] = Form.useForm()
  const [batchVisible, setBatchVisible] = useState(false)
  const [batchForm] = Form.useForm()
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])

  const loadDepartments = useCallback(async () => {
    try { const res = await getDepartmentsList(); setDepartments(res.data || []) } catch { /* error handled by interceptor */ }
  }, [])
  const loadShifts = useCallback(async () => {
    try { const res = await getShifts({ page: 1, pageSize: 100, status: 'active' }); setShifts(res.data?.list || []) } catch { /* error handled by interceptor */ }
  }, [])
  const loadEmployees = useCallback(async () => {
    try { const res = await getEmployees({ page: 1, pageSize: 100, status: 'active', departmentId }); setEmployees(res.data?.list || []) } catch { /* error handled by interceptor */ }
  }, [departmentId])
  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getMonthRange(currentMonth)
      const res = await getScheduleCalendar({ startDate, endDate, departmentId })
      setSchedules(res.data || [])
    } catch { /* error handled by interceptor */ }
    finally { setLoading(false) }
  }, [currentMonth, departmentId])

  useEffect(() => { loadDepartments(); loadShifts() }, [loadDepartments, loadShifts])
  useEffect(() => { loadSchedules() }, [loadSchedules])
  useEffect(() => { loadEmployees() }, [loadEmployees])

  const calendarData = useMemo(() => {
    const map: Record<string, { shifts: { name: string; color: string; count: number }[] }> = {}
    schedules.forEach((s) => {
      const dateStr = new Date(s.scheduleDate).toISOString().split('T')[0]
      if (!map[dateStr]) map[dateStr] = { shifts: [] }
      const existing = map[dateStr].shifts.find((sh) => sh.name === s.shiftName)
      if (existing) existing.count++
      else map[dateStr].shifts.push({ name: s.shiftName, color: s.shiftColor || 'blue', count: 1 })
    })
    return map
  }, [schedules])

  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayData = calendarData[dateStr]
    if (!dayData || dayData.shifts.length === 0) return null
    return (
      <div className={styles['schedule-calendar__cell']}>
        {dayData.shifts.map((shift, index) => (
          <Badge key={index} color={shift.color} text={`${shift.name} ${shift.count}人`} className={styles['schedule-calendar__badge']} />
        ))}
      </div>
    )
  }

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  const handleDateSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    setSelectedDate(dateStr)
    setDaySchedules(schedules.filter((s) => new Date(s.scheduleDate).toISOString().split('T')[0] === dateStr))
    setVisible(true)
  }

  const handleBatchAssign = () => { batchForm.resetFields(); setSelectedEmployees([]); setBatchVisible(true) }

  const handleBatchOk = async () => {
    try {
      const values = await batchForm.validate()
      if (!values.dateRange?.length) { Message.error('请选择日期范围'); return }
      if (!selectedEmployees.length) { Message.error('请选择人员'); return }
      await assignSchedule({ userIds: selectedEmployees.map(Number), shiftId: values.shiftId, startDate: values.dateRange[0], endDate: values.dateRange[1] })
      Message.success('批量排班成功')
      setBatchVisible(false); loadSchedules()
    } catch { /* error handled by interceptor */ }
  }

  const handleEdit = (record: ScheduleDetail) => {
    setEditingRecord(record)
    editForm.setFieldsValue({ shiftId: record.shiftId, status: record.status, note: record.note })
    setEditVisible(true)
  }

  const handleEditOk = async () => {
    if (!editingRecord) return
    try { await updateSchedule(editingRecord.id, await editForm.validate()); Message.success('更新成功'); setEditVisible(false); loadSchedules() } catch { /* error handled by interceptor */ }
  }

  const handleDelete = async (id: number) => {
    try { await deleteSchedule(id); Message.success('删除成功'); loadSchedules() } catch { /* error handled by interceptor */ }
  }

  const columns: TableProps<ScheduleDetail>['columns'] = [
    { title: '员工', dataIndex: 'userName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 100 },
    { title: '班次', dataIndex: 'shiftName', width: 100, render: (v, r) => <Tag color={r.shiftColor || 'blue'}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag>{v}</Tag> },
    { title: '备注', dataIndex: 'note' },
    { title: '操作', width: 140, render: (_, r) => (
      <Space size="small">
        <Button type="text" size="small" onClick={() => handleEdit(r)}>编辑</Button>
        <Button type="text" size="small" status="danger" onClick={() => handleDelete(r.id)}>删除</Button>
      </Space>
    )},
  ]

  return (
    <div className={styles['schedule-calendar']}>
      <Card bordered={false} className={styles['schedule-calendar__toolbar']}>
        <PageHeader title="排班日历" description="按月查看员工排班情况，支持批量分配班次。" />
      </Card>

      <Card bordered={false} className={styles['schedule-calendar__toolbar']}>
        <FilterBar
          filters={
            <FormItem label="部门">
              <Select className={styles['schedule-calendar__select-dept']} placeholder="全部部门" value={departmentId} onChange={setDepartmentId} allowClear>
                {departments.map((d) => <Option key={d.id} value={d.id}>{d.name}</Option>)}
              </Select>
            </FormItem>
          }
          onSearch={loadSchedules}
          onReset={() => { setDepartmentId(undefined); loadSchedules() }}
        />
        <div className={styles['schedule-calendar__nav']}>
          <Space size="small">
            <Button icon={<IconLeft />} onClick={handlePrevMonth} />
            <Button type="primary" icon={<IconPlus />} onClick={handleBatchAssign}>批量排班</Button>
            <Button icon={<IconRight />} onClick={handleNextMonth} />
          </Space>
        </div>
      </Card>

      <Card bordered={false}>
        <div className={styles['schedule-calendar__header']}>
          <span>{currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月 排班日历</span>
          <Space size="small">
            {shifts.slice(0, 5).map((s) => <Tag key={s.id} color={s.color || 'blue'}>{s.name}</Tag>)}
          </Space>
        </div>
        <Calendar dateRender={dateCellRender} panel={false} defaultValue={dayjs(currentMonth)} onChange={handleDateSelect} className={styles['schedule-calendar__calendar']} />
      </Card>

      <Modal focusLock title={`当日排班 - ${selectedDate}`} visible={visible} onOk={() => setVisible(false)} onCancel={() => setVisible(false)} footer={null} className={styles['schedule-calendar__modal-large']}>
        <Table columns={columns} data={daySchedules} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
      </Modal>

      <Modal focusLock title="编辑排班" visible={editVisible} onOk={handleEditOk} onCancel={() => setEditVisible(false)} className={styles['schedule-calendar__modal-small']}>
        <Form form={editForm} layout="vertical">
          <FormItem label="班次" field="shiftId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select placeholder="请选择班次">{shifts.map((s) => <Option key={s.id} value={s.id}>{s.name}</Option>)}</Select>
          </FormItem>
          <FormItem label="状态" field="status" initialValue="normal">
            <Select placeholder="请选择状态"><Option value="normal">正常</Option><Option value="leave">请假</Option><Option value="swap">调班</Option><Option value="rest">休息</Option></Select>
          </FormItem>
          <FormItem label="备注" field="note"><Input.TextArea placeholder="请输入备注" rows={3} /></FormItem>
        </Form>
      </Modal>

      <Modal focusLock title="批量排班" visible={batchVisible} onOk={handleBatchOk} onCancel={() => setBatchVisible(false)} className={styles['schedule-calendar__modal-medium']}>
        <Form form={batchForm} layout="vertical">
          <FormItem label="日期范围" field="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}><RangePicker className={styles['schedule-calendar__range-picker']} /></FormItem>
          <FormItem label="班次" field="shiftId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select placeholder="请选择班次">{shifts.map((s) => <Option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</Option>)}</Select>
          </FormItem>
          <FormItem label="选择人员" rules={[{ required: true, message: '请选择人员' }]}>
            <Select mode="multiple" placeholder="请选择人员" value={selectedEmployees} onChange={setSelectedEmployees} className={styles['schedule-calendar__select-employees']}>
              {employees.map((e) => <Option key={String(e.userId || e.id)} value={String(e.userId || e.id)}>{e.user?.realName || e.realName} ({e.employeeNo})</Option>)}
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default CalendarPage
