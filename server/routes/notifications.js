// 消息通知系统
module.exports = async function (fastify, opts) {
  // 获取用户通知列表（支持搜索和分页）
  fastify.get('/api/notifications', async (request, reply) => {
    const {
      userId,
      page = 1,
      pageSize = 10,
      search = '',
      type = '',
      isRead = ''
    } = request.query;

    try {
      const offset = (page - 1) * pageSize;
      let whereConditions = ['user_id = ?'];
      let params = [userId];

      // 搜索条件
      if (search) {
        whereConditions.push('(title LIKE ? OR content LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      // 类型筛选
      if (type) {
        whereConditions.push('type = ?');
        params.push(type);
      }

      // 已读状态筛选
      if (isRead !== '') {
        whereConditions.push('is_read = ?');
        params.push(isRead === 'true');
      }

      const whereClause = whereConditions.join(' AND ');

      // 获取总数
      const [countResult] = await fastify.mysql.query(
        `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
        params
      );

      // 获取分页数据
      const [notifications] = await fastify.mysql.query(
        `SELECT * FROM notifications
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize), offset]
      );

      reply.send({
        data: notifications,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(countResult[0].total / pageSize)
      });
    } catch (error) {
      console.error('获取通知失败:', error);
      reply.status(500).send({ error: '获取通知失败' });
    }
  });

  // 获取未读通知数量
  fastify.get('/api/notifications/unread-count', async (request, reply) => {
    const { userId } = request.query;

    try {
      const [result] = await fastify.mysql.query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE user_id = ? AND is_read = false`,
        [userId]
      );

      reply.send({ count: result[0].count });
    } catch (error) {
      console.error('获取未读数量失败:', error);
      reply.status(500).send({ error: '获取未读数量失败' });
    }
  });

  // 标记通知为已读
  fastify.put('/api/notifications/:id/read', async (request, reply) => {
    const { id } = request.params;

    try {
      await fastify.mysql.query(
        `UPDATE notifications SET is_read = true WHERE id = ?`,
        [id]
      );

      reply.send({ success: true });
    } catch (error) {
      console.error('标记已读失败:', error);
      reply.status(500).send({ error: '标记已读失败' });
    }
  });

  // 标记所有通知为已读
  fastify.put('/api/notifications/read-all', async (request, reply) => {
    const { userId } = request.body;

    try {
      await fastify.mysql.query(
        `UPDATE notifications SET is_read = true WHERE user_id = ?`,
        [userId]
      );

      reply.send({ success: true });
    } catch (error) {
      console.error('标记全部已读失败:', error);
      reply.status(500).send({ error: '标记全部已读失败' });
    }
  });

  // 删除通知
  fastify.delete('/api/notifications/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      await fastify.mysql.query(
        `DELETE FROM notifications WHERE id = ?`,
        [id]
      );

      reply.send({ success: true });
    } catch (error) {
      console.error('删除通知失败:', error);
      reply.status(500).send({ error: '删除通知失败' });
    }
  });

  // 创建通知（内部使用）
  fastify.post('/api/notifications/create', async (request, reply) => {
    const { userId, type, title, content, relatedId } = request.body;

    try {
      const [result] = await fastify.mysql.query(
        `INSERT INTO notifications (user_id, type, title, content, related_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, false, NOW())`,
        [userId, type, title, content, relatedId]
      );

      reply.send({ success: true, id: result.insertId });
    } catch (error) {
      console.error('创建通知失败:', error);
      reply.status(500).send({ error: '创建通知失败' });
    }
  });

  // 发送打卡提醒
  fastify.post('/api/notifications/clock-reminder', async (request, reply) => {
    try {
      // 获取今天还未打卡的员工
      const [employees] = await fastify.mysql.query(
        `SELECT e.id, e.user_id, e.name
         FROM employees e
         LEFT JOIN attendance_records ar ON e.id = ar.employee_id
           AND ar.record_date = CURDATE()
         WHERE ar.id IS NULL AND e.is_active = true`
      );

      // 为每个员工创建提醒通知
      for (const emp of employees) {
        await fastify.mysql.query(
          `INSERT INTO notifications (user_id, type, title, content, is_read, created_at)
           VALUES (?, 'clock_reminder', '打卡提醒', '您今天还未打卡，请及时打卡', false, NOW())`,
          [emp.user_id]
        );
      }

      reply.send({ success: true, count: employees.length });
    } catch (error) {
      console.error('发送打卡提醒失败:', error);
      reply.status(500).send({ error: '发送提醒失败' });
    }
  });

  // 发送审批通知
  fastify.post('/api/notifications/approval', async (request, reply) => {
    const { userId, type, title, content, relatedId } = request.body;

    try {
      await fastify.mysql.query(
        `INSERT INTO notifications (user_id, type, title, content, related_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, false, NOW())`,
        [userId, type, title, content, relatedId]
      );

      reply.send({ success: true });
    } catch (error) {
      console.error('发送审批通知失败:', error);
      reply.status(500).send({ error: '发送通知失败' });
    }
  });
};

// 通知类型说明：
// - clock_reminder: 打卡提醒
// - leave_approval: 请假审批通知
// - overtime_approval: 加班审批通知
// - makeup_approval: 补卡审批通知
// - schedule_change: 排班变更通知
// - attendance_abnormal: 考勤异常提醒
