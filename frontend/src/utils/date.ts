import dayjs from 'dayjs'

export function formatDate(date: Date | string | number, format = 'YYYY-MM-DD') {
  return dayjs(date).format(format)
}

export function formatDateTime(date: Date | string | number, format = 'YYYY-MM-DD HH:mm:ss') {
  return dayjs(date).format(format)
}

export function formatTime(date: Date | string | number, format = 'HH:mm:ss') {
  return dayjs(date).format(format)
}

export function getToday(format = 'YYYY-MM-DD') {
  return dayjs().format(format)
}
