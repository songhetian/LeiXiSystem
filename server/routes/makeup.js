// 补卡管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 创建补卡申请
  fastify.post('/api/makeup/apply', async (request, reply) => {
    const { employee_id, user_id, record_date, clock_type, clock_time, reason } = request.body

    try {
      // 检查是否已有补卡申请
      const [existing] = await pool.query(
        `SELECT id FROM makeup_records
        WHERE employee_id = ? AND record_date = ? AND clock_type = ? AND status = 'pending'`,
        [employee_id, record_date, clock_type]
      )

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '该日期已有待审批的补卡申请' })
      }

      const [result] = await pool.query(
        `INSERT INTO makeup_records
        (employee_id, user_id, record_date, clock_type, clock_time, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [employee_id, user_id, record_date, clock_type, clock_time, reason]
      )

      return {
        success: true,
        message: '补卡申请提交成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('创建补卡申请失败:', error)
      return reply.code(500).send({ success: false, message: '申请失败' })
    }
  })

  // 获取补卡记录列表
  fastify.get('/api/makeup/records', async (request, reply) => {
    const { employee_id, status, page = 1, limit = 20 } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT mr.*, u.real_name as approver_name
        FROM makeup_records mr
        LEFT JOIN users u ON mr.approver_id = u.id
        WHERE mr.employee_id = ?
      `
      const params = [employee_id]

      if (status && status !== 'all') {
        query += ' AND mr.status = ?'
        params.push(status)
      }

      query += ' ORDER BY mr.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [records] = await pool.query(query, params)

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM makeup_records WHERE employee_id = ?'
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
      console.error('获取补卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 审批补卡（通过）
  fastify.post('/api/makeup/records/:id/approve', async (request, reply) => {
    const { id } = request.params
    const { approver_id, approval_note } = request.body

    try {
      // 获取补卡记录
      const [makeupRecords] = await pool.query(
        'SELECT * FROM makeup_records WHERE id = ?',
        [id]
      )

      if (makeupRecords.length === 0) {
        return reply.code(404).send({ success: false, message: '补卡记录不存在' })
      }

      const makeup = makeupRecords[0]

      // 更新补卡申请状态
      await pool.query(
        `UPDATE makeup_records
        SET status = 'approved', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      )

      // 更新或创建考勤记录
      const [attendanceRecords] = await pool.query(
        'SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?',
        [makeup.employee_id, makeup.record_date]
      )

      if (attendanceRecords.length > 0) {
        // 更新现有记录
        if (makeup.clock_type === 'in') {
          await pool.query(
            'UPDATE attendance_records SET clock_in_time = ? WHERE id = ?',
            [makeup.clock_time, attendanceRecords[0].id]
          )
        } else {
          await pool.query(
            'UPDATE attendance_records SET clock_out_time = ? WHERE id = ?',
            [makeup.clock_time, attendanceRecords[0].id]
          )
        }
      } else {
        // 创建新记录
        if (makeup.clock_type === 'in') {
          await pool.query(
            `INSERT INTO attendance_records
            (employee_id, user_id, record_date, clock_in_time, status)
            VALUES (?, ?, ?, ?, 'normal')`,
            [makeup.employee_id, makeup.user_id, makeup.record_date, makeup.clock_time]
          )
        } else {
          await pool.query(
            `INSERT INTO attendance_records
            (employee_id, user_id, record_date, clock_out_time, status)
            VALUES (?, ?, ?, ?, 'normal')`,
            [makeup.employee_id, makeup.user_id, makeup.record_date, makeup.clock_time]
          )
        }
      }

      return {
        success: true,
        message: '补卡审批通过，考勤记录已更新'
      }
    } catch (error) {
      console.error('审批补卡失败:', error)
      return reply.code(500).send({ success: false, message: '审批失败' })
    }
  })

  // 拒绝补卡
  fastify.post('/api/makeup/records/:id/reject', async (request, reply) => {
    const { id } = request.params
    const { approver_id, approval_note } = request.body

    try {
      await pool.query(
        `UPDATE makeup_records
        SET status = 'rejected', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      )

      return {
        success: true,
        message: '已拒绝补卡申请'
      }
    } catch (error) {
      console.error('拒绝补卡失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 删除今日补卡记录（测试用）
  fastify.delete('/api/attendance/makeup/today', async (request, reply) => {
    const { employee_id, date } = request.query

    try {
      await pool.query(
        'DELETE FROM makeup_records WHERE employee_id = ? AND record_date = ?',
        [employee_id, date]
      )

      return { success: true, message: '今日补卡记录已删除' }
    } catch (error) {
      console.error('删除补卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
