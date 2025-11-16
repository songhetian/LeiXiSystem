// 学习中心 API
const { extractUserPermissions } = require('../middleware/checkPermission')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // ==================== 学习任务 API ====================

  // 获取学习任务列表
  fastify.get('/api/learning-center/tasks', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { status } = request.query

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
  fastify.post('/api/learning-center/tasks', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { title, description, priority, due_date } = request.body

      if (!title || title.trim() === '') {
        return reply.code(400).send({ success: false, message: '任务标题不能为空' })
      }

      const [result] = await pool.query(
        `INSERT INTO learning_tasks (
          title, description, assigned_to, assigned_by, priority, due_date
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          decoded.id,
          decoded.id,
          priority || 'medium',
          due_date || null
        ]
      )

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
  fastify.put('/api/learning-center/tasks/:id', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { id } = request.params
      const { title, description, priority, due_date, status } = request.body

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

        if (status === 'completed' && taskRows[0].status !== 'completed') {
          updateFields.push('completed_at = NOW()')
        }

        updateFields.push('status = ?')
        updateValues.push(status)
      }

      updateFields.push('updated_at = NOW()')

      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供可更新的字段'
        })
      }

      const query = `UPDATE learning_tasks SET ${updateFields.join(', ')} WHERE id = ?`
      updateValues.push(id)

      await pool.query(query, updateValues)

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

  // 删除学习任务
  fastify.delete('/api/learning-center/tasks/:id', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { id } = request.params

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

  // ==================== 学习计划 API ====================

  // 获取学习计划列表
  fastify.get('/api/learning-center/plans', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { status } = request.query

      let query = `
        SELECT
          lp.*,
          u.real_name as created_by_name
        FROM learning_plans lp
        LEFT JOIN users u ON lp.created_by = u.id
        WHERE lp.created_by = ? OR lp.assigned_to = ?
      `
      const params = [decoded.id, decoded.id]

      if (status) {
        query += ' AND lp.status = ?'
        params.push(status)
      }

      query += ' ORDER BY lp.created_at DESC'

      const [rows] = await pool.query(query, params)
      return rows
    } catch (error) {
      console.error('获取学习计划列表失败:', error)
      reply.code(500).send({ error: '获取学习计划列表失败' })
    }
  })

  // 创建学习计划
  fastify.post('/api/learning-center/plans', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { title, description, start_date, end_date } = request.body

      if (!title || title.trim() === '') {
        return reply.code(400).send({ success: false, message: '计划标题不能为空' })
      }

      const [result] = await pool.query(
        `INSERT INTO learning_plans (
          title, description, created_by, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          decoded.id,
          start_date || null,
          end_date || null
        ]
      )

      const [planRows] = await pool.query(
        'SELECT * FROM learning_plans WHERE id = ?',
        [result.insertId]
      )

      return {
        success: true,
        message: '学习计划创建成功',
        data: planRows[0]
      }
    } catch (error) {
      console.error('创建学习计划失败:', error)
      reply.code(500).send({ error: '创建学习计划失败' })
    }
  })

  // 获取学习计划详情
  fastify.get('/api/learning-center/plans/:id', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { id } = request.params

      const [planRows] = await pool.query(
        `SELECT
          lp.*,
          u.real_name as created_by_name
        FROM learning_plans lp
        LEFT JOIN users u ON lp.created_by = u.id
        WHERE lp.id = ? AND (lp.created_by = ? OR lp.assigned_to = ?)`,
        [id, decoded.id, decoded.id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '学习计划不存在或无权限访问'
        })
      }

      const [detailRows] = await pool.query(
        `SELECT * FROM learning_plan_details
         WHERE plan_id = ?
         ORDER BY order_num ASC`,
        [id]
      )

      return {
        ...planRows[0],
        details: detailRows
      }
    } catch (error) {
      console.error('获取学习计划详情失败:', error)
      reply.code(500).send({ error: '获取学习计划详情失败' })
    }
  })

  // 更新学习计划
  fastify.put('/api/learning-center/plans/:id', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { id } = request.params
      const { title, description, start_date, end_date, status } = request.body

      const [planRows] = await pool.query(
        'SELECT * FROM learning_plans WHERE id = ? AND created_by = ?',
        [id, decoded.id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '学习计划不存在或无权限访问'
        })
      }

      const updateFields = []
      const updateValues = []

      if (title !== undefined) {
        if (!title || title.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '计划标题不能为空'
          })
        }
        updateFields.push('title = ?')
        updateValues.push(title)
      }

      if (description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(description || null)
      }

      if (start_date !== undefined) {
        updateFields.push('start_date = ?')
        updateValues.push(start_date || null)
      }

      if (end_date !== undefined) {
        updateFields.push('end_date = ?')
        updateValues.push(end_date || null)
      }

      if (status !== undefined) {
        if (status && !['draft', 'active', 'completed', 'cancelled'].includes(status)) {
          return reply.code(400).send({
            success: false,
            message: '状态必须是 draft, active, completed 或 cancelled'
          })
        }

        if (status === 'completed' && planRows[0].status !== 'completed') {
          updateFields.push('completed_at = NOW()')
        }

        updateFields.push('status = ?')
        updateValues.push(status)
      }

      updateFields.push('updated_at = NOW()')

      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供可更新的字段'
        })
      }

      const query = `UPDATE learning_plans SET ${updateFields.join(', ')} WHERE id = ?`
      updateValues.push(id)

      await pool.query(query, updateValues)

      const [updatedRows] = await pool.query(
        'SELECT * FROM learning_plans WHERE id = ?',
        [id]
      )

      return {
        success: true,
        message: '学习计划更新成功',
        data: updatedRows[0]
      }
    } catch (error) {
      console.error('更新学习计划失败:', error)
      reply.code(500).send({ error: '更新学习计划失败' })
    }
  })

  // 删除学习计划
  fastify.delete('/api/learning-center/plans/:id', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { id } = request.params

      const [planRows] = await pool.query(
        'SELECT * FROM learning_plans WHERE id = ? AND created_by = ?',
        [id, decoded.id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '学习计划不存在或无权限访问'
        })
      }

      await pool.query('DELETE FROM learning_plans WHERE id = ?', [id])

      return {
        success: true,
        message: '学习计划已删除'
      }
    } catch (error) {
      console.error('删除学习计划失败:', error)
      reply.code(500).send({ error: '删除学习计划失败' })
    }
  })

  // ==================== 学习统计 API ====================

  // 获取学习统计
  fastify.get('/api/learning-center/statistics', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { time_range = 'week' } = request.query || {}
      const userId = decoded.id

      // 获取任务统计
      const [taskStats] = await pool.query(
        `SELECT
          COUNT(*) as totalTasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTasks
         FROM learning_tasks
         WHERE assigned_to = ?`,
        [userId]
      )

      // 获取计划统计
      const [planStats] = await pool.query(
        `SELECT
          COUNT(*) as totalPlans,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedPlans
         FROM learning_plans
         WHERE created_by = ? OR assigned_to = ?`,
        [userId, userId]
      )

      // 获取文章阅读统计
      const [articleStats] = await pool.query(
        `SELECT COUNT(*) as articlesRead
         FROM knowledge_article_learning_records
         WHERE user_id = ? AND is_completed = 1`,
        [userId]
      )

      // 获取考试统计
      const [examStats] = await pool.query(
        `SELECT
          COUNT(*) as examsTaken,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as examsPassed
         FROM learning_records
         WHERE user_id = ? AND exam_id IS NOT NULL`,
        [userId]
      )

      // 获取总学习时长
      const [durationStats] = await pool.query(
        `SELECT SUM(duration) as totalDuration
         FROM (
           SELECT duration FROM knowledge_article_learning_records WHERE user_id = ?
           UNION ALL
           SELECT duration FROM learning_records WHERE user_id = ?
         ) as durations`,
        [userId, userId]
      )

      const statistics = {
        totalTasks: taskStats[0].totalTasks || 0,
        completedTasks: taskStats[0].completedTasks || 0,
        totalPlans: planStats[0].totalPlans || 0,
        completedPlans: planStats[0].completedPlans || 0,
        articlesRead: articleStats[0].articlesRead || 0,
        examsTaken: examStats[0].examsTaken || 0,
        examsPassed: examStats[0].examsPassed || 0,
        totalDuration: durationStats[0].totalDuration || 0
      }

      return statistics
    } catch (error) {
      console.error('获取学习统计失败:', error)
      reply.code(500).send({ error: '获取学习统计失败' })
    }
  })
}
