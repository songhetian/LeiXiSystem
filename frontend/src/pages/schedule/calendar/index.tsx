import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Calendar,
  Badge,
  Input,
  DatePicker,
  Table,
} from '@arco-design/web-react'
import {
  IconLeft,
  IconRight,
  IconPlus,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getScheduleCalendar, assignSchedule, updateSchedule, deleteSchedule } from '@/api/schedule'
import { getShifts, Shift } from '@/api/shift'
import { getDepartmentsList, Department } from '@/api/organization'
import { getEmployees, Employee } from '@/api/personnel'
import dayjs, { Dayjs } from 'dayjs'
import './style.css'

const FormItem = Form.Item
const Option = Select.Option
const RangePicker = DatePicker.RangePicker

interface ScheduleDay {
  date: string
  shifts: { name: string; color: string; count: number }[]
}

interface ScheduleDetail {
  id: number
  userId: number
  userName: string
  departmentName?: string
  shiftId: number
  shiftName: string
  shiftColor?: string
  scheduleDate: string
  status: string
  note?: string
}

function getMonthRange(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0)
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay.getDate()}`
  return { startDate, endDate }
}

function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [schedules, setSchedules] = useState<ScheduleDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [form] = Form.useForm()
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
      const res = await getEmployees({ page: 1, pageSize: 100, status: 'active', departmentId })
      setEmployees(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [departmentId])

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getMonthRange(currentMonth)
      const res = await getScheduleCalendar({
        startDate,
        endDate,
        departmentId,
      })
      setSchedules(res.data || [])
    } catch {
        // error handled by interceptor
      } finally {
      setLoading(false)
    }
  }, [currentMonth, departmentId])

  useEffect(() => {
    loadDepartments()
    loadShifts()
  }, [loadDepartments, loadShifts])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const calendarData = useMemo(() => {
    const map: Record<string, ScheduleDay> = {}
    schedules.forEach((s) => {
      const dateStr = new Date(s.scheduleDate).toISOString().split('T')[0]
      if (!map[dateStr]) {
        map[dateStr] = { date: dateStr, shifts: [] }
      }
      const existing = map[dateStr].shifts.find((sh) => sh.name === s.shiftName)
      if (existing) {
        existing.count += 1
      } else {
        map[dateStr].shifts.push({
          name: s.shiftName,
          color: s.shiftColor || 'blue',
          count: 1,
        })
      }
    })
    return map
  }, [schedules])

  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayData = calendarData[dateStr]

    if (!dayData || dayData.shifts.length === 0) return null

    return (
      <div className="schedule-calendar__cell">
        {dayData.shifts.map((shift, index) => (
          <Badge
            key={index}
            color={shift.color}
            text={`${shift.name} ${shift.count}人`}
            className="schedule-calendar__badge"
          />
        ))}
      </div>
    )
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDateSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    setSelectedDate(dateStr)
    const dayList = schedules.filter((s) => {
      const sDate = new Date(s.scheduleDate).toISOString().split('T')[0]
      return sDate === dateStr
    })
    setDaySchedules(dayList)
    setVisible(true)
  }

  const handleBatchAssign = () => {
    batchForm.resetFields()
    setSelectedEmployees([])
    setBatchVisible(true)
  }

  const handleBatchOk = async () => {
    try {
      const values = await batchForm.validate()
      const dateRange = values.dateRange
      if (!dateRange || dateRange.length !== 2) {
        Message.error('请选择日期范围')
        return
      }
      if (selectedEmployees.length === 0) {
        Message.error('请选择人员')
        return
      }
      await assignSchedule({
        userIds: selectedEmployees.map(Number),
        shiftId: values.shiftId,
        startDate: dateRange[0],
        endDate: dateRange[1],
      })
      Message.success('批量排班成功')
      setBatchVisible(false)
      loadSchedules()
    } catch {
      // error handled by interceptor
    }
  }

  const handleEdit = (record: ScheduleDetail) => {
    setEditingRecord(record)
    editForm.setFieldsValue({
      shiftId: record.shiftId,
      status: record.status,
      note: record.note,
    })
    setEditVisible(true)
  }

  const handleEditOk = async () => {
    if (!editingRecord) return
    try {
      const values = await editForm.validate()
      await updateSchedule(editingRecord.id, values)
      Message.success('更新成功')
      setEditVisible(false)
      loadSchedules()
    } catch {
      // error handled by interceptor
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id)
      Message.success('删除成功')
      loadSchedules()
    } catch {
      // error handled by interceptor
    }
  }

  const columns: TableProps<ScheduleDetail>['columns'] = [
    {
      title: '员工',
      dataIndex: 'userName',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 100,
    },
    {
      title: '班次',
      dataIndex: 'shiftName',
      width: 100,
      render: (value: string, record: ScheduleDetail) => (
        <Tag color={record.shiftColor || 'blue'}>{value}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'note',
    },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, record: ScheduleDetail) => (
        <Space size="small">
          <Button type="text" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" size="small" status="danger" onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="schedule-calendar">
      <Card bordered={false} className="schedule-calendar__toolbar">
        <Form layout="inline">
          <FormItem label="部门">
            <Select
              className="schedule-calendar__select-dept"
              placeholder="全部部门"
              value={departmentId}
              onChange={setDepartmentId}
              allowClear
            >
              {departments.map((dept) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button icon={<IconLeft />} onClick={handlePrevMonth} />
              <Button type="primary" icon={<IconPlus />} onClick={handleBatchAssign}>
                批量排班
              </Button>
              <Button icon={<IconRight />} onClick={handleNextMonth} />
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div className="schedule-calendar__header">
          <span className="schedule-calendar__title">
            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月 排班日历
          </span>
          <Space size="small">
            {shifts.slice(0, 5).map((shift) => (
              <Tag key={shift.id} color={shift.color || 'blue'}>
                {shift.name}
              </Tag>
            ))}
          </Space>
        </div>

        <Calendar
          dateRender={dateCellRender}
          panel={false}
          defaultValue={dayjs(currentMonth)}
          onChange={handleDateSelect}
          className="schedule-calendar__calendar"
        />
      </Card>

      <Modal
        title={`当日排班 - ${selectedDate}`}
        visible={visible}
        onOk={() => setVisible(false)}
        onCancel={() => setVisible(false)}
        className="schedule-calendar__modal-large"
        footer={null}
      >
        <Table
          columns={columns}
          data={daySchedules}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Modal>

      <Modal
        title="编辑排班"
        visible={editVisible}
        onOk={handleEditOk}
        onCancel={() => setEditVisible(false)}
        className="schedule-calendar__modal-small"
      >
        <Form form={editForm} layout="vertical">
          <FormItem label="班次" field="shiftId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select placeholder="请选择班次">
              {shifts.map((shift) => (
                <Option key={shift.id} value={shift.id}>
                  {shift.name}
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="状态" field="status" initialValue="normal">
            <Select placeholder="请选择状态">
              <Option value="normal">正常</Option>
              <Option value="leave">请假</Option>
              <Option value="swap">调班</Option>
              <Option value="rest">休息</Option>
            </Select>
          </FormItem>
          <FormItem label="备注" field="note">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title="批量排班"
        visible={batchVisible}
        onOk={handleBatchOk}
        onCancel={() => setBatchVisible(false)}
        className="schedule-calendar__modal-medium"
      >
        <Form form={batchForm} layout="vertical">
          <FormItem label="日期范围" field="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker className="schedule-calendar__range-picker" />
          </FormItem>
          <FormItem label="班次" field="shiftId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select placeholder="请选择班次">
              {shifts.map((shift) => (
                <Option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.startTime} - {shift.endTime})
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="选择人员" rules={[{ required: true, message: '请选择人员' }]}>
            <Select
              mode="multiple"
              placeholder="请选择人员"
              value={selectedEmployees}
              onChange={setSelectedEmployees}
              className="schedule-calendar__select-employees"
            >
              {employees.map((emp) => (
                <Option key={String(emp.userId || emp.id)} value={String(emp.userId || emp.id)}>
                  {emp.user?.realName || emp.realName} ({emp.employeeNo})
                </Option>
              ))}
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default CalendarPage
