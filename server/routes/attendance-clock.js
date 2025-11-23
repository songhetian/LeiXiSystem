// 打卡管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 上班打卡
  fastify.post('/api/attendance/clock-in', async (request, reply) => {
    const { employee_id, user_id } = request.body

    try {
      const today = new Date().toISOString().split('T')[0]

      // 检查今天是否已经打过上班卡
      const [existing] = await pool.query(
        'SELECT id FROM attendance_records WHERE employee_id = ? AND record_date = ? AND clock_in_time IS NOT NULL',
        [employee_id, today]
      )

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '今天已经打过上班卡了' })
      }

      const clockInTime = new Date()

      // 获取员工的排班信息（schedules表使用user_id，不是employee_id）
      const [schedules] = await pool.query(
        `SELECT s.*, ws.start_time, ws.end_time
         FROM schedules s
         LEFT JOIN work_shifts ws ON s.shift_id = ws.id
         WHERE s.user_id = ? AND s.schedule_date = ?`,
        [user_id, today]
      )

      // 获取考勤设置（统一使用考勤设置表的阈值）
      const [settings] = await pool.query(
        'SELECT * FROM attendance_settings WHERE id = 1'
      )

      let status = 'normal'

      if (schedules.length > 0 && schedules[0].start_time && settings.length > 0) {
        const schedule = schedules[0]
        const setting = settings[0]

        const shiftStartTime = new Date(`${today} ${schedule.start_time}`)
        // 使用考勤设置的迟到阈值（分钟转毫秒）
        const lateThreshold = (setting.late_minutes || 30) * 60 * 1000

        if (clockInTime - shiftStartTime > lateThreshold) {
          status = 'late'
        }
      }

      const [result] = await pool.query(
        `INSERT INTO attendance_records
        (employee_id, user_id, attendance_date, record_date, clock_in_time, check_in_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, user_id, today, today, clockInTime, clockInTime, status]
      )

      return {
        success: true,
        message: status === 'late' ? '打卡成功，但您迟到了' : '打卡成功',
        data: { id: result.insertId, clock_in_time: clockInTime, status }
      }
    } catch (error) {
      console.error('上班打卡失败:', error)
      return reply.code(500).send({
        success: false,
        message: '打卡失败：' + error.message,
        error: error.sqlMessage || error.message
      })
    }
  })

  // 下班打卡
  fastify.post('/api/attendance/clock-out', async (request, reply) => {
    const { employee_id, user_id } = request.body

    try {
      const today = new Date().toISOString().split('T')[0]

      // 查找今天的打卡记录
      const [records] = await pool.query(
        'SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?',
        [employee_id, today]
      )

      if (records.length === 0 || !records[0].clock_in_time) {
        return reply.code(400).send({ success: false, message: '请先打上班卡' })
      }

      if (records[0].clock_out_time) {
        return reply.code(400).send({ success: false, message: '今天已经打过下班卡了' })
      }

      const clockOutTime = new Date()
      const clockInTime = new Date(records[0].clock_in_time)

      // 计算工作时长（小时）
      const workHours = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2)

      // 获取员工的排班信息（schedules表使用user_id，不是employee_id）
      const [schedules] = await pool.query(
        `SELECT s.*, ws.start_time, ws.end_time
         FROM schedules s
         LEFT JOIN work_shifts ws ON s.shift_id = ws.id
         WHERE s.user_id = ? AND s.schedule_date = ?`,
        [user_id, today]
      )

      // 获取考勤设置（统一使用考勤设置表的阈值）
      const [settings] = await pool.query(
        'SELECT * FROM attendance_settings WHERE id = 1'
      )

      let status = records[0].status

      if (schedules.length > 0 && schedules[0].end_time && settings.length > 0) {
        const schedule = schedules[0]
        const setting = settings[0]

        const shiftEndTime = new Date(`${today} ${schedule.end_time}`)
        // 使用考勤设置的早退阈值（分钟转毫秒）
        const earlyThreshold = (setting.early_leave_minutes || 30) * 60 * 1000

        if (shiftEndTime - clockOutTime > earlyThreshold) {
          status = 'early'
        }
      }

      await pool.query(
        `UPDATE attendance_records
        SET clock_out_time = ?, work_hours = ?, status = ?
        WHERE id = ?`,
        [clockOutTime, workHours, status, records[0].id]
      )

      return {
        success: true,
        message: status === 'early' ? '打卡成功，但您早退了' : '打卡成功',
        data: { clock_out_time: clockOutTime, work_hours: workHours, status }
      }
    } catch (error) {
      console.error('下班打卡失败:', error)
      return reply.code(500).send({
        success: false,
        message: '打卡失败：' + error.message,
        error: error.sqlMessage || error.message
      })
    }
  })

  // 获取今日打卡状态
  fastify.get('/api/attendance/today', async (request, reply) => {
    const { employee_id } = request.query

    try {
      const today = new Date().toISOString().split('T')[0]

      const [records] = await pool.query(
        'SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?',
        [employee_id, today]
      )

      return {
        success: true,
        data: records.length > 0 ? records[0] : null
      }
    } catch (error) {
      console.error('获取今日打卡状态失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取打卡记录列表
  fastify.get('/api/attendance/records', async (request, reply) => {
    const { employee_id, start_date, end_date, page = 1, limit = 20 } = request.query

    try {
      const offset = (page - 1) * limit
      let query = 'SELECT * FROM attendance_records WHERE employee_id = ?'
      const params = [employee_id]

      if (start_date) {
        query += ' AND record_date >= ?'
        params.push(start_date)
      }

      if (end_date) {
        query += ' AND record_date <= ?'
        params.push(end_date)
      }

      query += ' ORDER BY record_date DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [records] = await pool.query(query, params)

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM attendance_records WHERE employee_id = ?'
      const countParams = [employee_id]

      if (start_date) {
        countQuery += ' AND record_date >= ?'
        countParams.push(start_date)
      }

      if (end_date) {
        countQuery += ' AND record_date <= ?'
        countParams.push(end_date)
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
      console.error('获取打卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 删除今日打卡记录（测试用）
  fastify.delete('/api/attendance/today', async (request, reply) => {
    const { employee_id, date } = request.query

    try {
      await pool.query(
        'DELETE FROM attendance_records WHERE employee_id = ? AND record_date = ?',
        [employee_id, date]
      )

      return { success: true, message: '今日打卡记录已删除' }
    } catch (error) {
      console.error('删除打卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
