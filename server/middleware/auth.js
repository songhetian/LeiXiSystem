const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * 验证用户是否拥有指定权限
 * @param {string} permissionCode - 权限代码，如 'user:view'
 */
function requirePermission(permissionCode) {
  return async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未登录' })
      }

      const decoded = jwt.verify(token, JWT_SECRET)
      const userId = decoded.id

      // 从数据库查询用户权限
      // 注意：这里假设 request.server.mysql 已经挂载了 mysql 实例
      // 如果 middleware 无法直接访问 fastify 实例，可能需要调整调用方式
      // 但在 fastify 路由钩子中，request 上下文通常可以访问到 db

      const pool = request.server.mysql

      // 1. 检查是否为超级管理员 (拥有所有权限)
      const [userRoles] = await pool.query(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [userId]
      )

      const isAdmin = userRoles.some(r => r.name === '超级管理员');

      // 如果是超级管理员，跳过权限检查
      if (isAdmin) {
        return // 超级管理员拥有所有权限，直接通过
      }

      // 2. 查询用户权限
      const [permissions] = await pool.query(`
        SELECT p.code
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?
      `, [userId])

      const userPermissions = permissions.map(p => p.code)

      if (!userPermissions.includes(permissionCode)) {
        return reply.code(403).send({ success: false, message: '权限不足' })
      }

    } catch (error) {
      console.error('权限验证失败:', error)
      if (error.name === 'JsonWebTokenError') {
        return reply.code(401).send({ success: false, message: '无效的令牌' })
      }
      return reply.code(500).send({
        success: false,
        message: '权限中间件执行失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      })
    }
  }
}

module.exports = {
  requirePermission
}
