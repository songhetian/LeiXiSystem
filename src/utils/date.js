export const formatDate = (dateInput) => {
  if (!dateInput) return '-'
  if (typeof dateInput === 'string') {
    // 如果包含时间部分(T)，则交给 Date 处理以正确转换时区
    if (!dateInput.includes('T')) {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) return `${m[1]}-${m[2]}-${m[3]}`
    }
  }
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return '-'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
