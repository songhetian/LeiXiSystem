// 学习计划管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取学习计划列表
  // GET /api/learning-plans
  // 支持状态筛选: draft, active, completed
  fastify.get('/api/learning-plans', async (request, reply) => {
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
          lp.*,
          u.real_name as created_by_name
        FROM learning_plans lp
        LEFT JOIN users u ON lp.created_by = u.id
        WHERE lp.created_by = ? OR lp.assigned_to = ?
      `
      const params = [decoded.id, decoded.id]

      // 根据状态筛选
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
  // POST /api/learning-plans
  // 必填字段: title
  // 可选字段: description, start_date, end_date
  fastify.post('/api/learning-plans', async (request, reply) => {
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

      const { title, description, start_date, end_date } = request.body

      // 必填字段验证
      if (!title || title.trim() === '') {
        return reply.code(400).send({
          success: false,
          message: '计划标题不能为空'
        })
      }

      // 插入计划数据
      const [result] = await pool.query(
        `INSERT INTO learning_plans (
          title,
          description,
          created_by,
          start_date,
          end_date
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          decoded.id, // 创建者
          start_date || null,
          end_date || null
        ]
      )

      // 获取创建的计划
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
  // GET /api/learning-plans/:id
  fastify.get('/api/learning-plans/:id', async (request, reply) => {
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

      // 检查计划是否存在且用户有权限访问
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

      // 获取计划详情
      const [detailRows] = await pool.query(
        `SELECT id, plan_id, article_id, exam_id, title, description, order_num, status, progress, completed_at, created_at, updated_at
         FROM learning_plan_details
         WHERE plan_id = ?
         ORDER BY order_num ASC`,
        [id]
      );

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
  // PUT /api/learning-plans/:id
  // 可更新字段: title, description, start_date, end_date, status
  fastify.put('/api/learning-plans/:id', async (request, reply) => {
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
      const { title, description, start_date, end_date, status } = request.body

      // 检查计划是否存在且属于当前用户
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

      // 构建更新字段
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

        // 如果状态改为完成，设置完成时间
        if (status === 'completed' && planRows[0].status !== 'completed') {
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

      // 更新计划
      const query = `UPDATE learning_plans SET ${updateFields.join(', ')} WHERE id = ?`
      updateValues.push(id)

      await pool.query(query, updateValues)

      // 获取更新后的计划
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
  // DELETE /api/learning-plans/:id
  fastify.delete('/api/learning-plans/:id', async (request, reply) => {
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

      // 检查计划是否存在且属于当前用户
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

      // 删除计划（会级联删除详情）
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

  // 为学习计划添加项目
  // POST /api/learning-plans/:id/details
  fastify.post('/api/learning-plans/:id/details', async (request, reply) => {
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
      const { title, description, article_id, exam_id, order_num } = request.body

      // 检查计划是否存在且属于当前用户
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

      // 必填字段验证
      if (!title || title.trim() === '') {
        return reply.code(400).send({
          success: false,
          message: '项目标题不能为空'
        })
      }

      // 插入详情数据
      const [result] = await pool.query(
        `INSERT INTO learning_plan_details (
          plan_id,
          title,
          description,
          article_id,
          exam_id,
          order_num
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          title,
          description || null,
          article_id || null,
          exam_id || null,
          order_num || 1
        ]
      )

      // 获取创建的详情
      const [detailRows] = await pool.query(
        'SELECT * FROM learning_plan_details WHERE id = ?',
        [result.insertId]
      )

      return {
        success: true,
        message: '计划项目添加成功',
        data: detailRows[0]
      }
    } catch (error) {
      console.error('添加计划项目失败:', error)
      reply.code(500).send({ error: '添加计划项目失败' })
    }
  })

  // 更新学习计划项目
  // PUT /api/learning-plans/:planId/details/:detailId
  fastify.put('/api/learning-plans/:planId/details/:detailId', async (request, reply) => {
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

      const { planId, detailId } = request.params;
      const { title, description, article_id, exam_id, order_num, status, progress } = request.body;

      // 检查计划是否存在且属于当前用户
      const [planRows] = await pool.query(
        'SELECT * FROM learning_plans WHERE id = ? AND created_by = ?',
        [planId, decoded.id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '学习计划不存在或无权限访问'
        })
      }

      // 检查详情是否存在
      const [detailRows] = await pool.query(
        'SELECT * FROM learning_plan_details WHERE id = ? AND plan_id = ?',
        [detailId, planId]
      )

      if (detailRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '计划项目不存在'
        })
      }

      // 构建更新字段
      const updateFields = []
      const updateValues = []

      if (title !== undefined) {
        if (!title || title.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '项目标题不能为空'
          })
        }
        updateFields.push('title = ?')
        updateValues.push(title)
      }

      if (description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(description || null)
      }

      if (article_id !== undefined) {
        updateFields.push('article_id = ?')
        updateValues.push(article_id || null)
      }

      if (exam_id !== undefined) {
        updateFields.push('exam_id = ?')
        updateValues.push(exam_id || null)
      }

      if (order_num !== undefined) {
        updateFields.push('order_num = ?')
        updateValues.push(order_num || 1)
      }

      if (status !== undefined) {
        if (status && !['pending', 'completed'].includes(status)) {
          return reply.code(400).send({
            success: false,
            message: '状态必须是 pending 或 completed'
          })
        }

        // 如果状态改为完成，设置完成时间
        if (status === 'completed' && detailRows[0].status !== 'completed') {
          updateFields.push('completed_at = NOW()')
        }

        updateFields.push('status = ?')
        updateValues.push(status)
      }

      // 处理进度字段
      if (progress !== undefined) {
        // 确保进度在0-100范围内
        const validProgress = Math.max(0, Math.min(100, parseInt(progress) || 0));
        updateFields.push('progress = ?');
        updateValues.push(validProgress);
      }

      // 添加更新时间
      updateFields.push('updated_at = NOW()')

      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供可更新的字段'
        })
      }

      // 更新详情
      const query = `UPDATE learning_plan_details SET ${updateFields.join(', ')} WHERE id = ?`
      updateValues.push(detailId)

      await pool.query(query, updateValues)

      // 获取更新后的详情
      const [updatedRows] = await pool.query(
        'SELECT * FROM learning_plan_details WHERE id = ?',
        [detailId]
      )

      return {
        success: true,
        message: '计划项目更新成功',
        data: updatedRows[0]
      }
    } catch (error) {
      console.error('更新计划项目失败:', error)
      reply.code(500).send({ error: '更新计划项目失败' })
    }
  })

  // 删除学习计划项目
  // DELETE /api/learning-plans/:planId/details/:detailId
  fastify.delete('/api/learning-plans/:planId/details/:detailId', async (request, reply) => {
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

      const { planId, detailId } = request.params

      // 检查计划是否存在且属于当前用户
      const [planRows] = await pool.query(
        'SELECT * FROM learning_plans WHERE id = ? AND created_by = ?',
        [planId, decoded.id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '学习计划不存在或无权限访问'
        })
      }

      // 检查详情是否存在
      const [detailRows] = await pool.query(
        'SELECT * FROM learning_plan_details WHERE id = ? AND plan_id = ?',
        [detailId, planId]
      )

      if (detailRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '计划项目不存在'
        })
      }

      // 删除详情
      await pool.query('DELETE FROM learning_plan_details WHERE id = ?', [detailId])

      return {
        success: true,
        message: '计划项目已删除'
      }
    } catch (error) {
      console.error('删除计划项目失败:', error)
      reply.code(500).send({ error: '删除计划项目失败' })
    }
  })
}
