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

  // ==================== 追踪 API ====================

  // 记录查看时长
  fastify.post('/api/tracking/view-duration', async (request, reply) => {
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

      const { fileId, durationSeconds, type } = request.body
      const userId = decoded.id

      if (!fileId || durationSeconds === undefined || type === undefined) {
        return reply.code(400).send({ success: false, message: '缺少必要的追踪数据 (fileId, durationSeconds, type)' })
      }

      await pool.query(
        `INSERT INTO viewing_durations (file_id, duration_seconds, type, user_id)
         VALUES (?, ?, ?, ?)`,
        [fileId, durationSeconds, type, userId]
      )

      return { success: true, message: '查看时长已记录' }
    } catch (error) {
      console.error('记录查看时长失败:', error)
      reply.code(500).send({ error: '记录查看时长失败' })
    }
  })

  // ==================== 观看统计 API ====================

  // 获取观看统计数据
  fastify.get('/api/tracking/statistics', async (request, reply) => {
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

      const { departmentId, userId, page = 1, pageSize = 10 } = request.query
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      let baseQuery = `
        FROM viewing_durations vd
        JOIN users u ON vd.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
      `
      const params = []

      if (departmentId) {
        baseQuery += ' AND u.department_id = ?'
        params.push(departmentId)
      }

      if (userId) {
        baseQuery += ' AND vd.user_id = ?'
        params.push(userId)
      }

      // Get total count
      const [countRows] = await pool.query(`SELECT COUNT(DISTINCT vd.user_id) AS total ${baseQuery}`, params);
      const totalItems = countRows[0].total;

      let dataQuery = `
        SELECT
          vd.user_id,
          u.real_name AS user_name,
          u.department_id,
          d.name AS department_name,
          SUM(vd.duration_seconds) AS total_view_duration_seconds,
          COUNT(DISTINCT vd.file_id) AS unique_files_viewed
        ${baseQuery}
        GROUP BY vd.user_id, u.real_name, u.department_id, d.name
        ORDER BY total_view_duration_seconds DESC
        LIMIT ? OFFSET ?
      `
      const dataParams = [...params, limit, offset];

      const [rows] = await pool.query(dataQuery, dataParams)

      return reply.code(200).send({
        success: true,
        message: '观看统计数据获取成功',
        data: rows,
        totalItems,
        currentPage: parseInt(page),
        pageSize: limit,
        totalPages: Math.ceil(totalItems / limit)
      })
    } catch (error) {
      console.error('获取观看统计数据失败:', error)
      reply.code(500).send({ error: '获取观看统计数据失败' })
    }
  })

  // 导出观看统计数据到 Excel
  fastify.get('/api/tracking/export-excel', async (request, reply) => {
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

      const { departmentId, userId } = request.query

      let query = `
        SELECT
          vd.user_id,
          u.real_name AS user_name,
          u.department_id,
          d.name AS department_name,
          SUM(vd.duration_seconds) AS total_view_duration_seconds,
          COUNT(DISTINCT vd.file_id) AS unique_files_viewed
        FROM viewing_durations vd
        JOIN users u ON vd.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
      `
      const params = []

      if (departmentId) {
        query += ' AND u.department_id = ?'
        params.push(departmentId)
      }

      if (userId) {
        query += ' AND vd.user_id = ?'
        params.push(userId)
      }

      query += `
        GROUP BY vd.user_id, u.real_name, u.department_id, d.name
        ORDER BY total_view_duration_seconds DESC
      `

      const [rows] = await pool.query(query, params)

      // Generate Excel file
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('观看统计');

      // Add headers
      worksheet.columns = [
        { header: '用户ID', key: 'user_id', width: 10 },
        { header: '用户姓名', key: 'user_name', width: 20 },
        { header: '部门ID', key: 'department_id', width: 10 },
        { header: '部门名称', key: 'department_name', width: 20 },
        { header: '总观看时长 (秒)', key: 'total_view_duration_seconds', width: 20 },
        { header: '独立观看文件数', key: 'unique_files_viewed', width: 20 },
      ];

      // Add data rows
      worksheet.addRows(rows);

      // Set response headers for Excel download
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', 'attachment; filename="viewing_statistics.xlsx"');

      // Write workbook to buffer and send as response
      const buffer = await workbook.xlsx.writeBuffer();
      return reply.send(buffer);

    } catch (error) {
      console.error('导出观看统计数据失败:', error)
      reply.code(500).send({ error: '导出观看统计数据失败' })
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
