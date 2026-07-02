import { useState, useEffect, useCallback } from 'react'
import styles from './index.module.css'
import {
  Card,
  Tag,
  Modal,
  Form,
  Input,
  Message,
  Spin,
  Button,
  Grid,
  Select,
  Tooltip,
} from '@arco-design/web-react'
import {
  IconUp,
  IconDown,
  IconLocation,
  IconClockCircle,
  IconCalendar,
  IconUser,
  IconEdit,
} from '@arco-design/web-react/icon'
import {
  getTodayClockIn,
  clockIn,
  getClockInCalendar,
  getClockInShifts,
  type TodayClockInData,
  type CalendarDayItem,
  type ShiftItem,
} from '@/api/clock-in'

const { Row, Col } = Grid
const FormItem = Form.Item
const TextArea = Input.TextArea

const statusTextMap: Record<string, string> = {
  not_scheduled: '今日未排班',
  not_checked_in: '待打卡',
  working: '上班中',
  checked_out: '已下班',
}

const attendanceStatusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orange' },
  early: { text: '早退', color: 'orange' },
  late_early: { text: '迟到+早退', color: 'orange' },
  absent: { text: '旷工', color: 'red' },
  leave: { text: '请假', color: 'blue' },
  exception: { text: '异常', color: 'red' },
  rest: { text: '休息', color: 'gray' },
}

