// 考勤管理 API 路由

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // ==================== 考勤规则 API ====================

  // 获取考勤规则
  fastify.get('/api/attendance/rules', async (request, reply) => {
    try {
      // 查询考勤规则
      const [rules] = await pool.query(
        `SELECT rule_type, rule_value FROM attendance_rules WHERE is_active = 1`
      )

      // 如果没有规则，创建默认规则
      if (rules.length === 0) {

        const defaultRules = [
          {
            rule_name: '上班打卡提前时间',
            rule_type: 'clock_in_advance',
            rule_value: JSON.stringify({ minutes: 60 })
          },
          {
            rule_name: '下班打卡延后时间',
            rule_type: 'clock_out_delay',
            rule_value: JSON.stringify({ minutes: 60 })
          },
          {
            rule_name: '迟到阈值',
            rule_type: 'late_threshold',
            rule_value: JSON.stringify({ minutes: 0 })
          },
          {
            rule_name: '早退阈值',
            rule_type: 'early_threshold',
            rule_value: JSON.stringify({ minutes: 0 })
          }
        ]

        // 插入默认规则
        for (const rule of defaultRules) {
          await pool.query(
            `INSERT INTO attendance_rules (rule_name, rule_type, rule_value, is_active) VALUES (?, ?, ?, 1)`,
            [rule.rule_name, rule.rule_type, rule.rule_value]
          )
        }

        // 重新查询
        const [newRules] = await pool.query(
          `SELECT rule_type, rule_value FROM attendance_rules WHERE is_active = 1`
        )
        rules.push(...newRules)
      }

      // 转换为对象格式
      const rulesObj = {}
      rules.forEach(rule => {
        try {
          const value = JSON.parse(rule.rule_value)
          rulesObj[rule.rule_type] = value.minutes || value.threshold || 0
        } catch (e) {
          console.error('解析规则失败:', rule.rule_type, e)
        }
      })


      return {
        success: true,
        data: rulesObj
      }
    } catch (error) {
      console.error('获取考勤规则失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取考勤规则失败',
        // 返回默认规则
        data: {
          clock_in_advance: 60,
          clock_out_delay: 60,
          late_threshold: 0,
          early_threshold: 0
        }
      })
    }
  })

  // 更新考勤规则
  fastify.put('/api/attendance/rules', async (request, reply) => {
    const { clock_in_advance, clock_out_delay, late_threshold, early_threshold } = request.body

    try {
      // 更新或插入规则
      const rules = [
        { type: 'clock_in_advance', name: '上班打卡提前时间', value: clock_in_advance },
        { type: 'clock_out_delay', name: '下班打卡延后时间', value: clock_out_delay },
        { type: 'late_threshold', name: '迟到阈值', value: late_threshold },
        { type: 'early_threshold', name: '早退阈值', value: early_threshold }
      ]

      for (const rule of rules) {
        if (rule.value !== undefined) {
          // 先查询是否存在
          const [existing] = await pool.query(
            `SELECT id FROM attendance_rules WHERE rule_type = ? AND is_active = 1 LIMIT 1`,
            [rule.type]
          )

          const ruleValue = JSON.stringify({ minutes: rule.value })

          if (existing.length > 0) {
            // 更新
            await pool.query(
              `UPDATE attendance_rules SET rule_value = ?, updated_at = NOW() WHERE id = ?`,
              [ruleValue, existing[0].id]
            )
          } else {
            // 插入
            await pool.query(
              `INSERT INTO attendance_rules (rule_name, rule_type, rule_value, is_active) VALUES (?, ?, ?, 1)`,
              [rule.name, rule.type, ruleValue]
            )
          }
        }
      }

      return {
        success: true,
        message: '考勤规则更新成功'
      }
    } catch (error) {
      console.error('更新考勤规则失败:', error)
      return reply.code(500).send({ success: false, message: '更新考勤规则失败' })
    }
  })

  // ==================== 打卡管理 API ====================

  // 上班打卡
  fastify.post('/api/attendance/clock-in', async (request, reply) => {
    const { employee_id, user_id, location } = request.body

    try {
      const today = new Date().toISOString().split('T')[0]

      // 检查今天是否已经打过上班卡
      const [existing] = await pool.query(
        'SELECT id FROM attendance_records WHERE employee_id = ? AND record_date = ? AND clock_in_time IS NOT NULL',
        [employee_id, today]
      )

      if (existing.length > 0) {
        return reply.code(400).send({
          success: false,
          message: '今天已经打过上班卡了'
        })
      }

      const clockInTime = new Date()

      // 获取班次信息判断是否迟到
      const [shifts] = await pool.query(
        'SELECT * FROM work_shifts WHERE is_active = 1 LIMIT 1'
      )

      let status = 'normal'
      if (shifts.length > 0) {
        const shift = shifts[0]
        const shiftStartTime = new Date(`${today} ${shift.start_time}`)
        const lateThreshold = shift.late_threshold * 60 * 1000 // 转换为毫秒

        if (clockInTime - shiftStartTime > lateThreshold) {
          status = 'late'
        }
      }

      // 创建或更新打卡记录
      const [result] = await pool.query(
        `INSERT INTO attendance_records
        (employee_id, user_id, attendance_date, record_date, clock_in_time, clock_in_location, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, user_id, today, today, clockInTime, location || null, status]
      )

      return {
        success: true,
        message: status === 'late' ? '打卡成功，但您迟到了' : '打卡成功',
        data: {
          id: result.insertId,
          clock_in_time: clockInTime,
          status
        }
      }
    } catch (error) {
      console.error('上班打卡失败:', error)
      return reply.code(500).send({
        success: false,
        message: '打卡失败'
      })
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

  // 删除今日补卡记录（测试用）
  fastify.delete('/api/attendance/makeup/today', async (request, reply) => {
    const { employee_id, date } = request.query

    try {
      await pool.query(
        'DELETE FROM attendance_makeup WHERE employee_id = ? AND attendance_date = ?',
        [employee_id, date]
      )

      return { success: true, message: '今日补卡记录已删除' }
    } catch (error) {
      console.error('删除补卡记录失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // 下班打卡
  fastify.post('/api/attendance/clock-out', async (request, reply) => {
    const { employee_id, location } = request.body


    try {
      const today = new Date().toISOString().split('T')[0]

      // 检查今天是否已经打过上班卡
      const [clockInRecord] = await pool.query(
        'SELECT id, clock_in_time FROM attendance_records WHERE employee_id = ? AND record_date = ? AND clock_in_time IS NOT NULL',
        [employee_id, today]
      )

      if (clockInRecord.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '请先打上班卡'
        })
      }

      // 检查是否已经打过下班卡
      const [clockOutRecord] = await pool.query(
        'SELECT id FROM attendance_records WHERE employee_id = ? AND record_date = ? AND clock_out_time IS NOT NULL',
        [employee_id, today]
      )

      if (clockOutRecord.length > 0) {
        return reply.code(400).send({
          success: false,
          message: '今天已经打过下班卡了'
        })
      }

      const clockOutTime = new Date()
      let status = 'normal'

      // 获取班次信息判断是否早退
      const [shifts] = await pool.query(
        'SELECT * FROM work_shifts WHERE is_active = 1 LIMIT 1'
      )

      if (shifts.length > 0) {
        const shift = shifts[0]
        const shiftEndTime = new Date(`${today} ${shift.end_time}`)
        const earlyThreshold = shift.early_threshold * 60 * 1000 // 转换为毫秒

        if (shiftEndTime - clockOutTime > earlyThreshold) {
          status = 'early'
        }
      }

      // 更新打卡记录
      await pool.query(
        `UPDATE attendance_records
         SET clock_out_time = ?, clock_out_location = ?, status = CASE WHEN status = 'late' AND ? = 'early' THEN 'late_early' WHEN status = 'normal' AND ? = 'early' THEN 'early' ELSE status END
         WHERE id = ?`,
        [clockOutTime, location || null, status, status, clockInRecord[0].id]
      )

      return {
        success: true,
        message: status === 'early' ? '打卡成功，但您早退了' : '打卡成功',
        data: {
          clock_out_time: clockOutTime,
          status
        }
      }
    } catch (error) {
      console.error('下班打卡失败:', error)
      return reply.code(500).send({
        success: false,
        message: '打卡失败'
      })
    }
  })
}
