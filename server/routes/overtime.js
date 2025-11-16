// 加班管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 创建加班申请
  fastify.post('/api/overtime/apply', async (request, reply) => {
    const { employee_id, user_id, overtime_date, start_time, end_time, reason } = request.body

    try {
      // 计算加班时长
      const startDateTime = new Date(start_time)
      const endDateTime = new Date(end_time)
      const hours = ((endDateTime - startDateTime) / (1000 * 60 * 60)).toFixed(2)

      if (hours <= 0) {
        return reply.code(400).send({ success: false, message: '结束时间必须晚于开始时间' })
      }

      const [result] = await pool.query(
        `INSERT INTO overtime_records
        (employee_id, user_id, overtime_date, start_time, end_time, hours, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [employee_id, user_id, overtime_date, start_time, end_time, hours, reason]
      )

      return {
        success: true,
        message: '加班申请提交成功',
        data: { id: result.insertId, hours }
      }
    } catch (error) {
      console.error('创建加班申请失败:', error)
      return reply.code(500).send({ success: false, message: '申请失败' })
    }
  })

  // 获取加班记录列表
  fastify.get('/api/overtime/records', async (request, reply) => {
    const { employee_id, status, page = 1, limit = 20 } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT or_table.*, u.real_name as approver_name
        FROM overtime_records or_table
        LEFT JOIN users u ON or_table.approver_id = u.id
        WHERE or_table.employee_id = ?
      `
      const params = [employee_id]

      if (status && status !== 'all') {
        query += ' AND or_table.status = ?'
        params.push(status)
      }

      query += ' ORDER BY or_table.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [records] = await pool.query(query, params)

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM overtime_records WHERE employee_id = ?'
      const countParams = [employee_id]

      if (status && status !== 'all') {
        countQuery += ' AND status = ?'
        countParams.push(status)
      }

      const [countResult] = await pool.query(countQuery, countParams)

      return {
        success: true,
        data: records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total
        }
      }
    } catch (error) {
      console.error('获取加班记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 审批加班（通过）
  fastify.post('/api/overtime/records/:id/approve', async (request, reply) => {
    const { id } = request.params
    const { approver_id } = request.body

    try {
      await pool.query(
        `UPDATE overtime_records
        SET status = 'approved', approver_id = ?, approved_at = NOW()
        WHERE id = ?`,
        [approver_id, id]
      )

      return {
        success: true,
        message: '审批通过'
      }
    } catch (error) {
      console.error('审批加班失败:', error)
      return reply.code(500).send({ success: false, message: '审批失败' })
    }
  })

  // 拒绝加班
  fastify.post('/api/overtime/records/:id/reject', async (request, reply) => {
    const { id } = request.params
    const { approver_id } = request.body

    try {
      await pool.query(
        `UPDATE overtime_records
        SET status = 'rejected', approver_id = ?, approved_at = NOW()
        WHERE id = ?`,
        [approver_id, id]
      )

      return {
        success: true,
        message: '已拒绝加班申请'
      }
    } catch (error) {
      console.error('拒绝加班失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 加班转调休
  fastify.post('/api/overtime/records/:id/compensate', async (request, reply) => {
    const { id } = request.params

    try {
      // 检查加班记录
      const [records] = await pool.query(
        'SELECT * FROM overtime_records WHERE id = ?',
        [id]
      )

      if (records.length === 0) {
        return reply.code(404).send({ success: false, message: '加班记录不存在' })
      }

      if (records[0].status !== 'approved') {
        return reply.code(400).send({ success: false, message: '只能转换已审批的加班' })
      }

      if (records[0].is_compensated) {
        return reply.code(400).send({ success: false, message: '该加班已转换为调休' })
      }

      await pool.query(
        'UPDATE overtime_records SET is_compensated = 1, compensated_at = NOW() WHERE id = ?',
        [id]
      )

      return {
        success: true,
        message: '已转换为调休'
      }
    } catch (error) {
      console.error('加班转调休失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 获取加班统计
  fastify.get('/api/overtime/stats', async (request, reply) => {
    const { employee_id } = request.query

    try {
      // 总加班时长
      const [totalHours] = await pool.query(
        `SELECT COALESCE(SUM(hours), 0) as total_hours
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved'`,
        [employee_id]
      )

      // 已调休时长
      const [compensatedHours] = await pool.query(
        `SELECT COALESCE(SUM(hours), 0) as compensated_hours
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved' AND is_compensated = 1`,
        [employee_id]
      )

      const total = parseFloat(totalHours[0].total_hours)
      const compensated = parseFloat(compensatedHours[0].compensated_hours)

      return {
        success: true,
        data: {
          total_hours: total,
          compensated_hours: compensated,
          remaining_hours: total - compensated
        }
      }
    } catch (error) {
      console.error('获取加班统计失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })
}
