import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Tag,
  Modal,
  Form,
  Input,
  Message,
  Spin,
  Button,
  Tabs,
  Typography,
} from '@arco-design/web-react'
import {
  IconUp,
  IconDown,
  IconLocation,
  IconClockCircle,
  IconCalendar,
  IconEdit,
  IconLeft,
  IconRight,
  IconRefresh,
  IconCheck,
} from '@arco-design/web-react/icon'
import {
  getTodayClockIn,
  clockIn,
  getClockInCalendar,
  getClockInShifts,
  selectShift,
  type TodayClockInData,
  type CalendarDayItem,
  type ShiftItem,
} from '@/api/clock-in'
import { getSystemSettings } from '@/api/settings'
import styles from './index.module.less'

const { Title, Text } = Typography
const FormItem = Form.Item
const TextArea = Input.TextArea
const TabPane = Tabs.TabPane

const statusTextMap: Record<string, string> = {
  not_scheduled: '今日未排班',
  not_checked_in: '待打卡',
  working: '上班中',
  checked_out: '已下班',
}

const attendanceStatusMap: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  late: { text: '迟到', color: 'orangered' },
  early: { text: '早退', color: 'orangered' },
  late_early: { text: '迟到+早退', color: 'orangered' },
  absent: { text: '旷工', color: 'red' },
  leave: { text: '请假', color: 'arcoblue' },
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
    const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [shifts, setShifts] = useState<ShiftItem[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)
  const [shiftSelectorVisible, setShiftSelectorVisible] = useState(false)
  const [bottomTab, setBottomTab] = useState('calendar')
  const [form] = Form.useForm()
  const [locationCheckEnabled, setLocationCheckEnabled] = useState(true)

  const fetchToday = useCallback(async () => {
    setLoading(true)
    try { 
      const res = await getTodayClockIn()
      setTodayData(res.data)
      if (res.data.schedule?.id) setSelectedShiftId(res.data.schedule.id)
    } finally { 
      setLoading(false) 
    }
  }, [])

  const fetchShifts = useCallback(async () => { 
    try { 
      const res = await getClockInShifts()
      setShifts(res.data) 
    } catch {} 
  }, [])

  const fetchCalendar = useCallback(async (y: number, m: number) => { 
    try { 
      const res = await getClockInCalendar({ year: y, month: m })
      setCalendarData(res.data.days) 
    } catch {} 
  }, [])

  useEffect(() => { 
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t) 
  }, [])

  useEffect(() => { 
    fetchToday()
    fetchShifts()
    fetchCalendar(currentMonth.year, currentMonth.month)
    // 读取位置打卡开关设置
    getSystemSettings().then((settings) => {
      setLocationCheckEnabled(settings.parameters.locationCheckinEnabled)
    })
  }, [])

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { 
      Message.warning('浏览器不支持定位')
      return 
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { 
        setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude })
        setLocationLoading(false) 
      },
      () => { 
        setLocationLoading(false)
        Message.warning('定位失败,请检查权限') 
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => { 
    getLocation() 
  }, [getLocation])

  const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const fmtDate = (d: Date) => {
    const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${w[d.getDay()]}`
  }

  const handleCheckIn = async (type: 'in' | 'out') => {
    let currentLocation = location
    if (!locationCheckEnabled && !location) {
      // 位置打卡关闭时，不强制要求定位
      currentLocation = { latitude: 0, longitude: 0 }
      setLocation(currentLocation)
    } else if (!location) { 
      Message.warning('正在获取位置...')
      getLocation()
      return 
    }
    if (!todayData) return
    if (type === 'in' && !todayData.canCheckIn) { 
      Message.info('已打卡')
      return 
    }
    if (!selectedShiftId) { 
      setShiftSelectorVisible(true)
      Message.warning('请选择班次')
      return 
    }
    try {
      setSubmitting(true)
      const res = await clockIn({ 
        type, 
        latitude: currentLocation!.latitude, 
        longitude: currentLocation!.longitude, 
        shiftId: selectedShiftId,
        skipLocationCheck: !locationCheckEnabled
      })
      if (res.code === 0) { 
        Message.success(type === 'in' ? '上班打卡成功' : '下班打卡成功')
        fetchToday()
        fetchCalendar(currentMonth.year, currentMonth.month) 
      } else if (res.code === 400 && res.message?.includes('不在有效')) { 
        setFieldWorkType(type)
        setFieldWorkVisible(true) 
      } else {
        Message.error(res.message || '打卡失败')
      }
    } catch (err: any) { 
      if (err?.message?.includes('不在有效')) { 
        setFieldWorkType(type)
        setFieldWorkVisible(true) 
      } 
    } finally { 
      setSubmitting(false) 
    }
  }

  const handleFieldWork = async () => {
    if (!fieldWorkReason.trim()) { 
      Message.warning('请填写事由')
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
        shiftId: selectedShiftId || undefined 
      })
      if (res.code === 0) { 
        Message.success('外勤打卡已提交')
        setFieldWorkVisible(false)
        setFieldWorkReason('')
        form.resetFields()
        fetchToday() 
      } else {
        Message.error(res.message || '提交失败')
      }
    } finally { 
      setSubmitting(false) 
    }
  }

  const changeMonth = (d: number) => {
    let { year: y, month: m } = currentMonth
    m += d
    if (m < 1) { m = 12; y -= 1 } else if (m > 12) { m = 1; y += 1 }
    setCurrentMonth({ year: y, month: m })
    fetchCalendar(y, m)
  }

  const getCalendarDays = () => {
    const { year, month } = currentMonth
    const fd = new Date(year, month - 1, 1), ld = new Date(year, month, 0)
    const fw = fd.getDay(), dim = ld.getDate()
    const days: Array<{ day: number; date: string; isCurrentMonth: boolean; data?: CalendarDayItem }> = []
    const pm = new Date(year, month - 1, 0).getDate()
    for (let i = fw - 1; i >= 0; i--) {
      const d = pm - i; let m2 = month - 1, y2 = year
      if (m2 < 1) { m2 = 12; y2 -= 1 }
      const ds = `${y2}-${String(m2).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, date: ds, isCurrentMonth: false, data: calendarData.find((x) => x.date === ds) })
    }
    for (let i = 1; i <= dim; i++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ day: i, date: ds, isCurrentMonth: true, data: calendarData.find((x) => x.date === ds) })
    }
    const rem = 42 - days.length
    for (let i = 1; i <= rem; i++) {
      let m2 = month + 1, y2 = year
      if (m2 > 12) { m2 = 1; y2 += 1 }
      const ds = `${y2}-${String(m2).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ day: i, date: ds, isCurrentMonth: false, data: calendarData.find((x) => x.date === ds) })
    }
    return days
  }

  const isToday = (ds: string) => {
    const t = new Date()
    return ds === `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }

  const dayClass = (d?: CalendarDayItem, cm?: boolean) => {
    if (!cm) return styles['cal-day--other']
    if (!d?.attendance) return d?.isWeekend ? styles['cal-day--rest'] : styles['cal-day--normal']
    return styles[`cal-day--${d.attendance.status}`] || ''
  }

  const dayLabel = (d?: CalendarDayItem, cm?: boolean) => {
    if (!cm) return ''
    if (!d?.attendance) return d?.isWeekend ? '休' : ''
    return attendanceStatusMap[d.attendance.status]?.text || ''
  }

  // 判断当前应该显示上班还是下班按钮
  const shouldCheckIn = !todayData?.firstIn
  const hasShift = !!(todayData?.schedule || selectedShiftId)
  const disabled = !todayData || submitting || !hasShift

  return (
    <div className={styles.page}>
      <Spin loading={loading} style={{ width: '100%' }}>
        {/* 顶部时间区域 */}
        <div className={styles['header-section']}>
          <div className={styles['time-display']}>{fmt(currentTime)}</div>
          <div className={styles['date-display']}>{fmtDate(currentTime)}</div>
          <div className={styles['status-info']}>
            {todayData?.schedule ? (
              <span className={styles['shift-tag']}>
                <IconClockCircle style={{ marginRight: 4 }} />
                {todayData.schedule.shiftName}
              </span>
            ) : (
              <span className={styles['shift-tag']}>未排班</span>
            )}
            <span className={styles['status-tag']}>
              {todayData ? statusTextMap[todayData.status] || todayData.status : '加载中...'}
            </span>
          </div>
        </div>

        {/* 核心打卡按钮区域 */}
        <div className={styles['clock-action-section']}>
          {/* 未排班时显示选择班次按钮 */}
          {!todayData?.schedule && (
            <div className={styles['shift-selector-section']}>
              <Button
                type="primary"
                size="large"
                icon={<IconClockCircle />}
                onClick={() => setShiftSelectorVisible(true)}
                className={styles['shift-selector-button']}
              >
                选择班次
              </Button>
              <div className={styles['shift-selector-hint']}>请先选择班次再打卡</div>
            </div>
          )}

          <div className={styles['clock-button-wrapper']}>
            {shouldCheckIn ? (
              <button
                className={`${styles['clock-button']} ${styles['clock-button--in']}`}
                onClick={() => handleCheckIn('in')}
                disabled={disabled}
              >
                <div className={styles['clock-button__inner']}>
                  <IconUp className={styles['clock-button__icon']} />
                  <div className={styles['clock-button__text']}>上班打卡</div>
                </div>
              </button>
            ) : (
              <button
                className={`${styles['clock-button']} ${styles['clock-button--out']}`}
                onClick={() => handleCheckIn('out')}
                disabled={disabled}
              >
                <div className={styles['clock-button__inner']}>
                  <IconDown className={styles['clock-button__icon']} />
                  <div className={styles['clock-button__text']}>下班打卡</div>
                </div>
              </button>
            )}
          </div>

          {/* 打卡状态显示 */}
          <div className={styles['clock-status']}>
            <div className={styles['clock-status__item']}>
              <div className={styles['clock-status__label']}>上班打卡</div>
              <div className={styles['clock-status__value']}>
                {todayData?.firstIn ? (
                  <>
                    <IconCheck className={styles['clock-status__check']} />
                    {new Date(todayData.firstIn).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : (
                  <span className={styles['clock-status__empty']}>未打卡</span>
                )}
              </div>
            </div>
            <div className={styles['clock-status__divider']} />
            <div className={styles['clock-status__item']}>
              <div className={styles['clock-status__label']}>下班打卡</div>
              <div className={styles['clock-status__value']}>
                {todayData?.lastOut ? (
                  <>
                    <IconCheck className={styles['clock-status__check']} />
                    {new Date(todayData.lastOut).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : (
                  <span className={styles['clock-status__empty']}>未打卡</span>
                )}
              </div>
            </div>
          </div>

          {/* 辅助操作按钮 */}
          <div className={styles['auxiliary-actions']}>
            <Button
              type="text"
              size="small"
              icon={<IconLocation />}
              onClick={() => { setFieldWorkType(shouldCheckIn ? 'in' : 'out'); setFieldWorkVisible(true) }}
              disabled={disabled}
            >
              外勤打卡
            </Button>
            <Button
              type="text"
              size="small"
              icon={<IconEdit />}
              disabled={disabled}
            >
              补卡申请
            </Button>
          </div>

          {/* 定位提示 */}
          <div className={styles['location-hint']}>
            <IconLocation style={{ fontSize: 12 }} />
            <span>打卡范围:公司办公地点 · 定位校验中</span>
          </div>
        </div>

        {/* 底部Tab区域 */}
        <Card bordered={false} className={styles['bottom-card']}>
          <Tabs activeTab={bottomTab} onChange={setBottomTab} className={styles['bottom-tabs']}>
            <TabPane key="calendar" title="考勤日历">
              <div className={styles['cal-hd']}>
                <Button icon={<IconLeft />} shape="circle" type="text" onClick={() => changeMonth(-1)} />
                <Title heading={5} style={{ margin: 0 }}>{currentMonth.year}年{currentMonth.month}月</Title>
                <Button icon={<IconRight />} shape="circle" type="text" onClick={() => changeMonth(1)} />
              </div>
              <div className={styles['cal-grid']}>
                {['日', '一', '二', '三', '四', '五', '六'].map((w) => <div key={w} className={styles['cal-wd']}>{w}</div>)}
                {getCalendarDays().map((d, i) => (
                  <div key={i} className={`${styles['cal-day']} ${dayClass(d.data, d.isCurrentMonth)} ${isToday(d.date) ? styles['cal-day--today'] : ''}`}>
                    <span className={styles['cal-day__n']}>{d.day}</span>
                    {dayLabel(d.data, d.isCurrentMonth) && (
                      <span className={styles['cal-day__l']}>{dayLabel(d.data, d.isCurrentMonth)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles['cal-legend']}>
                {Object.entries(attendanceStatusMap).map(([k, v]) => (
                  <div key={k} className={styles['legend-item']}>
                    <span className={styles['legend-dot']} style={{ background: v.color === 'green' ? '#00B42A' : v.color === 'orangered' ? '#FF7D00' : v.color === 'red' ? '#F53F3F' : v.color === 'arcoblue' ? '#165DFF' : '#86909C' }} />
                    <span className={styles['legend-text']}>{v.text}</span>
                  </div>
                ))}
              </div>
            </TabPane>
            <TabPane key="stats" title="月度统计">
              <div className={styles['stats-section']}>
                <div className={styles['stats-card']}>
                  <div className={styles['stats-card__icon']} style={{ background: 'rgba(0, 180, 42, 0.1)' }}>
                    <IconUp style={{ color: '#00B42A', fontSize: 20 }} />
                  </div>
                  <div className={styles['stats-card__info']}>
                    <div className={styles['stats-card__value']}>
                      {calendarData.filter(d => d.attendance?.status === 'normal').length}
                    </div>
                    <div className={styles['stats-card__label']}>本月出勤</div>
                  </div>
                </div>
                <div className={styles['stats-card']}>
                  <div className={styles['stats-card__icon']} style={{ background: 'rgba(255, 125, 0, 0.1)' }}>
                    <IconClockCircle style={{ color: '#FF7D00', fontSize: 20 }} />
                  </div>
                  <div className={styles['stats-card__info']}>
                    <div className={styles['stats-card__value']}>
                      {calendarData.filter(d => d.attendance?.status === 'late' || d.attendance?.status === 'early').length}
                    </div>
                    <div className={styles['stats-card__label']}>迟到次数</div>
                  </div>
                </div>
                <div className={styles['stats-card']}>
                  <div className={styles['stats-card__icon']} style={{ background: 'rgba(22, 93, 255, 0.1)' }}>
                    <IconCalendar style={{ color: '#165DFF', fontSize: 20 }} />
                  </div>
                  <div className={styles['stats-card__info']}>
                    <div className={styles['stats-card__value']}>
                      {calendarData.filter(d => d.attendance?.status === 'leave').length}
                    </div>
                    <div className={styles['stats-card__label']}>请假天数</div>
                  </div>
                </div>
                <div className={styles['stats-card']}>
                  <div className={styles['stats-card__icon']} style={{ background: 'rgba(245, 63, 63, 0.1)' }}>
                    <IconRefresh style={{ color: '#F53F3F', fontSize: 20 }} />
                  </div>
                  <div className={styles['stats-card__info']}>
                    <div className={styles['stats-card__value']}>
                      {calendarData.filter(d => d.attendance?.status === 'absent' || d.attendance?.status === 'exception').length}
                    </div>
                    <div className={styles['stats-card__label']}>缺卡次数</div>
                  </div>
                </div>
              </div>
            </TabPane>
          </Tabs>
        </Card>

        {/* 打卡记录 */}
        {todayData && todayData.checkins.length > 0 && (
          <Card bordered={false} className={styles['records-card']} title="今日打卡记录">
            {todayData.checkins.map((item) => (
              <div key={item.id} className={styles['rec-item']}>
                <div className={styles['rec-icon']}>{item.type === 'in' ? <IconUp /> : <IconDown />}</div>
                <div className={styles['rec-info']}>
                  <div>{item.type === 'in' ? '上班打卡' : '下班打卡'}{item.source === 'field_work' && <Tag color="orangered" size="small" style={{ marginLeft: 8 }}>外勤</Tag>}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.time).toLocaleTimeString('zh-CN')}{item.address && ` · ${item.address}`}</Text>
                </div>
                <Tag color={item.verified ? 'green' : 'orangered'} size="small">{item.verified ? '已生效' : '待审批'}</Tag>
              </div>
            ))}
          </Card>
        )}
      </Spin>

      <Modal 
        title="外勤打卡" 
        visible={fieldWorkVisible} 
        onOk={handleFieldWork} 
        onCancel={() => setFieldWorkVisible(false)} 
        confirmLoading={submitting} 
        okText="提交" 
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem label="类型">
            <Tag color={fieldWorkType === 'in' ? 'green' : 'arcoblue'}>
              {fieldWorkType === 'in' ? '上班外勤' : '下班外勤'}
            </Tag>
          </FormItem>
          <FormItem label="事由" field="reason" rules={[{ required: true, message: '请填写事由' }]}>
            <TextArea 
              placeholder="请填写外勤事由" 
              value={fieldWorkReason} 
              onChange={(v) => setFieldWorkReason(v)} 
              style={{ minHeight: 100 }} 
              maxLength={500} 
            />
          </FormItem>
          <Text type="secondary" style={{ fontSize: 12 }}>外勤打卡需审批通过后才生效</Text>
        </Form>
      </Modal>

      <Modal 
        title="选择班次" 
        visible={shiftSelectorVisible} 
        onOk={async () => { 
          if (!selectedShiftId) {
            Message.warning('请选择班次')
            return
          }
          try {
            setSubmitting(true)
            const res = await selectShift(selectedShiftId)
            if (res.code === 0) {
              Message.success('班次选择成功')
              setShiftSelectorVisible(false)
              fetchToday()
              fetchCalendar(currentMonth.year, currentMonth.month)
            } else {
              Message.error(res.message || '班次选择失败')
            }
          } catch (err: any) {
            Message.error(err?.message || '班次选择失败')
          } finally {
            setSubmitting(false)
          }
        }} 
        onCancel={() => setShiftSelectorVisible(false)} 
        okText="确认" 
        cancelText="取消"
        confirmLoading={submitting}
      >
        <div className={styles['shift-list']}>
          {shifts.map((s) => (
            <div 
              key={s.id} 
              className={`${styles['shift-item']} ${selectedShiftId === s.id ? styles['shift-item--active'] : ''}`} 
              onClick={() => setSelectedShiftId(s.id)}
            >
              <div className={styles['shift-item__n']}>
                <span className={styles['shift-dot']} style={{ background: s.color || 'rgb(var(--primary-6))' }} />
                {s.name}
                {selectedShiftId === s.id && <Tag color="green" size="small" style={{ marginLeft: 8 }}>已选</Tag>}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IconClockCircle style={{ marginRight: 4 }} />
                {s.startTime} - {s.endTime} · {s.workHours}h
              </Text>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default ClockInPage
