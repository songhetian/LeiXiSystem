const { getUserPermissions } = require('../middleware/checkPermission');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // Middleware to get user from session
  async function getUser(request) {
    const session = request.session.get('user');
    if (!session || !session.id) {
      return null;
    }
    return session;
  }

  // POST /api/notifications - 创建通知
  fastify.post('/api/notifications', async (request, reply) => {
    const { type, title, content, content_type, image_url, link_url, priority, expires_at, department_id, user_ids } = request.body;
    const user = await getUser(request);

    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    // Permission Check
    const permissions = await getUserPermissions(pool, user.id);
    if (!permissions) {
      return reply.code(403).send({ success: false, message: '无法获取用户权限' });
    }

    const userRoles = permissions.roles.map(r => r.name);
    const isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');

    if (type === 'system') {
      if (!isAdmin) {
        return reply.code(403).send({ success: false, message: '无权发送系统通知' });
      }
    } else if (type === 'department') {
      const isDeptManager = userRoles.includes('department_manager');
      // Admins can send to any department. Department managers can only send to their own.
      if (!isAdmin && !(isDeptManager && permissions.departmentId === department_id)) {
        return reply.code(403).send({ success: false, message: '无权发送此部门的通知' });
      }
    }
    // For 'user' type, any logged-in user is allowed.

    if (!type || !title || !content) {
      return reply.code(400).send({ success: false, message: '缺少必要参数' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO notifications (type, title, content, content_type, image_url, link_url, priority, sender_id, department_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [type, title, content, content_type, image_url, link_url, priority, user.id, department_id, expires_at]
      );
      const notificationId = result.insertId;

      let recipients = [];
      if (type === 'system') {
        const [users] = await connection.query('SELECT id FROM users WHERE status = "active"');
        recipients = users.map(u => u.id);
      } else if (type === 'department' && department_id) {
        const [users] = await connection.query('SELECT id FROM users WHERE department_id = ? AND status = "active"', [department_id]);
        recipients = users.map(u => u.id);
      } else if (type === 'user' && user_ids && user_ids.length > 0) {
        recipients = user_ids;
      }

      if (recipients.length > 0) {
        const recipientValues = recipients.map(userId => [notificationId, userId]);
        await connection.query('INSERT INTO notification_recipients (notification_id, user_id) VALUES ?', [recipientValues]);
      }

      await connection.commit();
      // TODO: Emit WebSocket event here: fastify.io.emit('notification:new', ...);
      return { success: true, message: '通知创建成功', data: { id: notificationId } };
    } catch (error) {
      await connection.rollback();
      console.error('创建通知失败:', error);
      return reply.code(500).send({ success: false, message: '创建通知失败' });
    } finally {
      connection.release();
    }
  });

  // GET /api/notifications - 获取当前用户的通知列表
  fastify.get('/api/notifications', async (request, reply) => {
    const user = await getUser(request);
    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    try {
      const [notifications] = await pool.query(
        `SELECT n.*, nr.is_read, nr.read_at
         FROM notifications n
         JOIN notification_recipients nr ON n.id = nr.notification_id
         WHERE nr.user_id = ? AND nr.is_deleted = false
         ORDER BY n.created_at DESC`,
        [user.id]
      );
      return { success: true, data: notifications };
    } catch (error) {
      console.error('获取通知列表失败:', error);
      return reply.code(500).send({ success: false, message: '获取通知列表失败' });
    }
  });

  // GET /api/notifications/unread - 获取未读通知
  fastify.get('/api/notifications/unread', async (request, reply) => {
    const user = await getUser(request);
    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    try {
      const [notifications] = await pool.query(
        `SELECT n.*, nr.is_read, nr.read_at
         FROM notifications n
         JOIN notification_recipients nr ON n.id = nr.notification_id
         WHERE nr.user_id = ? AND nr.is_read = false AND nr.is_deleted = false
         ORDER BY n.created_at DESC`,
        [user.id]
      );
      return { success: true, data: notifications };
    } catch (error) {
      console.error('获取未读通知失败:', error);
      return reply.code(500).send({ success: false, message: '获取未读通知失败' });
    }
  });

  // PUT /api/notifications/:id/read - 标记为已读
  fastify.put('/api/notifications/:id/read', async (request, reply) => {
    const { id } = request.params;
    const user = await getUser(request);
    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    try {
      await pool.query(
        'UPDATE notification_recipients SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND user_id = ?',
        [id, user.id]
      );
      return { success: true, message: '标记已读成功' };
    } catch (error) {
      console.error('标记已读失败:', error);
      return reply.code(500).send({ success: false, message: '标记已读失败' });
    }
  });

  // PUT /api/notifications/read-all - 全部标记为已读
  fastify.put('/api/notifications/read-all', async (request, reply) => {
    const user = await getUser(request);
    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    try {
      await pool.query(
        'UPDATE notification_recipients SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = false',
        [user.id]
      );
      return { success: true, message: '全部标记已读成功' };
    } catch (error) {
      console.error('全部标记已读失败:', error);
      return reply.code(500).send({ success: false, message: '全部标记已读失败' });
    }
  });

  // DELETE /api/notifications/:id - 删除通知 (软删除)
  fastify.delete('/api/notifications/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await getUser(request);
    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    try {
      await pool.query(
        'UPDATE notification_recipients SET is_deleted = true WHERE notification_id = ? AND user_id = ?',
        [id, user.id]
      );
      return { success: true, message: '删除成功' };
    } catch (error) {
      console.error('删除通知失败:', error);
      return reply.code(500).send({ success: false, message: '删除通知失败' });
    }
  });

  // GET /api/notifications/history - 获取历史通知 (including deleted)
  fastify.get('/api/notifications/history', async (request, reply) => {
    const user = await getUser(request);
    if (!user) {
      return reply.code(401).send({ success: false, message: '用户未登录' });
    }

    try {
      const [notifications] = await pool.query(
        `SELECT n.*, nr.is_read, nr.read_at, nr.is_deleted
         FROM notifications n
         JOIN notification_recipients nr ON n.id = nr.notification_id
         WHERE nr.user_id = ?
         ORDER BY n.created_at DESC`,
        [user.id]
      );
      return { success: true, data: notifications };
    } catch (error) {
      console.error('获取历史通知失败:', error);
      return reply.code(500).send({ success: false, message: '获取历史通知失败' });
    }
  });
};
