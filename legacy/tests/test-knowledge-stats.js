require('dotenv').config()
const axios = require('axios')

async function run() {
  console.log('开始知识库统计接口测试...')
  const apiBase = process.env.API_BASE || 'http://localhost:3001'

  const to = new Date()
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().slice(0, 10)

  const res = await axios.get(`${apiBase}/api/knowledge/stats/articles?from=${fmt(from)}&to=${fmt(to)}&page=1&pageSize=5`)
  const data = res.data?.data || []
  console.log('返回条数:', data.length)
  console.log('示例:', data[0])
  console.log('知识库统计接口测试完成')
}

run().catch(err => {
  console.error('❌ 测试失败:', err.message)
  process.exit(1)
})