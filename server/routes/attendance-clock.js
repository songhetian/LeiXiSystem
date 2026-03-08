// 打卡管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取北京时间日期的辅助函数
  function getBeijingDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const beijingTime = new Date(utc + (3600000 * 8)); // UTC+8
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 上班打卡
  fastify.post('/api/attendance/clock-in', async (request, reply) => {
    const { employee_id, user_id } = request.body

    try {
      const today = getBeijingDate()

      // 检查今天是否已经打过上班卡
      const [existing] = await pool.query(
        'SELECT id FROM attendance_records WHERE employee_id = ? AND record_date = ? AND clock_in_time IS NOT NULL',
        [employee_id, today]
      )

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '今天已经打过上班卡了' })
      }

      const clockInTime = new Date()

      // 获取员工的排班信息（shift_schedules表使用employee_id）
      const [schedules] = await pool.query(
        `SELECT ss.*, ws.start_time, ws.end_time, ws.work_hours,
                ws.late_threshold, ws.early_threshold, ws.use_global_threshold
         FROM shift_schedules ss
         LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
         WHERE ss.employee_id = ? AND ss.schedule_date = ?`,
        [employee_id, today]
      )

      // 获取考勤设置（统一使用考勤设置表的阈值）
      const [settings] = await pool.query(
        'SELECT * FROM attendance_settings WHERE id = 1'
      )

      // 使用班次的标准工作时长
      let workHours = 0
      if (schedules.length > 0 && schedules[0].work_hours) {
        workHours = schedules[0].work_hours
      }

      let status = 'normal'

      if (schedules.length > 0 && schedules[0].start_time && settings.length > 0) {
        const schedule = schedules[0]
        const setting = settings[0]

        const shiftStartTime = new Date(`${today} ${schedule.start_time}`)

        // 判断是否使用全局阈值
        let lateThreshold;
        if (schedule.use_global_threshold) {
           // 使用全局设置 (分钟 -> 毫秒)
           lateThreshold = (setting.late_minutes || 0) * 60 * 1000;
        } else {
           // 使用班次设置 (分钟 -> 毫秒), 默认为0
           lateThreshold = (schedule.late_threshold || 0) * 60 * 1000;
        }

        if (clockInTime - shiftStartTime > lateThreshold) {
          status = 'late'
        }
      }

      const [result] = await pool.query(
        `INSERT INTO attendance_records
        (employee_id, user_id, attendance_date, record_date, clock_in_time, check_in_time, status, work_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, user_id, today, today, clockInTime, clockInTime, status, workHours]
      )

      // 如果迟到，创建考勤异常通知
      if (status === 'late') {
        const lateMinutes = schedules.length > 0 && schedules[0].start_time
          ? Math.floor((clockInTime - new Date(`${today} ${schedules[0].start_time}`)) / 60000)
          : 0

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user_id,
            'attendance_abnormal',
            '考勤异常提醒',
            `您在 ${today} 上班打卡迟到了 ${lateMinutes} 分钟`,
            result.insertId,
            'attendance'
          ]
        )
      }

      // Redis 同步：清理个人首页缓存和月度报表缓存
      if (fastify.redis) {
        const nowUtc = new Date().getTime();
        const beijingNow = new Date(nowUtc + (3600000 * 8));
        const year = beijingNow.getFullYear();
        const month = beijingNow.getMonth() + 1;
        
        await fastify.redis.del(`stats:dashboard:${user_id}`);
        await fastify.redis.del(`stats:attendance:monthly:${employee_id}:${year}:${month}`);
        
        // 获取部门 ID 以清理部门缓存
        const [userDept] = await pool.query('SELECT department_id FROM users WHERE id = ?', [user_id]);
        if (userDept.length > 0 && userDept[0].department_id) {
          await fastify.redis.del(`stats:attendance:dept:${userDept[0].department_id}:${year}:${month}`);
        }
      }

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
      const today = getBeijingDate()
      // 用于 Redis 缓存清理的时间参考
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const beijingTime = new Date(utc + (3600000 * 8));

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

      // 计算实际工作时长 (毫秒 -> 小时)
      // 保留一位小数
      const workHours = Math.max(0, (clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(1)

      // 获取该员工今天的排班信息判断是否早退
      const [schedules] = await pool.query(
        `SELECT ss.*, ws.start_time, ws.end_time, ws.work_hours,
                ws.late_threshold, ws.early_threshold, ws.use_global_threshold
         FROM shift_schedules ss
         LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
         WHERE ss.employee_id = ? AND ss.schedule_date = ?`,
        [employee_id, today]
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

        // 判断是否使用全局阈值
        let earlyThreshold;
        if (schedule.use_global_threshold) {
           earlyThreshold = (setting.early_leave_minutes || 0) * 60 * 1000;
        } else {
           earlyThreshold = (schedule.early_threshold || 0) * 60 * 1000;
        }

        // 如果下班打卡早于 (结束时间 - 阈值)，判定为早退
        if (shiftEndTime - clockOutTime > earlyThreshold) {
          // 🔴 核心逻辑：如果上班已经迟到，状态变为“迟到且早退”
          if (status === 'late') {
            status = 'late_and_early_leave';
          } else {
            status = 'early_leave';
          }
        }
      }

      await pool.query(
        `UPDATE attendance_records
        SET clock_out_time = ?, status = ?, work_hours = ?
        WHERE id = ?`,
        [clockOutTime, status, workHours, records[0].id]
      )

      // 如果早退，创建考勤异常通知
      if (status === 'early_leave') {
        const earlyMinutes = schedules.length > 0 && schedules[0].end_time
          ? Math.floor((new Date(`${today} ${schedules[0].end_time}`) - clockOutTime) / 60000)
          : 0

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user_id,
            'attendance_abnormal',
            '考勤异常提醒',
            `您在 ${today} 下班打卡早退了 ${earlyMinutes} 分钟`,
            records[0].id,
            'attendance'
          ]
        )
      }

      // Redis 同步：清理个人首页缓存和月度报表缓存
      if (fastify.redis) {
        const year = beijingTime.getFullYear();
        const month = beijingTime.getMonth() + 1;
        
        await fastify.redis.del(`stats:dashboard:${user_id}`);
        await fastify.redis.del(`stats:attendance:monthly:${employee_id}:${year}:${month}`);
        
        // 获取部门 ID
        const [userDept] = await pool.query('SELECT department_id FROM users WHERE id = ?', [user_id]);
        if (userDept.length > 0 && userDept[0].department_id) {
          await fastify.redis.del(`stats:attendance:dept:${userDept[0].department_id}:${year}:${month}`);
        }
      }

      return {
        success: true,
        message: status === 'early_leave' ? '打卡成功，但您早退了' : '打卡成功',
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
      const today = getBeijingDate()

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
      // 1. 获取考勤记录（包含班次信息）
      let attendanceQuery = `
        SELECT
          ar.id, ar.user_id, ar.employee_id,
          DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
          ar.clock_in_time, ar.clock_out_time,
          ar.work_hours, ar.status, ar.remark,
          ar.clock_in_location, ar.clock_out_location,
          ws.name as shift_name
        FROM attendance_records ar
        LEFT JOIN shift_schedules ss ON ar.employee_id = ss.employee_id
          AND DATE(ar.record_date) = DATE(ss.schedule_date)
        LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
        WHERE ar.employee_id = ?
      `
      const attendanceParams = [employee_id]

      if (start_date) {
        attendanceQuery += ' AND record_date >= ?'
        attendanceParams.push(start_date)
      }

      if (end_date) {
        attendanceQuery += ' AND record_date <= ?'
        attendanceParams.push(end_date)
      }

      attendanceQuery += ' ORDER BY record_date DESC'
      const [attendanceRecords] = await pool.query(attendanceQuery, attendanceParams)

      // 2. 获取请假记录
      let leaveQuery = `
        SELECT
          id, employee_id, user_id,
          DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
          DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
          days, leave_type, reason, status, created_at
        FROM leave_records
        WHERE employee_id = ? AND status = 'approved'
      `
      const leaveParams = [employee_id]

      if (start_date) {
        leaveQuery += ' AND end_date >= ?'
        leaveParams.push(start_date)
      }

      if (end_date) {
        leaveQuery += ' AND start_date <= ?'
        leaveParams.push(end_date)
      }

      const [leaveRecords] = await pool.query(leaveQuery, leaveParams)

      // 3. 获取加班记录
      let overtimeQuery = `
        SELECT
          id, employee_id, user_id,
          DATE_FORMAT(overtime_date, '%Y-%m-%d') as overtime_date,
          start_time, end_time, hours, reason, status, created_at
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved'
      `
      const overtimeParams = [employee_id]

      if (start_date) {
        overtimeQuery += ' AND overtime_date >= ?'
        overtimeParams.push(start_date)
      }

      if (end_date) {
        overtimeQuery += ' AND overtime_date <= ?'
        overtimeParams.push(end_date)
      }

      const [overtimeRecords] = await pool.query(overtimeQuery, overtimeParams)

      // 4. 格式化并合并数据
      const formattedAttendance = attendanceRecords.map(r => ({
        ...r,
        type: 'attendance',
        // 修复状态枚举: 数据库中可能是 'early_leave'，前端之前用的是 'early'
        status: r.status === 'early_leave' ? 'early' : r.status
      }))

      const leaveTypeMap = {
        sick: '病假',
        annual: '年假',
        personal: '事假',
        maternity: '产假',
        other: '其他'
      }

      const formattedLeaves = leaveRecords.map(r => ({
        id: `leave_${r.id}`,
        original_id: r.id,
        employee_id: r.employee_id,
        user_id: r.user_id,
        record_date: r.start_date, // 使用开始日期作为记录日期
        start_date: r.start_date,
        end_date: r.end_date,
        days: r.days, // 添加天数
        type: 'leave',
        status: 'leave',
        leave_type: leaveTypeMap[r.leave_type] || r.leave_type, // 映射为中文
        remark: `请假: ${leaveTypeMap[r.leave_type] || r.leave_type} (${r.days}天) - ${r.reason}`,
        work_hours: 0
      }))

      const formattedOvertime = overtimeRecords.map(r => ({
        id: `overtime_${r.id}`,
        original_id: r.id,
        employee_id: r.employee_id,
        user_id: r.user_id,
        record_date: r.overtime_date, // 使用加班日期
        clock_in_time: r.start_time,
        clock_out_time: r.end_time,
        type: 'overtime',
        status: 'overtime',
        remark: `加班: ${r.hours}小时 - ${r.reason}`,
        work_hours: parseFloat(r.hours)
      }))

      // 合并所有记录
      let allRecords = [...formattedAttendance, ...formattedLeaves, ...formattedOvertime]

      // 按日期降序排序
      allRecords.sort((a, b) => new Date(b.record_date) - new Date(a.record_date))

      // 5. 过滤状态 (如果在前端过滤也可以，但在后端过滤更高效且支持分页)
      const { status } = request.query
      let filteredRecords = allRecords

      if (status && status !== 'all') {
        filteredRecords = allRecords.filter(r => {
          if (status === 'normal') return r.status === 'normal'
          if (status === 'late') return r.status === 'late'
          if (status === 'early') return r.status === 'early' || r.status === 'early_leave'
          if (status === 'absent') return r.status === 'absent'
          if (status === 'leave') return r.type === 'leave' // 请假记录都算作 leave 状态
          if (status === 'overtime') return r.type === 'overtime' // 加班记录都算作 overtime 状态
          return r.status === status
        })
      }

      // 6. 计算统计数据 (基于所有符合条件的记录)
      const stats = {
        total_days: allRecords.length,
        late_count: formattedAttendance.filter(r => r.status === 'late').length,
        early_count: formattedAttendance.filter(r => r.status === 'early' || r.status === 'early_leave').length,
        normal_count: formattedAttendance.filter(r => r.status === 'normal').length,
        absent_count: formattedAttendance.filter(r => r.status === 'absent').length,
        leave_count: formattedLeaves.length,
        overtime_count: formattedOvertime.length,
        total_work_hours: formattedAttendance.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0) +
                          formattedOvertime.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0)
      }

      stats.avg_work_hours = stats.total_days > 0
        ? (stats.total_work_hours / stats.total_days).toFixed(1)
        : '0.0'

      // 出勤率计算：正常出勤天数 / 总记录天数 (排除加班记录，因为加班通常在工作日或周末额外发生)
      // 或者更简单的：正常打卡次数 / (正常+迟到+早退+缺勤)
      const attendanceBase = stats.normal_count + stats.late_count + stats.early_count + stats.absent_count
      stats.attendance_rate = attendanceBase > 0
        ? ((stats.normal_count / attendanceBase) * 100).toFixed(1)
        : '0.0'

      // 7. 内存分页 (基于过滤后的记录)
      const total = filteredRecords.length
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + parseInt(limit)
      const paginatedRecords = filteredRecords.slice(startIndex, endIndex)

      return {
        success: true,
        data: paginatedRecords,
        stats: stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total
        }
      }
    } catch (error) {
      console.error('获取打卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败: ' + error.message })
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
