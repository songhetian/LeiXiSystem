import { get, post } from './request'

export interface ShiftItem {
  id: number
  name: string
  code: string
  startTime: string
  endTime: string
  workHours: number
  lateGraceMinutes: number
  earlyGraceMinutes: number
  color?: string
  description?: string
}

export interface CheckinRecord {
  id: number
  type: string
  time: string
  source: string
  verified: boolean
  address?: string
  latitude?: number
  longitude?: number
  shiftId?: number
  shiftName?: string
}

export interface TodaySchedule {
  id: number
  shiftName: string
  startTime: string
  endTime: string
  lateGraceMinutes: number
  earlyGraceMinutes: number
  isManual?: boolean
}

export interface TodayAttendance {
  status: string
  workMinutes: number
  lateMinutes: number
  earlyMinutes: number
  absentMinutes: number
}

export interface TodayClockInData {
  date: string
  schedule: TodaySchedule | null
  daily: TodayAttendance | null
  checkins: CheckinRecord[]
  firstIn: string | null
  lastOut: string | null
  canCheckIn: boolean
  canCheckOut: boolean
  status: string
  fieldWorkPending: boolean
}

export interface MonthlyStatsSummary {
  expectedWorkDays: number
  actualWorkDays: number
  paidLeaveDays: number
  absentDays: number
  lateCount: number
  earlyCount: number
  missingCheckinCount: number
  overtimeMinutes: number
  status: string
}

export interface CalendarDayItem {
  date: string
  weekday: number
  isWeekend: boolean
  schedule: {
    shiftName: string
    startTime: string
    endTime: string
  } | null
  attendance: {
    status: string
    firstIn: string | null
    lastOut: string | null
    workMinutes: number
    lateMinutes: number
    earlyMinutes: number
    absentMinutes: number
  } | null
  exceptions: Array<{
    type: string
    status: string
    reason: string
  }>
}

export function clockIn(data: {
  type: 'in' | 'out'
  latitude?: number
  longitude?: number
  location?: string
  isFieldWork?: boolean
  fieldWorkReason?: string
  photoUrl?: string
  shiftId?: number
  skipLocationCheck?: boolean
}) {
  return post<{
    code: number
    message: string
    data: {
      checkin: any
      daily: any
      isFieldWork: boolean
      locationValid: boolean
    }
  }>('/attendance/clock-in', data)
}

export function getTodayClockIn() {
  return get<{
    code: number
    data: TodayClockInData
  }>('/attendance/clock-in/today')
}

export function getClockInShifts() {
  return get<{
    code: number
    data: ShiftItem[]
  }>('/attendance/clock-in/shifts')
}

export function getMonthlyClockInStats(params?: { year?: number; month?: number }) {
  return get<{
    code: number
    data: {
      year: number
      month: number
      summary: MonthlyStatsSummary
      calendar: Array<{
        date: string
        status: string
        firstIn: string | null
        lastOut: string | null
        workMinutes: number
        lateMinutes: number
        earlyMinutes: number
      }>
    }
  }>('/attendance/clock-in/monthly-stats', { params })
}

export function getClockInCalendar(params?: { year?: number; month?: number }) {
  return get<{
    code: number
    data: {
      year: number
      month: number
      days: CalendarDayItem[]
    }
  }>('/attendance/clock-in/calendar', { params })
}

export function selectShift(shiftId: number) {
  return post<{
    code: number
    message: string
    data: {
      shiftId: number
      shiftName: string
    }
  }>('/attendance/clock-in/select-shift', { shiftId })
}
