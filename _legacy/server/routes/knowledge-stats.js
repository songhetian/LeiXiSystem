module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // Article statistics
  fastify.get('/api/knowledge/stats/articles', async (request, reply) => {
    try {
      const { from, to, categoryId, page = 1, pageSize = 20 } = request.query;
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      let where = 'WHERE 1=1';
      const params = [];
      if (from) { where += ' AND ks.stat_date >= ?'; params.push(from); }
      if (to) { where += ' AND ks.stat_date <= ?'; params.push(to); }
      if (categoryId) { where += ' AND ka.category_id = ?'; params.push(categoryId); }

      const [countRows] = await pool.query(`
        SELECT COUNT(DISTINCT ks.article_id) AS total
        FROM knowledge_article_daily_stats ks
        JOIN knowledge_articles ka ON ks.article_id = ka.id
        ${where}
      `, params);
      const total = countRows[0]?.total || 0;

      const [rows] = await pool.query(`
        SELECT
          ks.article_id,
          ka.title,
          ka.category_id,
          SUM(ks.views_count) AS views,
          SUM(ks.full_reads_count) AS full_reads,
          SUM(ks.total_duration_seconds) AS total_duration,
          SUM(ks.total_active_seconds) AS total_active,
          CASE WHEN SUM(ks.views_count) > 0 THEN ROUND(SUM(ks.total_duration_seconds) / SUM(ks.views_count), 2) ELSE 0 END AS avg_duration,
          CASE WHEN SUM(ks.views_count) > 0 THEN ROUND(SUM(ks.full_reads_count) / SUM(ks.views_count) * 100, 2) ELSE 0 END AS full_read_rate
        FROM knowledge_article_daily_stats ks
        JOIN knowledge_articles ka ON ks.article_id = ka.id
        ${where}
        GROUP BY ks.article_id, ka.title, ka.category_id
        ORDER BY views DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      return { success: true, data: rows, pagination: { page: parseInt(page), pageSize: limit, total, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, message: '获取文章统计失败' });
    }
  });

  // User statistics
  fastify.get('/api/knowledge/stats/users', async (request, reply) => {
    try {
      const { from, to, departmentId, page = 1, pageSize = 20 } = request.query;
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      let where = 'WHERE 1=1';
      const params = [];
      if (from) { where += ' AND s.started_at >= ?'; params.push(from); }
      if (to) { where += ' AND s.started_at <= ?'; params.push(to); }
      if (departmentId) { where += ' AND u.department_id = ?'; params.push(departmentId); }

      const [countRows] = await pool.query(`
        SELECT COUNT(DISTINCT s.user_id) AS total
        FROM knowledge_article_read_sessions s
        JOIN users u ON s.user_id = u.id
        ${where}
      `, params);
      const total = countRows[0]?.total || 0;

      const [rows] = await pool.query(`
        SELECT
          s.user_id,
          u.real_name AS user_name,
          u.department_id,
          SUM(s.duration_seconds) AS total_duration,
          SUM(s.active_seconds) AS total_active,
          COUNT(DISTINCT s.article_id) AS articles_read,
          SUM(s.full_read) AS full_reads
        FROM knowledge_article_read_sessions s
        JOIN users u ON s.user_id = u.id
        ${where}
        GROUP BY s.user_id, u.real_name, u.department_id
        ORDER BY total_active DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      return { success: true, data: rows, pagination: { page: parseInt(page), pageSize: limit, total, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, message: '获取用户统计失败' });
    }
  });
};