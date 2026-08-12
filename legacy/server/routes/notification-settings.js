const { sendNotificationToUser } = require('../websocket')
const { requirePermission } = require('../middleware/auth')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取通知设置列表
  fastify.get('/api/notification-settings', {
    preHandler: [requirePermission('system:notification:settings')]
  }, async (request, reply) => {
    try {
      const [settings] = await pool.query('SELECT * FROM notification_settings')
      return {
        success: true,
        data: settings
      }
    } catch (error) {
      console.error('获取通知设置失败:', error)
      return reply.code(500).send({ success: false, message: '获取通知设置失败' })
    }
  })

  // 更新通知设置
  fastify.put('/api/notification-settings/:eventType', {
    preHandler: [requirePermission('system:notification:settings')]
  }, async (request, reply) => {
    const { eventType } = request.params
    const { targetRoles } = request.body

    try {
      const [result] = await pool.query(
        `INSERT INTO notification_settings (event_type, target_roles)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE target_roles = VALUES(target_roles)`,
        [eventType, JSON.stringify(targetRoles)]
      )

      return {
        success: true,
        message: '设置更新成功'
      }
    } catch (error) {
      console.error('更新通知设置失败:', error)
      return reply.code(500).send({ success: false, message: '更新通知设置失败' })
    }
  })

  // 获取所有可用角色（用于前端选择）
  fastify.get('/api/notification-settings/roles', {
    preHandler: [requirePermission('system:notification:settings')]
  }, async (request, reply) => {
    try {
      const [roles] = await pool.query('SELECT name FROM roles ORDER BY id')
      return {
        success: true,
        data: roles.map(r => r.name)
      }
    } catch (error) {
      console.error('获取角色列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取角色列表失败' })
    }
  })
}
