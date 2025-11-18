require('dotenv').config()
const axios = require('axios')
const mysql = require('mysql2/promise')

async function run() {
  console.log('开始阅读统计接口测试...')
  const apiBase = process.env.API_BASE || 'http://localhost:3001'
  const token = process.env.TEST_TOKEN || (process.env.TOKEN || '')
  if (!token) {
    console.log('未提供测试令牌 TEST_TOKEN，跳过鉴权测试')
    return
  }

  const auth = { headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } }

  // 选择一篇我的知识库文章
  const listRes = await axios.get(`${apiBase}/api/my-knowledge/articles`, auth)
  const article = Array.isArray(listRes.data) ? listRes.data[0] : (listRes.data?.data?.[0] || null)
  if (!article) {
    console.log('无可用文章用于测试，结束')
    return
  }
  console.log('使用文章ID:', article.id)

  // 开始会话
  const startRes = await axios.post(`${apiBase}/api/knowledge/articles/${article.id}/reading/start`, {}, auth)
  const sessionId = startRes.data.session_id
  console.log('session_id:', sessionId)

  // 心跳三次
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 1000))
    await axios.put(`${apiBase}/api/knowledge/articles/${article.id}/reading/heartbeat`, {
      session_id: sessionId,
      active_delta: 10,
      wheel: 3,
      mousemove: 5,
      keydown: 1,
      scroll_depth_percent: 85
    }, auth)
  }

  // 结束会话
  await axios.put(`${apiBase}/api/knowledge/articles/${article.id}/reading/end`, {
    session_id: sessionId,
    close_type: 'user_close'
  }, auth)
  console.log('会话结束并已落库')

  // 验证数据库中存在记录
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'leixin_customer_service',
    port: process.env.DB_PORT || 3306
  })

  const [rows] = await pool.query('SELECT * FROM knowledge_article_read_sessions WHERE session_id = ?', [sessionId])
  if (rows.length === 0) {
    throw new Error('未找到阅读会话记录')
  }
  console.log('✅ 找到阅读会话记录，full_read =', rows[0].full_read, 'active_seconds =', rows[0].active_seconds)

  const [statRows] = await pool.query('SELECT * FROM knowledge_article_daily_stats WHERE article_id = ? AND stat_date = CURDATE()', [article.id])
  if (statRows.length === 0) {
    throw new Error('未找到日统计记录')
  }
  console.log('✅ 找到日统计记录，views =', statRows[0].views_count)

  await pool.end()
  console.log('阅读统计接口测试完成')
}

run().catch(err => {
  console.error('❌ 测试失败:', err.message)
  process.exit(1)
})