// 请假管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 创建请假申请
  fastify.post('/api/leave/apply', async (request, reply) => {
    const { employee_id, user_id, leave_type, start_date, end_date, days, reason, attachments } = request.body

    try {
      // 验证日期
      if (new Date(start_date) > new Date(end_date)) {
        return reply.code(400).send({ success: false, message: '开始日期不能晚于结束日期' })
      }

      // 检查是否有重叠的请假记录
      const [overlapping] = await pool.query(
        `SELECT id FROM leave_records
        WHERE employee_id = ?
        AND status IN ('pending', 'approved')
        AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))`,
        [employee_id, start_date, start_date, end_date, end_date]
      )

      if (overlapping.length > 0) {
        return reply.code(400).send({ success: false, message: '该时间段已有请假记录' })
      }

      const attachmentsJson = attachments ? JSON.stringify(attachments) : null

      const [result] = await pool.query(
        `INSERT INTO leave_records
        (employee_id, user_id, leave_type, start_date, end_date, days, reason, attachments, status, use_converted_leave)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [employee_id, user_id, leave_type, start_date, end_date, days, reason, attachmentsJson, request.body.use_converted_leave ? 1 : 0]
      )

      return {
        success: true,
        message: '请假申请提交成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('创建请假申请失败:', error)
      return reply.code(500).send({ success: false, message: '申请失败' })
    }
  })

  // 获取请假记录列表
  fastify.get('/api/leave/records', async (request, reply) => {
    const { employee_id, status, page = 1, limit = 20 } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT lr.*, u.real_name as approver_name
        FROM leave_records lr
        LEFT JOIN users u ON lr.approver_id = u.id
        WHERE 1=1
      `
      const params = []

      if (employee_id) {
        query += ' AND lr.employee_id = ?'
        params.push(employee_id)
      }

      if (status && status !== 'all') {
        query += ' AND lr.status = ?'
        params.push(status)
      }

      query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [records] = await pool.query(query, params)

      // 获取总数
      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM leave_records WHERE 1=1'
      const countParams = []

      if (employee_id) {
        countQuery += ' AND employee_id = ?'
        countParams.push(employee_id)
      }

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
      console.error('获取请假记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取待审批的请假列表（主管用）
  fastify.get('/api/leave/pending', async (request, reply) => {
    const { department_id } = request.query

    try {
      let query = `
        SELECT lr.*, u.real_name as employee_name, e.employee_no
        FROM leave_records lr
        LEFT JOIN users u ON lr.user_id = u.id
        LEFT JOIN employees e ON lr.employee_id = e.id
        WHERE lr.status = 'pending'
      `
      const params = []

      if (department_id) {
        query += ' AND u.department_id = ?'
        params.push(department_id)
      }

      query += ' ORDER BY lr.created_at DESC'

      const [records] = await pool.query(query, params)

      return {
        success: true,
        data: records
      }
    } catch (error) {
      console.error('获取待审批请假列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 审批请假（通过）
  fastify.post('/api/leave/records/:id/approve', async (request, reply) => {
    const { id } = request.params
    const { approver_id, approval_note } = request.body

    try {
      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        // 获取请假记录
        const [leaveRecords] = await connection.query(
          'SELECT * FROM leave_records WHERE id = ?',
          [id]
        )

        if (leaveRecords.length === 0) {
          await connection.rollback()
          connection.release()
          return reply.code(404).send({ success: false, message: '请假记录不存在' })
        }

        const leaveRecord = leaveRecords[0]

        // 更新请假记录状态
        await connection.query(
          `UPDATE leave_records
          SET status = 'approved', approver_id = ?, approved_at = NOW(), approval_note = ?
          WHERE id = ?`,
          [approver_id, approval_note || null, id]
        )

        // 扣减假期余额（使用装饰器函数）
        if (fastify.deductLeaveBalance) {
          const year = new Date(leaveRecord.start_date).getFullYear()

          // 检查是否使用转换假期
          let leaveTypeToDeduct = leaveRecord.leave_type;
          let daysToDeduct = leaveRecord.days;

          if (leaveRecord.use_converted_leave) {
            // 获取当前余额
            const balance = await fastify.getVacationBalance(leaveRecord.employee_id, leaveRecord.user_id, year);
            const convertedRemaining = parseFloat(balance.overtime_leave_total || 0) - parseFloat(balance.overtime_leave_used || 0);

            if (convertedRemaining > 0) {
              if (convertedRemaining >= daysToDeduct) {
                // 转换假期足够，全部使用转换假期
                leaveTypeToDeduct = 'overtime_leave';
              } else {
                // 转换假期不足，部分使用
                // 1. 扣除所有剩余转换假期
                await fastify.deductLeaveBalance(
                  leaveRecord.employee_id,
                  leaveRecord.user_id,
                  'overtime_leave',
                  convertedRemaining,
                  year,
                  approver_id,
                  request.ip
                );

                // 2. 剩余部分使用原申请类型
                daysToDeduct = daysToDeduct - convertedRemaining;
                // leaveTypeToDeduct 保持原值 (e.g. 'annual')
              }
            }
          }

          await fastify.deductLeaveBalance(
            leaveRecord.employee_id,
            leaveRecord.user_id,
            leaveTypeToDeduct,
            daysToDeduct,
            year,
            approver_id,
            request.ip
          )
        }

        // 自动更新排班
        if (fastify.updateScheduleForLeave) {
          await fastify.updateScheduleForLeave(leaveRecord);
        }

        await connection.commit()
        connection.release()

        return {
          success: true,
          message: '审批通过'
        }
      } catch (error) {
        await connection.rollback()
        connection.release()
        throw error
      }
    } catch (error) {
      console.error('审批请假失败:', error)
      return reply.code(500).send({ success: false, message: '审批失败' })
    }
  })

  // 拒绝请假
  fastify.post('/api/leave/records/:id/reject', async (request, reply) => {
    const { id } = request.params
    const { approver_id, approval_note } = request.body

    try {
      await pool.query(
        `UPDATE leave_records
        SET status = 'rejected', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      )

      return {
        success: true,
        message: '已拒绝请假申请'
      }
    } catch (error) {
      console.error('拒绝请假失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 撤销请假
  fastify.post('/api/leave/records/:id/cancel', async (request, reply) => {
    const { id } = request.params

    try {
      // 只能撤销待审批的请假
      const [records] = await pool.query(
        'SELECT status FROM leave_records WHERE id = ?',
        [id]
      )

      if (records.length === 0) {
        return reply.code(404).send({ success: false, message: '请假记录不存在' })
      }

      if (records[0].status !== 'pending') {
        return reply.code(400).send({ success: false, message: '只能撤销待审批的请假' })
      }

      await pool.query(
        'UPDATE leave_records SET status = \'cancelled\' WHERE id = ?',
        [id]
      )

      return {
        success: true,
        message: '已撤销请假申请'
      }
    } catch (error) {
      console.error('撤销请假失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 获取请假余额
  fastify.get('/api/leave/balance', async (request, reply) => {
    const { employee_id } = request.query

    try {
      // 获取年假和病假的已用天数
      const [annualLeave] = await pool.query(
        `SELECT COALESCE(SUM(days), 0) as used_days
        FROM leave_records
        WHERE employee_id = ? AND leave_type = 'annual' AND status = 'approved'
        AND YEAR(start_date) = YEAR(CURDATE())`,
        [employee_id]
      )

      const [sickLeave] = await pool.query(
        `SELECT COALESCE(SUM(days), 0) as used_days
        FROM leave_records
        WHERE employee_id = ? AND leave_type = 'sick' AND status = 'approved'
        AND YEAR(start_date) = YEAR(CURDATE())`,
        [employee_id]
      )

      // 从规则表获取额度（这里简化处理，实际应该从规则表读取）
      const annualTotal = 5
      const sickTotal = 10

      return {
        success: true,
        data: {
          annual: {
            total: annualTotal,
            used: parseFloat(annualLeave[0].used_days),
            remaining: annualTotal - parseFloat(annualLeave[0].used_days)
          },
          sick: {
            total: sickTotal,
            used: parseFloat(sickLeave[0].used_days),
            remaining: sickTotal - parseFloat(sickLeave[0].used_days)
          }
        }
      }
    } catch (error) {
      console.error('获取请假余额失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })
}
