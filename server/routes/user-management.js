const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const { requirePermission } = require('../middleware/auth')

async function userManagementRoutes(fastify, options) {
  const pool = fastify.mysql || options.mysql

  // 获取当前用户权限
  fastify.get('/api/users/permissions', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录' })
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      const userId = decoded.id

      const { getUserPermissions } = require('../utils/permission')
      const permissions = await getUserPermissions(pool, userId)

      return { success: true, permissions }
    } catch (error) {
      console.error('获取权限失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取权限失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      })
    }
  })

  // 获取用户的审批人
  fastify.get('/api/users/:userId/approver', async (request, reply) => {
    const { userId } = request.params
    try {
      const [user] = await pool.query('SELECT department_id FROM users WHERE id = ?', [userId])
      if (user.length === 0) {
        return reply.code(404).send({ success: false, message: '用户不存在' })
      }

      // 这里需要引入 findApprover，或者如果不需要复杂逻辑，可以直接查询部门主管
      // 暂时简单实现：查找该部门的主管
      const [managers] = await pool.query(
        `SELECT u.id, u.real_name, pos.name as position
         FROM users u
         LEFT JOIN employees e ON u.id = e.user_id
         LEFT JOIN positions pos ON e.position_id = pos.id
         WHERE u.department_id = ? AND u.is_department_manager = 1`,
        [user[0].department_id]
      )

      // 如果有多个主管，返回第一个，或者根据具体业务逻辑处理
      // 如果没有主管，可能需要向上级部门查找（这里暂不实现递归查找）
      const approver = managers.length > 0 ? managers[0] : null

      return {
        success: true,
        data: approver
      }
    } catch (error) {
      console.error('获取审批人失败:', error)
      return reply.code(500).send({ success: false, message: '获取审批人失败' })
    }
  })

  // 获取用户个人资料
  fastify.get('/api/users/:userId/profile', {
    preHandler: requirePermission('user:profile:view')
  }, async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录' })
    }

    // 验证token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return reply.code(401).send({ success: false, message: '令牌无效' })
    }

    const { userId } = request.params
    const pool = fastify.mysql || global.pool;

    // 检查用户是否在查看自己的资料
    if (decoded.id != userId) {
      // 如果不是查看自己的资料，需要检查权限
      const [userRoles] = await pool.query(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [decoded.id]
      )
      const isAdmin = userRoles.some(r => r.name === '超级管理员');
      if (!isAdmin) {
        return reply.code(403).send({ success: false, message: '权限不足' })
      }
    }

    try {
      const redis = fastify.redis;
      const cacheKey = `user:profile:${userId}`;

      // 1. 尝试从 Redis 获取
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return { success: true, data: JSON.parse(cached) };
      }

      // 2. 缓存未命中，联表查询 users 和 employees 表
      const [rows] = await pool.query(
        `SELECT
          u.id, u.username, u.real_name, u.email, u.phone, u.avatar, u.department_id,
          u.id_card_front_url, u.id_card_back_url,
          e.emergency_contact, e.emergency_phone, e.address, e.education,
          e.skills, e.remark, e.employee_no, e.hire_date, e.rating, u.updated_at
         FROM users u
         LEFT JOIN employees e ON u.id = e.user_id
         WHERE u.id = ?`,
        [userId]
      )

      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '用户不存在' })
      }

      // 3. 写入 Redis (缓存 1 小时)
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(rows[0]), 'EX', 3600);
      }

      return { success: true, data: rows[0] }
    } catch (error) {
      console.error('获取个人资料失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取个人资料失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      })
    }
  })

  // 更新用户个人资料（新增路由）
  fastify.put('/api/users/:userId/profile', {
    preHandler: requirePermission('user:profile:update')
  }, async (request, reply) => {
    const redis = fastify.redis;
    // ... 原有验证逻辑 ...
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录' })
    }

    // 验证token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return reply.code(401).send({ success: false, message: '令牌无效' })
    }

    const { userId } = request.params
    // 检查用户是否在更新自己的资料
    if (decoded.id != userId) {
      // 如果不是更新自己的资料，需要检查是否为超级管理员
      // 检查是否为超级管理员
      const [userRoles] = await pool.query(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [decoded.id]
      )

      const isAdmin = userRoles.some(r => r.name === '超级管理员');

      // 只有超级管理员才能更新他人的资料
      if (!isAdmin) {
        return reply.code(403).send({ success: false, message: '权限不足' })
      }
    }

    const {
      real_name,
      email,
      phone,
      id_card_front_url,
      id_card_back_url,
      emergency_contact,
      emergency_phone,
      address,
      education,
      skills,
      remark
    } = request.body

    try {
      // 更新 users 表（只更新 users 表中存在的字段）
      await pool.query(
        `UPDATE users SET
          real_name = ?,
          email = ?,
          phone = ?,
          id_card_front_url = ?,
          id_card_back_url = ?
        WHERE id = ?`,
        [
          real_name || null,
          email || null,
          phone || null,
          id_card_front_url || null,
          id_card_back_url || null,
          userId
        ]
      )

      // 更新 employees 表
      await pool.query(
        `UPDATE employees SET
          emergency_contact = ?,
          emergency_phone = ?,
          address = ?,
          education = ?,
          skills = ?,
          remark = ?
        WHERE user_id = ?`,
        [
          emergency_contact || null,
          emergency_phone || null,
          address || null,
          education || null,
          skills || null,
          remark || null,
          userId
        ]
      )

      // Redis 同步：清理个人资料缓存、通用权限缓存和审计身份缓存
      if (redis) {
        await redis.del(`user:profile:${userId}`);
        await redis.del(`user:permissions:${userId}`);
        await redis.del(`user:identity:${userId}`);

        // 🚨 新增：清理员工列表缓存，确保员工管理页面同步更新
        const keys = await redis.keys('list:employees:default:*');
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      return { success: true, message: '个人资料更新成功' }
    } catch (error) {
      console.error('更新个人资料失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 根据用户 ID 获取关联员工信息 (修复 404)
  fastify.get('/api/employees/by-user/:userId', async (request, reply) => {
    const { userId } = request.params;
    try {
      const [rows] = await pool.query(
        `SELECT e.*, u.real_name, u.username, d.name as department_name
         FROM employees e
         JOIN users u ON e.user_id = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = ?`,
        [userId]
      );

      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '该用户未关联员工基本信息' });
      }

      return { success: true, data: rows[0] };
    } catch (error) {
      console.error('获取员工关联信息失败:', error);
      return reply.code(500).send({ success: false, message: '服务器内部错误' });
    }
  });
}

module.exports = userManagementRoutes
