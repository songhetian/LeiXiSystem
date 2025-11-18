module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  async function getUser(request) {
    const session = request.session?.get?.('user');
    if (session && session.id) return session;
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token || !fastify.jwt) return null;
      const decoded = fastify.jwt.verify(token);
      return { id: decoded.id };
    } catch {
      return null;
    }
  }

  // 获取用户通知设置
  fastify.get('/api/user/notification-settings', async (request, reply) => {
    const user = await getUser(request);
    if (!user) return reply.code(401).send({ success: false, message: '未登录' });
    try {
      const [rows] = await pool.query(
        `SELECT receive_system AS receiveSystemNotifications,
                receive_department AS receiveDepartmentNotifications,
                sound_on AS notificationSound,
                dnd_start AS doNotDisturbStart,
                dnd_end AS doNotDisturbEnd,
                toast_duration AS toastDuration
         FROM user_notification_settings WHERE user_id = ?`,
        [user.id]
      );
      const defaults = {
        receiveSystemNotifications: true,
        receiveDepartmentNotifications: true,
        notificationSound: true,
        doNotDisturbStart: '22:00',
        doNotDisturbEnd: '08:00',
        toastDuration: 5000,
      };
      return { success: true, data: rows[0] || defaults };
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取设置失败' });
    }
  });

  // 保存用户通知设置
  fastify.put('/api/user/notification-settings', async (request, reply) => {
    const user = await getUser(request);
    if (!user) return reply.code(401).send({ success: false, message: '未登录' });
    const {
      receiveSystemNotifications,
      receiveDepartmentNotifications,
      notificationSound,
      doNotDisturbStart,
      doNotDisturbEnd,
      toastDuration,
    } = request.body || {};
    try {
      await pool.query(
        `INSERT INTO user_notification_settings
         (user_id, receive_system, receive_department, sound_on, dnd_start, dnd_end, toast_duration)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           receive_system = VALUES(receive_system),
           receive_department = VALUES(receive_department),
           sound_on = VALUES(sound_on),
           dnd_start = VALUES(dnd_start),
           dnd_end = VALUES(dnd_end),
           toast_duration = VALUES(toast_duration)`,
        [
          user.id,
          receiveSystemNotifications ? 1 : 0,
          receiveDepartmentNotifications ? 1 : 0,
          notificationSound ? 1 : 0,
          doNotDisturbStart || null,
          doNotDisturbEnd || null,
          parseInt(toastDuration) || 5000,
        ]
      );
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ success: false, message: '保存设置失败' });
    }
  });
}