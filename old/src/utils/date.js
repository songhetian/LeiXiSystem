export const formatDate = (dateInput, includeTime = false) => {
  if (!dateInput) return '-'

  // 特殊处理：对于数据库中的纯日期字段（如调休申请的日期）
  // 这些字段在JSON序列化后会变成Date对象，但我们应该把它们当作纯日期处理
  if (dateInput instanceof Date && !includeTime) {
    // 对于Date对象且只要求日期部分，直接使用getFullYear/getMonth/getDate
    // 这样可以避免时区转换导致的日期偏差
    const year = dateInput.getFullYear()
    const month = String(dateInput.getMonth() + 1).padStart(2, '0')
    const day = String(dateInput.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 如果是字符串，尝试直接提取日期部分（避免时区问题）
  if (typeof dateInput === 'string') {
    // 匹配 YYYY-MM-DD 格式（可能后面跟着时间）
    const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m && !includeTime) {
      return `${m[1]}-${m[2]}-${m[3]}`
    }

    // 如果需要包含时间，处理日期时间字符串
    if (includeTime) {
      const date = new Date(dateInput)
      if (Number.isNaN(date.getTime())) return '-'

      // 获取北京时间
      const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
      const beijingTime = new Date(utc + (3600000 * 8)) // UTC+8

      const year = beijingTime.getFullYear()
      const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
      const day = String(beijingTime.getDate()).padStart(2, '0')
      const hours = String(beijingTime.getHours()).padStart(2, '0')
      const minutes = String(beijingTime.getMinutes()).padStart(2, '0')
      const seconds = String(beijingTime.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
  }

  // 对于Date对象且需要包含时间
  if (dateInput instanceof Date && includeTime) {
    const year = dateInput.getFullYear()
    const month = String(dateInput.getMonth() + 1).padStart(2, '0')
    const day = String(dateInput.getDate()).padStart(2, '0')
    const hours = String(dateInput.getHours()).padStart(2, '0')
    const minutes = String(dateInput.getMinutes()).padStart(2, '0')
    const seconds = String(dateInput.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  // 对于非字符串和非Date对象的输入
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return '-'

  // 获取北京时间
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
  const beijingTime = new Date(utc + (3600000 * 8)) // UTC+8

  const year = beijingTime.getFullYear()
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  if (includeTime) {
    const hours = String(beijingTime.getHours()).padStart(2, '0')
    const minutes = String(beijingTime.getMinutes()).padStart(2, '0')
    const seconds = String(beijingTime.getSeconds()).padStart(2, '0')
    return `${dateStr} ${hours}:${minutes}:${seconds}`
  }

  return dateStr
}

export const formatDateTime = (dateInput) => formatDate(dateInput, true)

// 获取北京时间日期的辅助函数，特别注意处理UTC日期字符串
export const getBeijingDate = (dateInput) => {
  // 如果是纯日期字符串，直接构造日期避免时区转换
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day); // 月份需要减1，因为Date对象中月份是从0开始的
  }

  const date = dateInput ? new Date(dateInput) : new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const beijingTime = new Date(utc + (3600000 * 8)); // UTC+8
  return beijingTime;
}

// 格式化日期为 YYYY-MM-DD 格式（避免时区问题）
export const formatBeijingDate = (dateInput) => {
  // 如果没有输入，默认使用当前时间
  if (!dateInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 如果是纯日期字符串，直接返回
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  let date;

  // 如果是 ISO 日期时间字符串（如 "2025-12-26T00:00:00.000Z"）
  if (typeof dateInput === 'string') {
    // 提取日期部分作为 UTC 日期
    const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
    if (match) {
      // 将 UTC 日期字符串转换为北京时间（+8小时）
      const utcDate = new Date(dateInput);
      const beijingTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
      const year = beijingTime.getFullYear();
      const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
      const day = String(beijingTime.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // 对于 Date 对象，转换为北京时间
  if (dateInput instanceof Date) {
    const beijingTime = new Date(dateInput.getTime() + 8 * 60 * 60 * 1000);
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 其他情况，转换为 Date 后处理
  date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '-';

  // 转换为北京时间（+8小时）
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取本地日期字符串（YYYY-MM-DD 格式）
export const getLocalDateString = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  // 使用本地时区的年月日
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取北京时间日期字符串（YYYY-MM-DD 格式）
export const getBeijingDateString = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  // 直接使用本地时间（在中国系统上就是北京时间）
  // 不需要再额外加8小时，因为本地时区已经是UTC+8
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