function ClockInPage() {
  const [todayData, setTodayData] = useState<TodayClockInData | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [fieldWorkVisible, setFieldWorkVisible] = useState(false)
  const [fieldWorkType, setFieldWorkType] = useState<'in' | 'out'>('in')
  const [fieldWorkReason, setFieldWorkReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [calendarData, setCalendarData] = useState<CalendarDayItem[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [shifts, setShifts] = useState<ShiftItem[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)
  const [shiftSelectorVisible, setShiftSelectorVisible] = useState(false)
  const [form] = Form.useForm()

  const fetchToday = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTodayClockIn()
      setTodayData(res.data)
      if (res.data.schedule?.id) {
        setSelectedShiftId(res.data.schedule.id)
      }
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchShifts = useCallback(async () => {
    try {
      const res = await getClockInShifts()
      setShifts(res.data)
    } catch {
      // error handled by interceptor
    }
  }, [])

  const fetchCalendar = useCallback(async (year: number, month: number) => {
    try {
      const res = await getClockInCalendar({ year, month })
      setCalendarData(res.data.days)
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchToday()
    fetchShifts()
    fetchCalendar(currentMonth.year, currentMonth.month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      Message.warning('浏览器不支持定位功能')
      return
    }

    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationLoading(false)
      },
      (error) => {
        console.error('定位失败:', error)
        setLocationLoading(false)
        Message.warning('定位失败，请检查浏览器定位权限')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => {
    getLocation()
  }, [getLocation])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
  }

  const handleCheckIn = async (type: 'in' | 'out') => {
    if (!location) {
      Message.warning('正在获取位置信息，请稍候...')
      getLocation()
      return
    }

    if (!todayData) return

    if (type === 'in' && !todayData.canCheckIn) {
      Message.info('今天已打过上班卡')
      return
    }

    if (!selectedShiftId) {
      setShiftSelectorVisible(true)
      Message.warning('请先选择班次')
      return
    }

    try {
      setSubmitting(true)
      const res = await clockIn({
        type,
        latitude: location.latitude,
        longitude: location.longitude,
        shiftId: selectedShiftId,
      })

      if (res.code === 0) {
        Message.success(type === 'in' ? '上班打卡成功' : '下班打卡成功')
        fetchToday()
        fetchCalendar(currentMonth.year, currentMonth.month)
      } else if (res.code === 400 && res.message?.includes('不在有效打卡范围')) {
        setFieldWorkType(type)
        setFieldWorkVisible(true)
      } else {
        Message.error(res.message || '打卡失败')
      }
    } catch (err: any) {
      if (err?.message?.includes('不在有效打卡范围')) {
        setFieldWorkType(type)
        setFieldWorkVisible(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleFieldWork = async () => {
    if (!fieldWorkReason.trim()) {
      Message.warning('请填写外勤事由')
      return
    }

    if (!location) return

    try {
      setSubmitting(true)
      const res = await clockIn({
        type: fieldWorkType,
        latitude: location.latitude,
        longitude: location.longitude,
        isFieldWork: true,
        fieldWorkReason: fieldWorkReason.trim(),
        shiftId: selectedShiftId || undefined,
      })

      if (res.code === 0) {
        Message.success('外勤打卡申请已提交，请等待审批')
        setFieldWorkVisible(false)
        setFieldWorkReason('')
        form.resetFields()
        fetchToday()
      } else {
        Message.error(res.message || '提交失败')
      }
    } catch {
      // error handled by interceptor
    } finally {
      setSubmitting(false)
    }
  }

  const changeMonth = (delta: number) => {
    let { year, month } = currentMonth
    month += delta
    if (month < 1) {
      month = 12
      year -= 1
    } else if (month > 12) {
      month = 1
      year += 1
    }
    setCurrentMonth({ year, month })
    fetchCalendar(year, month)
  }

  const getCalendarDays = () => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const firstWeekday = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: Array<{ day: number; date: string; isCurrentMonth: boolean; data?: CalendarDayItem }> = []

    const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i
      let prevMonth = month - 1
      let prevYear = year
      if (prevMonth < 1) { prevMonth = 12; prevYear -= 1 }
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayData = calendarData.find((d) => d.date === dateStr)
      days.push({ day, date: dateStr, isCurrentMonth: false, data: dayData })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const dayData = calendarData.find((d) => d.date === dateStr)
      days.push({ day: i, date: dateStr, isCurrentMonth: true, data: dayData })
    }

    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      let nextMonth = month + 1
      let nextYear = year
      if (nextMonth > 12) { nextMonth = 1; nextYear += 1 }
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const dayData = calendarData.find((d) => d.date === dateStr)
      days.push({ day: i, date: dateStr, isCurrentMonth: false, data: dayData })
    }

    return days
  }

  const isToday = (dateStr: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return dateStr === todayStr
  }

  const getDayStatusClass = (data?: CalendarDayItem, isCurrentMonth?: boolean) => {
    if (!isCurrentMonth) return ''
    if (!data?.attendance) {
      return data?.isWeekend ? 'clock-in-calendar__day--weekend' : ''
    }
    const status = data.attendance.status
    return `clock-in-calendar__day--${status}`
  }

  const getDayStatusText = (data?: CalendarDayItem, isCurrentMonth?: boolean) => {
    if (!isCurrentMonth) return ''
    if (!data?.attendance) {
      return data?.isWeekend ? '休' : '班'
    }
    const info = attendanceStatusMap[data.attendance.status]
    return info?.text || data.attendance.status
  }

  const todayStr = formatDate(currentTime)
  const timeStr = formatTime(currentTime)
  const statusText = todayData ? statusTextMap[todayData.status] || todayData.status : '加载中...'

  const statsItems = [
    { label: '出勤天数', value: todayData ? 0 : 0, className: 'clock-in-stats__value--normal' },
    { label: '迟到', value: todayData ? 0 : 0, className: 'clock-in-stats__value--late' },
    { label: '早退', value: todayData ? 0 : 0, className: 'clock-in-stats__value--late' },
    { label: '旷工', value: todayData ? 0 : 0, className: 'clock-in-stats__value--absent' },
  ]

  return (
    <div className={styles['clock-in-page']}>
      <Spin loading={loading} style={{ width: '100%' }}>
        <div className={styles['clock-in-hero']}>
          <div className={styles['clock-in-hero__header']}>
            <div className={styles['clock-in-hero__date']}>{todayStr}</div>
            <div className={styles['clock-in-hero__time']}>{timeStr}</div>
            <div className={styles['clock-in-hero__status']}>
              <IconClockCircle />
              <span>{statusText}</span>
            </div>
          </div>

          {todayData?.schedule ? (
            <div className={styles['clock-in-hero__shift']}>
              <div className={styles['clock-in-hero__shift-header']}>
                <span className={styles['clock-in-hero__shift-label']}>
                  {todayData.schedule.isManual ? '自选班次' : '今日班次'}
                </span>
                {!todayData.firstIn && (
                  <Tooltip content="切换班次">
                    <Button
                      size="mini"
                      type="text"
                      icon={<IconEdit />}
                      onClick={() => setShiftSelectorVisible(true)}
                      style={{ color: '#fff' }}
                    />
                  </Tooltip>
                )}
              </div>
              <div className={styles['clock-in-hero__shift-item']}>
                <span className={styles['clock-in-hero__shift-label']}>班次名称</span>
                <span className={styles['clock-in-hero__shift-value']}>{todayData.schedule.shiftName}</span>
              </div>
              <div className={styles['clock-in-hero__shift-item']}>
                <span className={styles['clock-in-hero__shift-label']}>上班时间</span>
                <span className={styles['clock-in-hero__shift-value']}>{todayData.schedule.startTime}</span>
              </div>
              <div className={styles['clock-in-hero__shift-item']}>
                <span className={styles['clock-in-hero__shift-label']}>下班时间</span>
                <span className={styles['clock-in-hero__shift-value']}>{todayData.schedule.endTime}</span>
              </div>
            </div>
          ) : (
            <div className={styles['clock-in-hero__shift']}>
              <div
                className={styles['clock-in-hero__shift-select']}
                onClick={() => setShiftSelectorVisible(true)}
              >
                <IconCalendar style={{ marginRight: 8 }} />
                <span>请选择今日班次</span>
                <span style={{ marginLeft: 'auto', opacity: 0.7 }}>选择 →</span>
              </div>
            </div>
          )}

          <div className={styles['clock-in-location']}>
            <IconLocation className={styles['clock-in-location__icon']} />
            <span className={styles['clock-in-location__text']}>
              {locationLoading ? '正在定位...' : location ? `已获取位置 (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})` : '未获取到位置信息'}
            </span>
            <Button size="mini" type="outline" onClick={getLocation} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
              刷新定位
            </Button>
          </div>
        </div>

        <div className={styles['clock-in-buttons']}>
          <button
            className={`${styles['clock-in-btn']} ${styles['clock-in-btn--in']} ${todayData && !todayData.canCheckIn ? styles['clock-in-btn--disabled'] : ''}`}
            onClick={() => handleCheckIn('in')}
            disabled={submitting || !todayData || !todayData.canCheckIn}
          >
            {todayData && todayData.canCheckIn && <div className={styles['clock-in-btn__pulse']} />}
            <IconUp className={styles['clock-in-btn__icon']} />
            <span className={styles['clock-in-btn__text']}>
              {todayData?.firstIn ? '已上班' : '上班打卡'}
            </span>
            {todayData?.firstIn && (
              <span className={styles['clock-in-btn__time']}>
                {new Date(todayData.firstIn).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>

          <button
            className={`${styles['clock-in-btn']} ${styles['clock-in-btn--out']} ${todayData && !todayData.canCheckOut ? styles['clock-in-btn--disabled'] : ''}`}
            onClick={() => handleCheckIn('out')}
            disabled={submitting || !todayData || !todayData.canCheckOut}
          >
            {todayData?.canCheckOut && !todayData.lastOut && <div className={styles['clock-in-btn__pulse']} />}
            <IconDown className={styles['clock-in-btn__icon']} />
            <span className={styles['clock-in-btn__text']}>
              {todayData?.lastOut ? '已下班' : '下班打卡'}
            </span>
            {todayData?.lastOut && (
              <span className={styles['clock-in-btn__time']}>
                {new Date(todayData.lastOut).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>
        </div>

        {todayData && todayData.checkins.length > 0 && (
          <Card bordered={false} className={styles['clock-in-today']}>
            <div className={styles['clock-in-today__title']}>今日打卡记录</div>
            <div className={styles['clock-in-today__list']}>
              {todayData.checkins.map((item) => (
                <div key={item.id} className={styles['clock-in-today__item']}>
                  <div className={`${styles['clock-in-today__item-icon']} ${item.type === 'in' ? styles['clock-in-today__item-icon--in'] : item.source === 'field_work' ? styles['clock-in-today__item-icon--field'] : styles['clock-in-today__item-icon--out']}`}>
                    {item.type === 'in' ? <IconUp /> : <IconDown />}
                  </div>
                  <div className={styles['clock-in-today__item-content']}>
                    <div className={styles['clock-in-today__item-type']}>
                      {item.type === 'in' ? '上班打卡' : '下班打卡'}
                      {item.source === 'field_work' && <Tag color="orange" style={{ marginLeft: 8 }}>外勤</Tag>}
                    </div>
                    <div className={styles['clock-in-today__item-time']}>
                      {new Date(item.time).toLocaleTimeString('zh-CN')}
                      {item.address && ` · ${item.address}`}
                    </div>
                  </div>
                  <div className={styles['clock-in-today__item-status']}>
                    {item.verified ? <Tag color="green">已生效</Tag> : <Tag color="orange">待审批</Tag>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card bordered={false} className={styles['clock-in-calendar']}>
          <div className={styles['clock-in-calendar__header']}>
            <div className={styles['clock-in-calendar__title']}>
              <IconCalendar style={{ marginRight: 8 }} />
              考勤日历
            </div>
            <div className={styles['clock-in-calendar__nav']}>
              <button className={styles['clock-in-calendar__nav-btn']} onClick={() => changeMonth(-1)}>{'<'}</button>
              <span className={styles['clock-in-calendar__month']}>{currentMonth.year}年{currentMonth.month}月</span>
              <button className={styles['clock-in-calendar__nav-btn']} onClick={() => changeMonth(1)}>{'>'}</button>
            </div>
          </div>

          <div className={styles['clock-in-calendar__weekdays']}>
            {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
              <div key={w} className={styles['clock-in-calendar__weekday']}>{w}</div>
            ))}
          </div>

          <div className={styles['clock-in-calendar__days']}>
            {getCalendarDays().map((day, index) => (
              <div
                key={index}
                className={`${styles['clock-in-calendar__day']} ${styles[getDayStatusClass(day.data, day.isCurrentMonth)]} ${!day.isCurrentMonth ? styles['clock-in-calendar__day--other-month'] : ''} ${isToday(day.date) ? styles['clock-in-calendar__day--today'] : ''}`}
              >
                <span className={styles['clock-in-calendar__day-number']}>{day.day}</span>
                <span className={styles['clock-in-calendar__day-status']}>
                  {getDayStatusText(day.data, day.isCurrentMonth)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { text: '正常', color: '#00B42A' },
              { text: '迟到/早退', color: '#FF7D00' },
              { text: '旷工/异常', color: '#F53F3F' },
              { text: '请假', color: '#165DFF' },
              { text: '休息', color: '#86909C' },
            ].map((item) => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#86909c' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                {item.text}
              </div>
            ))}
          </div>
        </Card>
      </Spin>

      <Modal
        title="外勤打卡"
        visible={fieldWorkVisible}
        onOk={handleFieldWork}
        onCancel={() => setFieldWorkVisible(false)}
        confirmLoading={submitting}
        okText="提交申请"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem label="打卡类型">
            <Tag color={fieldWorkType === 'in' ? 'green' : 'blue'}>
              {fieldWorkType === 'in' ? '上班外勤打卡' : '下班外勤打卡'}
            </Tag>
          </FormItem>
          <FormItem label="外勤事由" field="reason" rules={[{ required: true, message: '请填写外勤事由' }]}>
            <TextArea
              placeholder="请填写外勤事由，如：客户拜访、外出办事等"
              value={fieldWorkReason}
              onChange={(v) => setFieldWorkReason(v)}
              style={{ minHeight: 100 }}
              maxLength={500}
            />
          </FormItem>
          <div style={{ fontSize: 12, color: '#86909c', marginTop: -8 }}>
            提示：外勤打卡需审批通过后才生效，审批通过后将正常计入考勤
          </div>
        </Form>
      </Modal>

      <Modal
        title="选择班次"
        visible={shiftSelectorVisible}
        onOk={() => {
          if (selectedShiftId) {
            setShiftSelectorVisible(false)
          } else {
            Message.warning('请选择一个班次')
          }
        }}
        onCancel={() => setShiftSelectorVisible(false)}
        okText="确认选择"
        cancelText="取消"
      >
        <div className={styles['shift-selector']}>
          <p className={styles['shift-selector__tip']}>
            请选择今日打卡使用的班次，选择后当天的考勤将按此次班计算。
          </p>
          <div className={styles['shift-selector__list']}>
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className={`${styles['shift-selector__item']} ${selectedShiftId === shift.id ? styles['shift-selector__item--active'] : ''}`}
                onClick={() => setSelectedShiftId(shift.id)}
              >
                <div className={styles['shift-selector__item-header']}>
                  <span
                    className={styles['shift-selector__item-dot']}
                    style={{ background: shift.color || '#165dff' }}
                  />
                  <span className={styles['shift-selector__item-name']}>{shift.name}</span>
                  {selectedShiftId === shift.id && (
                    <Tag color="green" size="small">已选</Tag>
                  )}
                </div>
                <div className={styles['shift-selector__item-time']}>
                  <IconClockCircle style={{ marginRight: 6, fontSize: 14 }} />
                  {shift.startTime} - {shift.endTime}
                  <span style={{ marginLeft: 12, color: '#86909c', fontSize: 12 }}>
                    工时 {shift.workHours}h
                  </span>
                </div>
                {shift.description && (
                  <div className={styles['shift-selector__item-desc']}>
                    {shift.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ClockInPage
