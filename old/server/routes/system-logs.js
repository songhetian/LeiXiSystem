/**
 * 系统日志 API 路由
 */

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取日志列表 (支持搜索和分页)
  fastify.get('/api/system/logs', async (request, reply) => {
    const { 
      page = 1, 
      limit = 20, 
      username, 
      module, 
      start_date, 
      end_date,
      status 
    } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT l.*, u.real_name as latest_real_name
        FROM operation_logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE 1=1
      `
      const params = []

      if (username) {
        query += ' AND (l.username LIKE ? OR l.real_name LIKE ? OR u.real_name LIKE ?)'
        params.push(`%${username}%`, `%${username}%`, `%${username}%`)
      }

      if (module) {
        query += ' AND l.module = ?'
        params.push(module)
      }

      if (status !== undefined && status !== '') {
        query += ' AND l.status = ?'
        params.push(status === 'true' || status === '1' ? 1 : 0)
      }

      if (start_date) {
        query += ' AND l.created_at >= ?'
        params.push(start_date + ' 00:00:00')
      }

      if (end_date) {
        query += ' AND l.created_at <= ?'
        params.push(end_date + ' 23:59:59')
      }

      query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [logs] = await pool.query(query, params)

      // 使用简单的计数查询
      const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM operation_logs', [])

      return {
        success: true,
        data: logs,
        total: total
      }
    } catch (error) {
      console.error('获取日志失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })
}
