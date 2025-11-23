// 排班管理 API
const { extractUserPermissions, applyDepartmentFilter } = require('../middleware/checkPermission')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取排班列表
  fastify.get('/api/schedules', async (request, reply) => {
    const { employee_id, department_id, start_date, end_date } = request.query

    try {

      // 获取用户权限
      const permissions = await extractUserPermissions(request, pool)

      // 构建基础查询
      let query = `
        SELECT
          ss.id,
          ss.employee_id,
          ss.shift_id,
          DATE_FORMAT(ss.schedule_date, '%Y-%m-%d') as schedule_date,
          ss.is_rest_day,
          e.employee_no,
          u.real_name as employee_name,
          u.department_id,
          d.name as department_name,
          s.name as shift_name,
          s.start_time,
          s.end_time,
          s.color
        FROM shift_schedules ss
        LEFT JOIN employees e ON ss.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN work_shifts s ON ss.shift_id = s.id
        WHERE 1=1
      `
      let params = []

      // 如果指定了employee_id，说明是查询个人排班，不需要部门权限过滤
      if (employee_id) {
        query += ' AND ss.employee_id = ?'
        params.push(parseInt(employee_id))
      } else {
        // 只有在查询多人排班时才应用部门权限过滤
        const filtered = applyDepartmentFilter(permissions, query, params, 'u.department_id')
        query = filtered.query
        params = filtered.params

        // 如果前端传了 department_id 参数，进一步过滤
        if (department_id) {
          query += ' AND u.department_id = ?'
          params.push(parseInt(department_id))
        }
      }

      if (start_date) {
        query += ' AND DATE(ss.schedule_date) >= ?'
        params.push(start_date)
      }

      if (end_date) {
        query += ' AND DATE(ss.schedule_date) <= ?'
        params.push(end_date)
      }

      query += ' ORDER BY ss.schedule_date, u.real_name'
      const [rows] = await pool.query(query, params)

      return { success: true, data: rows }
    } catch (error) {
      console.error('❌ 获取排班列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 创建单个排班（如果已存在则更新）
  fastify.post('/api/schedules', async (request, reply) => {
    let { employee_id, shift_id, schedule_date, is_rest_day } = request.body

    // 修复时区问题：确保日期格式正确
    // 如果 schedule_date 是 "2025-11-01"，保持原样
    // 如果包含时间，只取日期部分
    if (schedule_date && schedule_date.includes('T')) {
      schedule_date = schedule_date.split('T')[0]
    }

    try {
      // 验证必填字段
      if (!employee_id || !schedule_date) {
        return reply.code(400).send({ success: false, message: '请填写完整信息' })
      }

      // 检查是否已有排班（包括带时间戳的旧数据）
      const [existing] = await pool.query(
        `SELECT id FROM shift_schedules
         WHERE employee_id = ?
         AND (schedule_date = ? OR DATE(schedule_date) = ?)`,
        [employee_id, schedule_date, schedule_date]
      )

      if (existing.length > 0) {
        // 如果已存在，则更新
        const [updateResult] = await pool.query(
          `UPDATE shift_schedules
           SET shift_id = ?, is_rest_day = ?
           WHERE id = ?`,
          [shift_id || null, is_rest_day ? 1 : 0, existing[0].id]
        )

        return {
          success: true,
          message: '排班更新成功',
          data: { id: existing[0].id, updated: true }
        }
      }

      // 如果不存在，则创建
      // 直接使用日期字符串，不做时区转换
      const [result] = await pool.query(
        `INSERT INTO shift_schedules
        (employee_id, shift_id, schedule_date, is_rest_day)
        VALUES (?, ?, ?, ?)`,
        [employee_id, shift_id || null, schedule_date, is_rest_day ? 1 : 0]
      )

      return {
        success: true,
        message: '排班创建成功',
        data: { id: result.insertId, updated: false }
      }
    } catch (error) {
      console.error('❌ 创建排班失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败: ' + error.message })
    }
  })

  // 批量创建排班
  fastify.post('/api/schedules/batch', async (request, reply) => {
    const { schedules } = request.body

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return reply.code(400).send({ success: false, message: '排班数据不能为空' })
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      let successCount = 0
      let skipCount = 0

      for (const schedule of schedules) {
        const { employee_id, shift_id, schedule_date, is_rest_day } = schedule

        // 检查是否已有排班
        const [existing] = await connection.query(
          'SELECT id FROM shift_schedules WHERE employee_id = ? AND schedule_date = ?',
          [employee_id, schedule_date]
        )

        if (existing.length > 0) {
          // 更新现有排班
          await connection.query(
            'UPDATE shift_schedules SET shift_id = ?, is_rest_day = ? WHERE id = ?',
            [shift_id || null, is_rest_day ? 1 : 0, existing[0].id]
          )
          successCount++
        } else {
          // 创建新排班
          await connection.query(
            'INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day) VALUES (?, ?, ?, ?)',
            [employee_id, shift_id || null, schedule_date, is_rest_day ? 1 : 0]
          )
          successCount++
        }
      }

      await connection.commit()
      connection.release()

      return {
        success: true,
        message: `批量排班成功，共处理 ${successCount} 条记录`,
        data: { successCount, skipCount }
      }
    } catch (error) {
      await connection.rollback()
      connection.release()
      console.error('批量创建排班失败:', error)
      return reply.code(500).send({ success: false, message: '批量创建失败' })
    }
  })

  // 更新排班
  fastify.put('/api/schedules/:id', async (request, reply) => {
    const { id } = request.params
    const { shift_id, is_rest_day } = request.body

    try {
      const [existing] = await pool.query('SELECT id FROM shift_schedules WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '排班不存在' })
      }

      await pool.query(
        'UPDATE shift_schedules SET shift_id = ?, is_rest_day = ? WHERE id = ?',
        [shift_id || null, is_rest_day ? 1 : 0, id]
      )

      return {
        success: true,
        message: '排班更新成功'
      }
    } catch (error) {
      console.error('更新排班失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除排班
  fastify.delete('/api/schedules/:id', async (request, reply) => {
    const { id } = request.params

    try {
      await pool.query('DELETE FROM shift_schedules WHERE id = ?', [id])
      return {
        success: true,
        message: '排班删除成功'
      }
    } catch (error) {
      console.error('删除排班失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // 批量删除排班
  fastify.post('/api/schedules/batch-delete', async (request, reply) => {
    const { ids } = request.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ success: false, message: 'ID列表不能为空' })
    }

    try {
      const placeholders = ids.map(() => '?').join(',')
      await pool.query(`DELETE FROM shift_schedules WHERE id IN (${placeholders})`, ids)

      return {
        success: true,
        message: `成功删除 ${ids.length} 条排班记录`
      }
    } catch (error) {
      console.error('批量删除排班失败:', error)
      return reply.code(500).send({ success: false, message: '批量删除失败' })
    }
  })

  // 复制排班模板
  fastify.post('/api/schedules/copy-template', async (request, reply) => {
    const { source_start_date, source_end_date, target_start_date, employee_ids } = request.body

    if (!source_start_date || !source_end_date || !target_start_date) {
      return reply.code(400).send({ success: false, message: '请提供完整的日期信息' })
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // 获取源排班数据
      let query = `
        SELECT employee_id, shift_id, is_rest_day,
               DATEDIFF(schedule_date, ?) as day_offset
        FROM shift_schedules
        WHERE schedule_date BETWEEN ? AND ?
      `
      const params = [source_start_date, source_start_date, source_end_date]

      if (employee_ids && employee_ids.length > 0) {
        const placeholders = employee_ids.map(() => '?').join(',')
        query += ` AND employee_id IN (${placeholders})`
        params.push(...employee_ids)
      }

      const [sourceSchedules] = await connection.query(query, params)

      if (sourceSchedules.length === 0) {
        await connection.rollback()
        connection.release()
        return reply.code(400).send({ success: false, message: '源日期范围内没有排班数据' })
      }

      // 创建目标排班
      let successCount = 0
      for (const schedule of sourceSchedules) {
        const targetDate = new Date(target_start_date)
        targetDate.setDate(targetDate.getDate() + schedule.day_offset)
        const targetDateStr = targetDate.toISOString().split('T')[0]

        // 检查目标日期是否已有排班
        const [existing] = await connection.query(
          'SELECT id FROM shift_schedules WHERE employee_id = ? AND schedule_date = ?',
          [schedule.employee_id, targetDateStr]
        )

        if (existing.length === 0) {
          await connection.query(
            'INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day) VALUES (?, ?, ?, ?)',
            [schedule.employee_id, schedule.shift_id, targetDateStr, schedule.is_rest_day]
          )
          successCount++
        }
      }

      await connection.commit()
      connection.release()

      return {
        success: true,
        message: `成功复制 ${successCount} 条排班记录`,
        data: { successCount }
      }
    } catch (error) {
      await connection.rollback()
      connection.release()
      console.error('复制排班模板失败:', error)
      return reply.code(500).send({ success: false, message: '复制失败' })
    }
  })
  // 自动更新排班（供请假审批调用）
  fastify.decorate('updateScheduleForLeave', async function(leaveRecord) {
    const { employee_id, start_date, end_date, leave_type } = leaveRecord;

    // 计算日期范围内的所有日期
    const dates = [];
    let currentDate = new Date(start_date);
    const end = new Date(end_date);

    while (currentDate <= end) {
      dates.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (dates.length === 0) return;

    // 获取 "休息" 班次 ID (假设 getRestShift 已注册)
    let restShiftId = null;
    if (fastify.getRestShift) {
       const restShift = await fastify.getRestShift();
       restShiftId = restShift.id;
    }

    // 批量更新排班
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      for (const date of dates) {
        // 检查已有排班
        const [existing] = await connection.query(
          'SELECT id FROM shift_schedules WHERE employee_id = ? AND schedule_date = ?',
          [employee_id, date]
        );

        if (existing.length > 0) {
          // 更新为休息，并标记为请假
          await connection.query(
             'UPDATE shift_schedules SET shift_id = ?, is_rest_day = 1 WHERE id = ?',
             [restShiftId, existing[0].id]
          );
        } else {
          // 创建休息排班
          await connection.query(
            'INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day) VALUES (?, ?, ?, 1)',
            [employee_id, restShiftId, date]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('自动更新排班失败:', error);
      // 不抛出错误，以免影响审批流程
    } finally {
      connection.release();
    }
  });

  // 删除今日排班（测试用）
  fastify.delete('/api/schedules/today', async (request, reply) => {
    const { employee_id, date } = request.query

    try {
      await pool.query(
        'DELETE FROM shift_schedules WHERE employee_id = ? AND DATE(schedule_date) = ?',
        [employee_id, date]
      )

      return { success: true, message: '今日排班已删除' }
    } catch (error) {
      console.error('删除排班失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
