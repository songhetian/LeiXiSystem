const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql || global.pool;

  // 内部辅助鉴权函数：确保 100% 可靠
  const checkAuth = async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) throw new Error('未登录')
      const decoded = jwt.verify(token, JWT_SECRET)
      
      // 检查超级管理员权限
      const [roles] = await pool.query(
        `SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?`,
        [decoded.id]
      )
      const isAdmin = roles.some(r => r.name === '超级管理员');
      
      return { user: decoded, isAdmin };
    } catch (err) {
      reply.code(401).send({ success: false, message: '身份验证失效' })
      return null;
    }
  };

  const cleanProfile = (profile) => {
    if (!profile) return profile;
    const p = { ...profile };
    ['avatar', 'id_card_front_url', 'id_card_back_url'].forEach(f => {
      if (p[f] && p[f].startsWith('data:image')) p[f] = '';
    });
    return p;
  };

  // 1. 获取用户个人资料
  fastify.get('/api/users/:userId/profile', async (request, reply) => {
    const auth = await checkAuth(request, reply);
    if (!auth) return;

    const { userId } = request.params;
    // 权限检查：只能看自己，或者是超级管理员
    if (auth.user.id != userId && !auth.isAdmin) {
      return reply.code(403).send({ success: false, message: '权限不足' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT u.*, e.employee_no, e.hire_date, e.rating, e.emergency_contact, 
                e.emergency_phone, e.address, e.education, e.skills, e.remark,
                d.name as department_name, p.name as position_name
         FROM users u
         LEFT JOIN employees e ON u.id = e.user_id
         LEFT JOIN departments d ON u.department_id = d.id
         LEFT JOIN positions p ON e.position_id = p.id
         WHERE u.id = ?`,
        [userId]
      );

      if (rows.length === 0) return reply.code(404).send({ success: false, message: '用户不存在' });
      return { success: true, data: cleanProfile(rows[0]) };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  });

  // 2. 更新个人资料
  fastify.put('/api/users/:userId/profile', async (request, reply) => {
    const auth = await checkAuth(request, reply);
    if (!auth) return;

    const { userId } = request.params;
    if (auth.user.id != userId && !auth.isAdmin) {
      return reply.code(403).send({ success: false, message: '权限不足' });
    }

    const { real_name, email, phone, avatar, id_card_front_url, id_card_back_url, ...rest } = request.body;

    if ([avatar, id_card_front_url, id_card_back_url].some(v => v && v.startsWith('data:image'))) {
      return reply.code(400).send({ success: false, message: '图片过大，请重传后再试' });
    }

    try {
      await pool.query(
        `UPDATE users SET real_name = ?, email = ?, phone = ?, avatar = ?, 
                id_card_front_url = ?, id_card_back_url = ? WHERE id = ?`,
        [real_name, email, phone, avatar, id_card_front_url, id_card_back_url, userId]
      );

      await pool.query(
        `UPDATE employees SET emergency_contact = ?, emergency_phone = ?, 
                address = ?, education = ?, skills = ?, remark = ? WHERE user_id = ?`,
        [rest.emergency_contact, rest.emergency_phone, rest.address, rest.education, rest.skills, rest.remark, userId]
      );

      if (fastify.redis) await fastify.redis.del(`user:profile:${userId}`);
      return { success: true, message: '资料同步成功' };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  });

  // 3. 获取员工简要信息
  fastify.get('/api/employees/by-user/:userId', async (request, reply) => {
    const auth = await checkAuth(request, reply);
    if (!auth) return;
    try {
      const [rows] = await pool.query('SELECT * FROM employees WHERE user_id = ?', [request.params.userId]);
      return { success: true, data: rows[0] || null };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  });
}
