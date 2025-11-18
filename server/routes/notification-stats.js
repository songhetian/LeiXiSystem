const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  async function getUser(request) {
    const session = request.session?.get?.('user');
    if (session && session.id) return session;
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) return null;
      const decoded = jwt.verify(token, JWT_SECRET);
      return { id: decoded.id };
    } catch {
      return null;
    }
  }

  // 未读数快捷接口
  fastify.get('/api/notifications/unread-count', async (request, reply) => {
    const user = await getUser(request);
    if (!user) return reply.code(401).send({ success: false, message: '未登录' });
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count
         FROM notification_recipients
         WHERE user_id = ? AND is_read = false AND is_deleted = false`,
        [user.id]
      );
      return { success: true, data: { count: rows[0]?.count || 0 } };
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取未读数失败' });
    }
  });

  // 通知统计概览（发送量、阅读率）
  fastify.get('/api/notifications/stats/overview', async (request, reply) => {
    try {
      const [sent] = await pool.query(`SELECT COUNT(*) AS total FROM notifications`);
      const [recipients] = await pool.query(`SELECT COUNT(*) AS total, SUM(is_read = true) AS read_count FROM notification_recipients`);
      const totalRecipients = recipients[0]?.total || 0;
      const readCount = recipients[0]?.read_count || 0;
      const readRate = totalRecipients > 0 ? Number((readCount / totalRecipients) * 100).toFixed(2) : '0.00';
      return {
        success: true,
        data: {
          sentTotal: sent[0]?.total || 0,
          recipientTotal: totalRecipients,
          readCount,
          readRate: Number(readRate),
        },
      };
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取统计概览失败' });
    }
  });

  // 部门维度统计（部门阅读率）
  fastify.get('/api/notifications/stats/by-department', async (request, reply) => {
    try {
      const [rows] = await pool.query(`
        SELECT d.id AS department_id, d.name AS department_name,
               COUNT(n.id) AS sent_count,
               SUM(nr.is_read = true) AS read_count,
               COUNT(nr.id) AS recipient_count
        FROM departments d
        LEFT JOIN notifications n ON n.department_id = d.id
        LEFT JOIN notification_recipients nr ON nr.notification_id = n.id
        GROUP BY d.id, d.name
        ORDER BY sent_count DESC
      `);
      const result = rows.map(r => ({
        department_id: r.department_id,
        department_name: r.department_name,
        sent_count: r.sent_count || 0,
        recipient_count: r.recipient_count || 0,
        read_count: r.read_count || 0,
        read_rate: (r.recipient_count ? Number((r.read_count / r.recipient_count) * 100).toFixed(2) : '0.00') * 1,
      }));
      return { success: true, data: result };
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取部门统计失败' });
    }
  });

  // 活跃度趋势（按日已读数）
  fastify.get('/api/notifications/stats/activity', async (request, reply) => {
    try {
      const [rows] = await pool.query(`
        SELECT DATE(nr.read_at) AS date, COUNT(*) AS read_count
        FROM notification_recipients nr
        WHERE nr.is_read = true AND nr.read_at IS NOT NULL
        GROUP BY DATE(nr.read_at)
        ORDER BY DATE(nr.read_at) DESC
        LIMIT 30
      `);
      return { success: true, data: rows };
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取活跃度统计失败' });
    }
  });
}