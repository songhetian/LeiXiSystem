/* eslint-disable */
const assert = (cond, msg) => {
  if (!cond) {
    console.error('❌', msg)
    process.exitCode = 1
  } else {
    console.log('✅', msg)
  }
}

(async () => {
  const { formatDate } = await import('../src/utils/date.js')

  console.log('测试 formatDate 日期格式统一为 YYYY-MM-DD')

  assert(formatDate('2025-11-19T08:00:00Z') === '2025-11-19', 'UTC 字符串应输出 YYYY-MM-DD')
  assert(formatDate('2025-01-02') === '2025-01-02', '已是 YYYY-MM-DD 字符串应原样输出')
  assert(formatDate(new Date('2024-02-03T23:59:59')) === '2024-02-03', 'Date 对象应输出 YYYY-MM-DD')
  assert(formatDate('invalid') === '-', '非法日期应输出 -')
  assert(formatDate(null) === '-', '空值应输出 -')

  // 展示一些示例输出
  const samples = [
    '2024-12-31T23:59:59Z',
    '2024-12-31',
    new Date('2023-03-15T09:30:00')
  ]
  samples.forEach(s => console.log('示例:', s, '->', formatDate(s)))
})();