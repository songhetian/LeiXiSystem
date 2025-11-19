/**
 * 时间处理工具函数
 */

/**
 * 将日期转换为北京时间 (UTC+8) 字符串
 * 用于确保保存到数据库的时间符合北京时区
 * @param {Date|string|number} date - 输入日期，默认为当前时间
 * @returns {string} - 格式化后的日期字符串 'YYYY-MM-DD HH:mm:ss'
 */
function toBeijingTime(date = new Date()) {
  if (!date) return null

  const d = new Date(date)
  if (isNaN(d.getTime())) return null

  // 使用 Intl.DateTimeFormat 获取北京时间部件
  const options = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }

  const formatter = new Intl.DateTimeFormat('zh-CN', options)
  const parts = formatter.formatToParts(d)

  const partMap = {}
  parts.forEach(p => partMap[p.type] = p.value)

  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`
}

/**
 * 获取当前北京时间字符串
 * @returns {string}
 */
function getBeijingNow() {
  return toBeijingTime(new Date())
}

module.exports = {
  toBeijingTime,
  getBeijingNow
}
