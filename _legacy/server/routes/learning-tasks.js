// 学习任务管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取学习任务列表
  // GET /api/learning-tasks
  // 支持状态筛选: pending, completed
  fastify.get('/api/learning-tasks', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const { status } = request.query

      // 构建查询条件
      let query = `
        SELECT
          lt.*,
          u.real_name as assigned_to_name,
          ub.real_name as assigned_by_name
        FROM learning_tasks lt
        LEFT JOIN users u ON lt.assigned_to = u.id
        LEFT JOIN users ub ON lt.assigned_by = ub.id
        WHERE lt.assigned_to = ?
      `
      const params = [decoded.id]

      // 根据状态筛选
      if (status) {
        query += ' AND lt.status = ?'
        params.push(status)
      }

      query += ' ORDER BY lt.created_at DESC'

      const [rows] = await pool.query(query, params)
      return rows
    } catch (error) {
      console.error('获取学习任务列表失败:', error)
      reply.code(500).send({ error: '获取学习任务列表失败' })
    }
  })

  // 创建学习任务
  // POST /api/learning-tasks
  // 必填字段: title
  // 可选字段: description, priority, due_date
  fastify.post('/api/learning-tasks', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const { title, description, priority, due_date } = request.body

      // 必填字段验证
      if (!title || title.trim() === '') {
        return reply.code(400).send({
          success: false,
          message: '任务标题不能为空'
        })
      }

      // 插入任务数据
      const [result] = await pool.query(
        `INSERT INTO learning_tasks (
          title,
          description,
          assigned_to,
          assigned_by,
          priority,
          due_date
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          decoded.id, // 分配给自己
          decoded.id, // 分配者也是自己
          priority || 'medium',
          due_date || null
        ]
      )

      // 获取创建的任务
      const [taskRows] = await pool.query(
        'SELECT * FROM learning_tasks WHERE id = ?',
        [result.insertId]
      )

      return {
        success: true,
        message: '任务创建成功',
        data: taskRows[0]
      }
    } catch (error) {
      console.error('创建学习任务失败:', error)
      reply.code(500).send({ error: '创建学习任务失败' })
    }
  })

  // 更新学习任务
  // PUT /api/learning-tasks/:id
  // 可更新字段: title, description, priority, due_date, status
  fastify.put('/api/learning-tasks/:id', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const { id } = request.params
      const { title, description, priority, due_date, status } = request.body

      // 检查任务是否存在且属于当前用户
      const [taskRows] = await pool.query(
        'SELECT * FROM learning_tasks WHERE id = ? AND assigned_to = ?',
        [id, decoded.id]
      )

      if (taskRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '任务不存在或无权限访问'
        })
      }

      // 构建更新字段
      const updateFields = []
      const updateValues = []

      if (title !== undefined) {
        if (!title || title.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '任务标题不能为空'
          })
        }
        updateFields.push('title = ?')
        updateValues.push(title)
      }

      if (description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(description || null)
      }

      if (priority !== undefined) {
        if (priority && !['low', 'medium', 'high'].includes(priority)) {
          return reply.code(400).send({
            success: false,
            message: '优先级必须是 low, medium 或 high'
          })
        }
        updateFields.push('priority = ?')
        updateValues.push(priority || 'medium')
      }

      if (due_date !== undefined) {
        updateFields.push('due_date = ?')
        updateValues.push(due_date || null)
      }

      if (status !== undefined) {
        if (status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
          return reply.code(400).send({
            success: false,
            message: '状态必须是 pending, in_progress, completed 或 cancelled'
          })
        }

        // 如果状态改为完成，设置完成时间
        if (status === 'completed' && taskRows[0].status !== 'completed') {
          updateFields.push('completed_at = NOW()')
        }

        updateFields.push('status = ?')
        updateValues.push(status)
      }

      // 添加更新时间
      updateFields.push('updated_at = NOW()')

      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供可更新的字段'
        })
      }

      // 更新任务
      const query = `UPDATE learning_tasks SET ${updateFields.join(', ')} WHERE id = ?`
      updateValues.push(id)

      await pool.query(query, updateValues)

      // 获取更新后的任务
      const [updatedRows] = await pool.query(
        'SELECT * FROM learning_tasks WHERE id = ?',
        [id]
      )

      return {
        success: true,
        message: '任务更新成功',
        data: updatedRows[0]
      }
    } catch (error) {
      console.error('更新学习任务失败:', error)
      reply.code(500).send({ error: '更新学习任务失败' })
    }
  })

  // 标记任务为完成
  // PUT /api/learning-tasks/:id/complete
  fastify.put('/api/learning-tasks/:id/complete', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const { id } = request.params

      // 检查任务是否存在且属于当前用户
      const [taskRows] = await pool.query(
        'SELECT * FROM learning_tasks WHERE id = ? AND assigned_to = ?',
        [id, decoded.id]
      )

      if (taskRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '任务不存在或无权限访问'
        })
      }

      // 更新任务状态为完成
      await pool.query(
        'UPDATE learning_tasks SET status = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?',
        ['completed', id]
      )

      return {
        success: true,
        message: '任务已标记为完成'
      }
    } catch (error) {
      console.error('标记任务为完成失败:', error)
      reply.code(500).send({ error: '标记任务为完成失败' })
    }
  })

  // 删除学习任务
  // DELETE /api/learning-tasks/:id
  fastify.delete('/api/learning-tasks/:id', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const { id } = request.params

      // 检查任务是否存在且属于当前用户
      const [taskRows] = await pool.query(
        'SELECT * FROM learning_tasks WHERE id = ? AND assigned_to = ?',
        [id, decoded.id]
      )

      if (taskRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '任务不存在或无权限访问'
        })
      }

      // 删除任务
      await pool.query('DELETE FROM learning_tasks WHERE id = ?', [id])

      return {
        success: true,
        message: '任务已删除'
      }
    } catch (error) {
      console.error('删除学习任务失败:', error)
      reply.code(500).send({ error: '删除学习任务失败' })
    }
  })
}
