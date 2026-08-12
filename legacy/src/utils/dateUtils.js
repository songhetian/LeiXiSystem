/**
 * 统一日期处理工具函数
 * 解决时区不一致问题，提供统一的日期格式化和解析API
 */

/**
 * 安全解析日期字符串，避免时区问题
 * @param {string|Date} dateInput - 日期输入
 * @returns {Date|null} - 解析后的日期对象
 */
export const parseDate = (dateInput) => {
  if (!dateInput) return null
  if (dateInput instanceof Date) return dateInput

  // 如果是纯日期格式 YYYY-MM-DD，手动构造本地日期
  const dateOnlyMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // 其他格式使用标准解析
  const date = new Date(dateInput)
  return isNaN(date.getTime()) ? null : date
}

/**
 * 仅格式化日期部分（YYYY-MM-DD），避免时区转换
 * @param {string|Date} dateInput - 日期输入
 * @returns {string} - 格式化后的日期字符串
 */
export const formatDateOnly = (dateInput) => {
  if (!dateInput) return '-'

  // 如果是字符串，尝试直接提取日期部分
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`
    }
  }

  // 否则解析为日期对象
  const date = parseDate(dateInput)
  if (!date) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化日期时间（YYYY-MM-DD HH:mm:ss）
 * @param {string|Date} dateInput - 日期输入
 * @returns {string} - 格式化后的日期时间字符串
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '-'

  const date = parseDate(dateInput)
  if (!date) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化日期时间（不含秒）
 * @param {string|Date} dateInput - 日期输入
 * @returns {string} - 格式化后的日期时间字符串
 */
export const formatDateTimeShort = (dateInput) => {
  if (!dateInput) return '-'

  const date = parseDate(dateInput)
  if (!date) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 格式化为友好的相对时间
 * @param {string|Date} dateInput - 日期输入
 * @returns {string} - 相对时间字符串
 */
export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '-'

  const date = parseDate(dateInput)
  if (!date) return '-'

  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`

  return formatDateOnly(date)
}

/**
 * 转换为本地日期对象（去除时间部分）
 * @param {string|Date} dateInput - 日期输入
 * @returns {Date|null} - 本地日期对象
 */
export const toLocalDate = (dateInput) => {
  const date = parseDate(dateInput)
  if (!date) return null

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * 检查两个日期是否是同一天
 * @param {string|Date} date1 - 日期1
 * @param {string|Date} date2 - 日期2
 * @returns {boolean} - 是否同一天
 */
export const isSameDay = (date1, date2) => {
  const d1 = parseDate(date1)
  const d2 = parseDate(date2)
  if (!d1 || !d2) return false

  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

/**
 * 兼容旧的 formatDate 函数
 * @deprecated 请使用 formatDateOnly 或 formatDateTime
 */
export const formatDate = (dateInput, includeTime = false) => {
  return includeTime ? formatDateTime(dateInput) : formatDateOnly(dateInput)
}

// 默认导出
export default {
  parseDate,
  formatDateOnly,
  formatDateTime,
  formatDateTimeShort,
  formatRelativeTime,
  toLocalDate,
  isSameDay,
  formatDate
}
