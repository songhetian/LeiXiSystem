import { get, post, put, del } from './request'

export interface HolidayList {
  id: number
  name: string
  year: number
  country: string
  isDefault: boolean
  status: string
  _count?: { dates: number }
}

export interface HolidayDate {
  id: number
  holidayListId: number
  date: string
  name: string
  isWorkingDay: boolean
  description?: string
}

export interface HolidayCalendar {
  list: HolidayList
  byMonth: Record<number, HolidayDate[]>
}

// Lists
export function getHolidayLists(params?: any) {
  return get<{ code: number; data: { total: number; list: HolidayList[] } }>('/holidays/lists', params)
}

export function createHolidayList(data: any) {
  return post<{ code: number; data: HolidayList }>('/holidays/lists', data)
}

export function updateHolidayList(id: number, data: any) {
  return put<{ code: number; data: HolidayList }>(`/holidays/lists/${id}`, data)
}

export function deleteHolidayList(id: number) {
  return del<{ code: number }>(`/holidays/lists/${id}`)
}

// Dates
export function getHolidayDates(listId: number) {
  return get<{ code: number; data: HolidayDate[] }>(`/holidays/lists/${listId}/dates`)
}

export function addHolidayDate(listId: number, data: any) {
  return post<{ code: number; data: HolidayDate }>(`/holidays/lists/${listId}/dates`, data)
}

export function batchAddHolidayDates(listId: number, dates: any[]) {
  return post<{ code: number; data: HolidayDate[] }>(`/holidays/lists/${listId}/batch-dates`, { dates })
}

export function updateHolidayDate(dateId: number, data: any) {
  return put<{ code: number; data: HolidayDate }>(`/holidays/dates/${dateId}`, data)
}

export function deleteHolidayDate(dateId: number) {
  return del<{ code: number }>(`/holidays/dates/${dateId}`)
}

// Query
export function checkIsHoliday(date: string, listId?: number) {
  return get<{ code: number; data: { date: string; isHoliday: boolean; isWorkingDay: boolean; isWeekend: boolean; holiday: any } }>('/holidays/is-holiday', { params: { date, listId } })
}

export function getHolidayCalendar(year: number, listId?: number) {
  return get<{ code: number; data: HolidayCalendar }>('/holidays/calendar', { params: { year, listId } })
}
