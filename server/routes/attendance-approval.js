// 考勤审批 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取请假记录列表（支持分页和筛选）
  fastify.get('/api/attendance/leave/records', async (request, reply) => {
    const { page = 1, limit = 10, status, start_date, end_date, employee_id } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT
          lr.id,
          lr.employee_id,
          lr.user_id,
          lr.leave_type,
          DATE_FORMAT(lr.start_date, '%Y-%m-%d') as start_date,
          DATE_FORMAT(lr.end_date, '%Y-%m-%d') as end_date,
          lr.days,
          lr.reason,
          lr.attachments,
          lr.status,
          lr.approver_id,
          lr.approved_at,
          lr.approval_note,
          lr.created_at,
          u.username as employee_name,
          a.username as approver_name
        FROM leave_records lr
        LEFT JOIN users u ON lr.user_id = u.id
        LEFT JOIN users a ON lr.approver_id = a.id
        WHERE 1=1
      `
      const params = []

      if (employee_id) {
        query += ' AND lr.employee_id = ?'
        params.push(employee_id)
      }

      if (status && status !== 'all' && status !== '') {
        query += ' AND lr.status = ?'
        params.push(status)
      }

      if (start_date) {
        query += ' AND lr.start_date >= ?'
        params.push(start_date)
      }

      if (end_date) {
        query += ' AND lr.end_date <= ?'
        params.push(end_date)
      }

      // 获取总数
      const countQuery = query.replace(
        'SELECT lr.*, u.username as employee_name, a.username as approver_name',
        'SELECT COUNT(*) as total'
      )
      const [countResult] = await pool.query(countQuery, params)
      const total = countResult[0].total

      // 分页查询
      query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [rows] = await pool.query(query, params)

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      console.error('获取请假记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取加班记录列表（支持分页和筛选）
  fastify.get('/api/attendance/overtime/records', async (request, reply) => {
    const { page = 1, limit = 10, status, start_date, end_date, employee_id } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT
          or_table.id,
          or_table.employee_id,
          or_table.user_id,
          DATE_FORMAT(or_table.overtime_date, '%Y-%m-%d') as overtime_date,
          DATE_FORMAT(or_table.start_time, '%Y-%m-%d %H:%i:%s') as start_time,
          DATE_FORMAT(or_table.end_time, '%Y-%m-%d %H:%i:%s') as end_time,
          or_table.hours,
          or_table.reason,
          or_table.status,
          or_table.approver_id,
          or_table.approved_at,
          or_table.created_at,
          u.username as employee_name,
          a.username as approver_name
        FROM overtime_records or_table
        LEFT JOIN users u ON or_table.user_id = u.id
        LEFT JOIN users a ON or_table.approver_id = a.id
        WHERE 1=1
      `
      const params = []

      if (employee_id) {
        query += ' AND or_table.employee_id = ?'
        params.push(employee_id)
      }

      if (status && status !== 'all' && status !== '') {
        query += ' AND or_table.status = ?'
        params.push(status)
      }

      if (start_date) {
        query += ' AND or_table.overtime_date >= ?'
        params.push(start_date)
      }

      if (end_date) {
        query += ' AND or_table.overtime_date <= ?'
        params.push(end_date)
      }

      // 获取总数
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM'
      )
      const [countResult] = await pool.query(countQuery, params)
      const total = countResult[0].total

      // 分页查询
      query += ' ORDER BY or_table.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [rows] = await pool.query(query, params)

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      console.error('获取加班记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取补卡记录列表（支持分页和筛选）
  fastify.get('/api/attendance/makeup/records', async (request, reply) => {
    const { page = 1, limit = 10, status, start_date, end_date, employee_id } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT
          mr.id,
          mr.employee_id,
          mr.user_id,
          DATE_FORMAT(mr.record_date, '%Y-%m-%d') as record_date,
          DATE_FORMAT(mr.clock_time, '%Y-%m-%d %H:%i:%s') as clock_time,
          mr.clock_type,
          mr.reason,
          mr.status,
          mr.approver_id,
          mr.approved_at,
          mr.approval_note,
          mr.created_at,
          u.username as employee_name,
          a.username as approver_name
        FROM makeup_records mr
        LEFT JOIN users u ON mr.user_id = u.id
        LEFT JOIN users a ON mr.approver_id = a.id
        WHERE 1=1
      `
      const params = []

      if (employee_id) {
        query += ' AND mr.employee_id = ?'
        params.push(employee_id)
      }

      if (status && status !== 'all' && status !== '') {
        query += ' AND mr.status = ?'
        params.push(status)
      }

      if (start_date) {
        query += ' AND mr.record_date >= ?'
        params.push(start_date)
      }

      if (end_date) {
        query += ' AND mr.record_date <= ?'
        params.push(end_date)
      }

      // 获取总数
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM'
      )
      const [countResult] = await pool.query(countQuery, params)
      const total = countResult[0]?.total || 0

      // 分页查询
      query += ' ORDER BY mr.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [rows] = await pool.query(query, params)

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      console.error('获取补卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 审批请假申请
  fastify.post('/api/attendance/leave/:id/approve', async (request, reply) => {
    const { id } = request.params
    const { approved, approval_note } = request.body
    const approver_id = 1 // TODO: 从登录用户获取

    try {
      const status = approved ? 'approved' : 'rejected'

      await pool.query(
        `UPDATE leave_records
        SET status = ?, approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [status, approver_id, approval_note || null, id]
      )

      return {
        success: true,
        message: approved ? '审批通过' : '审批驳回'
      }
    } catch (error) {
      console.error('审批失败:', error)
      return reply.code(500).send({ success: false, message: '审批失败' })
    }
  })

  // 审批加班申请
  fastify.post('/api/attendance/overtime/:id/approve', async (request, reply) => {
    const { id } = request.params
    const { approved, approval_note } = request.body
    const approver_id = 1 // TODO: 从登录用户获取

    try {
      const status = approved ? 'approved' : 'rejected'

      await pool.query(
        `UPDATE overtime_records
        SET status = ?, approver_id = ?, approved_at = NOW()
        WHERE id = ?`,
        [status, approver_id, id]
      )

      return {
        success: true,
        message: approved ? '审批通过' : '审批驳回'
      }
    } catch (error) {
      console.error('审批失败:', error)
      return reply.code(500).send({ success: false, message: '审批失败' })
    }
  })

  // 审批补卡申请
  fastify.post('/api/attendance/makeup/:id/approve', async (request, reply) => {
    const { id } = request.params
    const { approved, approval_note } = request.body
    const approver_id = 1 // TODO: 从登录用户获取

    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const status = approved ? 'approved' : 'rejected'

      // 获取补卡记录详情
      const [makeupRecords] = await connection.query(
        'SELECT * FROM makeup_records WHERE id = ?',
        [id]
      )

      if (makeupRecords.length === 0) {
        await connection.rollback()
        return reply.code(404).send({ success: false, message: '补卡记录不存在' })
      }

      const makeup = makeupRecords[0]

      // 更新补卡申请状态
      await connection.query(
        `UPDATE makeup_records
        SET status = ?, approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [status, approver_id, approval_note || null, id]
      )

      // 如果审批通过，更新考勤打卡记录
      if (approved) {
        // 获取该员工当天的排班信息
        const [schedules] = await connection.query(
          `SELECT ss.*, ws.start_time, ws.end_time, ws.late_threshold, ws.early_threshold
           FROM shift_schedules ss
           LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
           WHERE ss.employee_id = ? AND ss.schedule_date = ?`,
          [makeup.employee_id, makeup.record_date]
        )

        const schedule = schedules.length > 0 ? schedules[0] : null

        // 查找对应日期的考勤记录
        const [attendanceRecords] = await connection.query(
          'SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?',
          [makeup.employee_id, makeup.record_date]
        )

        if (attendanceRecords.length > 0) {
          // 更新现有考勤记录
          const record = attendanceRecords[0]
          let newClockInTime = record.clock_in_time
          let newClockOutTime = record.clock_out_time

          if (makeup.clock_type === 'in') {
            // 更新上班打卡时间
            newClockInTime = makeup.clock_time
            await connection.query(
              `UPDATE attendance_records SET clock_in_time = ? WHERE id = ?`,
              [makeup.clock_time, record.id]
            )
          } else {
            // 更新下班打卡时间
            newClockOutTime = makeup.clock_time
            await connection.query(
              `UPDATE attendance_records SET clock_out_time = ? WHERE id = ?`,
              [makeup.clock_time, record.id]
            )
          }

          // 重新计算工作时长和状态
          if (newClockInTime && newClockOutTime) {
            const clockInTime = new Date(newClockInTime)
            const clockOutTime = new Date(newClockOutTime)
            const workHours = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2)

            // 计算考勤状态
            let attendanceStatus = 'normal'

            if (schedule && schedule.start_time && schedule.end_time) {
              const recordDate = makeup.record_date
              const shiftStartTime = new Date(`${recordDate} ${schedule.start_time}`)
              const shiftEndTime = new Date(`${recordDate} ${schedule.end_time}`)

              const lateThreshold = (schedule.late_threshold || 30) * 60 * 1000
              const earlyThreshold = (schedule.early_threshold || 30) * 60 * 1000

              // 判断迟到
              if (clockInTime - shiftStartTime > lateThreshold) {
                attendanceStatus = 'late'
              }

              // 判断早退（优先级高于迟到）
              if (shiftEndTime - clockOutTime > earlyThreshold) {
                attendanceStatus = 'early'
              }
            }

            await connection.query(
              'UPDATE attendance_records SET work_hours = ?, status = ? WHERE id = ?',
              [workHours, attendanceStatus, record.id]
            )
          } else if (newClockInTime && schedule && schedule.start_time) {
            // 只有上班时间，判断是否迟到
            const clockInTime = new Date(newClockInTime)
            const recordDate = makeup.record_date
            const shiftStartTime = new Date(`${recordDate} ${schedule.start_time}`)
            const lateThreshold = (schedule.late_threshold || 30) * 60 * 1000

            let attendanceStatus = 'normal'
            if (clockInTime - shiftStartTime > lateThreshold) {
              attendanceStatus = 'late'
            }

            await connection.query(
              'UPDATE attendance_records SET status = ? WHERE id = ?',
              [attendanceStatus, record.id]
            )
          }
        } else {
          // 创建新的考勤记录
          let attendanceStatus = 'normal'

          // 如果有排班信息，判断状态
          if (schedule && schedule.start_time && makeup.clock_type === 'in') {
            const clockInTime = new Date(makeup.clock_time)
            const recordDate = makeup.record_date
            const shiftStartTime = new Date(`${recordDate} ${schedule.start_time}`)
            const lateThreshold = (schedule.late_threshold || 30) * 60 * 1000

            if (clockInTime - shiftStartTime > lateThreshold) {
              attendanceStatus = 'late'
            }
          }

          if (makeup.clock_type === 'in') {
            await connection.query(
              `INSERT INTO attendance_records
              (employee_id, user_id, record_date, clock_in_time, status)
              VALUES (?, ?, ?, ?, ?)`,
              [makeup.employee_id, makeup.user_id, makeup.record_date, makeup.clock_time, attendanceStatus]
            )
          } else {
            await connection.query(
              `INSERT INTO attendance_records
              (employee_id, user_id, record_date, clock_out_time, status)
              VALUES (?, ?, ?, ?, ?)`,
              [makeup.employee_id, makeup.user_id, makeup.record_date, makeup.clock_time, attendanceStatus]
            )
          }
        }
      }

      await connection.commit()

      return {
        success: true,
        message: approved ? '审批通过，考勤记录已更新' : '审批驳回'
      }
    } catch (error) {
      await connection.rollback()
      console.error('审批失败:', error)
      return reply.code(500).send({ success: false, message: '审批失败' })
    } finally {
      connection.release()
    }
  })
}
