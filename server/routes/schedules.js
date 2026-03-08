// 排班管理 API
const { extractUserPermissions, applyDepartmentFilter } = require('../middleware/checkPermission')
const { toBeijingDate } = require('../utils/time')
const dayjs = require('dayjs')

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
          CASE
            WHEN ss.is_rest_day = 1 THEN 1
            WHEN s.name LIKE '%休息%' THEN 1
            WHEN s.name LIKE '%rest%' THEN 1
            WHEN s.work_hours = 0 THEN 1
            ELSE 0
          END as is_rest_day,
          e.employee_no,
          u.real_name as employee_name,
          u.department_id,
          d.name as department_name,
          s.name as shift_name,
          s.start_time,
          s.end_time,
          s.work_hours,
          s.late_threshold,
          s.early_threshold,
          s.use_global_threshold,
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

  // 员工为自己选择班次排班
  fastify.post('/api/schedules/self', async (request, reply) => {
    const { employee_id, user_id, schedule_date, shift_id } = request.body

    try {
      // 验证必填字段和日期有效性
      if (!employee_id || !user_id || !schedule_date || !shift_id || schedule_date === '-') {
        return reply.code(400).send({ success: false, message: '请提供有效的日期和排班信息' })
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
           SET shift_id = ?, is_rest_day = 0
           WHERE id = ?`,
          [shift_id, existing[0].id]
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
        VALUES (?, ?, ?, 0)`,
        [employee_id, shift_id, schedule_date]
      )

      return {
        success: true,
        message: '排班创建成功',
        data: { id: result.insertId, updated: false }
      }
    } catch (error) {
      console.error('❌ 员工自助排班失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败: ' + error.message })
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
      // 验证必填字段和日期有效性
      if (!employee_id || !schedule_date || schedule_date === '-') {
        return reply.code(400).send({ success: false, message: '请提供有效的日期信息' })
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

  // 批量创建排班 (高性能原子版)
  fastify.post('/api/schedules/batch', async (request, reply) => {
    const { schedules } = request.body

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return reply.code(400).send({ success: false, message: '排班数据不能为空' })
    }

    try {
      // 性能优化：使用 ON DUPLICATE KEY UPDATE 语法实现单次批量写入
      // 假设 employee_id 和 schedule_date 构成了联合唯一索引或主键的一部分
      const values = schedules.map(s => [
        s.employee_id, 
        s.shift_id || null, 
        s.schedule_date, 
        s.is_rest_day ? 1 : 0
      ]);

      const sql = `
        INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          is_rest_day = VALUES(is_rest_day),
          updated_at = NOW()
      `;

      const [result] = await pool.query(sql, [values]);

      return {
        success: true,
        message: `批量排班成功，共处理 ${schedules.length} 条记录`,
        data: { affectedRows: result.affectedRows }
      }
    } catch (error) {
      console.error('批量创建排班失败:', error)
      return reply.code(500).send({ success: false, message: '批量处理失败: ' + error.message })
    }
  })

  // 更新排班
  fastify.put('/api/schedules/:id', async (request, reply) => {
    const { id } = request.params
    const { shift_id, is_rest_day } = request.body

    try {
      // 获取原排班信息
      const [existing] = await pool.query(
        `SELECT ss.*, e.user_id, DATE_FORMAT(ss.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
         s1.name as old_shift_name, s2.name as new_shift_name
         FROM shift_schedules ss
         LEFT JOIN employees e ON ss.employee_id = e.id
         LEFT JOIN work_shifts s1 ON ss.shift_id = s1.id
         LEFT JOIN work_shifts s2 ON s2.id = ?
         WHERE ss.id = ?`,
        [shift_id, id]
      )

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '排班不存在' })
      }

      const oldSchedule = existing[0]

      // 检查是否有实际变更
      const hasChange = oldSchedule.shift_id !== shift_id ||
                       (oldSchedule.is_rest_day ? 1 : 0) !== (is_rest_day ? 1 : 0)

      await pool.query(
        'UPDATE shift_schedules SET shift_id = ?, is_rest_day = ? WHERE id = ?',
        [shift_id || null, is_rest_day ? 1 : 0, id]
      )

      // 如果有变更且有user_id，创建通知
      if (hasChange && oldSchedule.user_id) {
        try {
          const oldInfo = oldSchedule.is_rest_day
            ? '休息'
            : (oldSchedule.old_shift_name || '未排班')
          const newInfo = is_rest_day
            ? '休息'
            : (oldSchedule.new_shift_name || '未排班')

          const dateStr = toBeijingDate(oldSchedule.schedule_date)

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              oldSchedule.user_id,
              'schedule_change',
              '排班变更通知',
              `您在 ${dateStr} 的排班已变更：${oldInfo} → ${newInfo}`,
              id,
              'schedule'
            ]
          )
          console.log('✅ 排班变更通知创建成功')

          // 🔔 实时推送通知（WebSocket）
          if (fastify.io) {
            const { sendNotificationToUser } = require('../websocket')
            sendNotificationToUser(fastify.io, oldSchedule.user_id, {
              type: 'schedule_change',
              title: '排班变更通知',
              content: `您在 ${dateStr} 的排班已变更：${oldInfo} → ${newInfo}`,
              related_id: id,
              related_type: 'schedule',
              created_at: new Date()
            })

            // 🔴 关键增强：同步推送最新的未读计数
            const [[notifResult]] = await pool.query(
              'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
              [oldSchedule.user_id]
            );
            const [[broadcastResult]] = await pool.query(
              `SELECT COUNT(*) as count 
               FROM broadcast_recipients br
               INNER JOIN broadcasts b ON br.broadcast_id = b.id
               WHERE br.user_id = ? AND br.is_read = FALSE
               AND (b.expires_at IS NULL OR b.expires_at > NOW())`,
              [oldSchedule.user_id]
            );
            const totalCount = (notifResult.count || 0) + (broadcastResult.count || 0);
            fastify.io.to(`user_${oldSchedule.user_id}`).emit('unread_count', { count: totalCount });
          }
        } catch (notificationError) {
          console.error('❌ 创建排班变更通知失败:', notificationError)
        }
      }

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
    console.log('🔄 开始自动更新排班...');
    console.log('📋 请假记录:', [leaveRecord]);

    const { employee_id, start_date, end_date, leave_type } = leaveRecord;

    // 计算日期范围内的所有日期
    const dates = [];
    let currentDate = new Date(start_date);
    const end = new Date(end_date);

    console.log('👤 员工ID:', employee_id, ', 开始日期:', currentDate, ', 结束日期:', end);

    while (currentDate <= end) {
      dates.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (dates.length === 0) {
      console.log('⚠️ 没有需要更新的日期，跳过排班更新');
      return; // 这里return是安全的，因为没有日期需要处理
    }

    // 获取 "休息" 班次 ID (假设 getRestShift 已注册)
    console.log('🛏️ 查询休息班次...');
    let restShiftId = null;
    if (fastify.getRestShift) {
       const restShift = await fastify.getRestShift();
       console.log('🛏️ 休息班次查询结果:', [restShift]);
       restShiftId = restShift.id;
       console.log('✅ 找到休息班次 ID:', restShiftId, ', 名称:', restShift.name);
    }

    // 批量更新排班
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    console.log('📅 日期范围:', start_date, '到', end_date);

    try {
      let updatedCount = 0;
      let createdCount = 0;

      for (const date of dates) {
        console.log('  处理日期:', date);
        // 检查已有排班
        const [existing] = await connection.query(
          'SELECT id FROM shift_schedules WHERE employee_id = ? AND schedule_date = ?',
          [employee_id, date]
        );

        if (existing.length > 0) {
          console.log('    🔄 更新现有排班记录');
          // 更新为休息，并标记为请假
          await connection.query(
             'UPDATE shift_schedules SET shift_id = ?, is_rest_day = 1 WHERE id = ?',
             [restShiftId, existing[0].id]
          );
          updatedCount++;
        } else {
          console.log('    ➕ 创建新排班记录');
          // 创建休息排班
          await connection.query(
            'INSERT INTO shift_schedules (employee_id, shift_id, schedule_date, is_rest_day) VALUES (?, ?, ?, 1)',
            [employee_id, restShiftId, date]
          );
          createdCount++;
        }
      }

      console.log('💾 排班更新：准备提交事务...')
      await connection.commit();
      console.log('✅ 排班更新：事务提交成功')
      console.log(`✅ 已自动更新员工 ${employee_id} 的排班为休息 (更新: ${updatedCount}, 创建: ${createdCount})`);
    } catch (error) {
      await connection.rollback();
      console.error('❌ 自动更新排班失败:', error);
      // 不抛出错误，以免影响审批流程
    } finally {
      connection.release();
      console.log('🔌 排班更新：数据库连接已释放');
    }

    console.log('✅ updateScheduleForLeave 函数执行完成，准备返回');
    return; // 明确返回
  });

  // 检查排班冲突
  fastify.get('/api/schedules/check-conflicts', async (request, reply) => {
    const { employee_id, start_date, end_date } = request.query;

    try {
      // 1. 检查请假冲突
      const [leaves] = await pool.query(
        `SELECT * FROM leave_records 
         WHERE employee_id = ? 
         AND status = 'approved'
         AND (
           (start_date <= ? AND end_date >= ?) OR
           (start_date <= ? AND end_date >= ?) OR
           (start_date >= ? AND end_date <= ?)
         )`,
        [employee_id, start_date, start_date, end_date, end_date, start_date, end_date]
      );

      // 2. 检查连班情况 (获取前后各7天的数据)
      const bufferStart = dayjs(start_date).subtract(7, 'day').format('YYYY-MM-DD');
      const bufferEnd = dayjs(end_date).add(7, 'day').format('YYYY-MM-DD');
      
      const [existingSchedules] = await pool.query(
        `SELECT schedule_date, is_rest_day FROM shift_schedules 
         WHERE employee_id = ? 
         AND schedule_date BETWEEN ? AND ?
         ORDER BY schedule_date ASC`,
        [employee_id, bufferStart, bufferEnd]
      );

      return {
        success: true,
        data: {
          leaves,
          existingSchedules
        }
      };
    } catch (error) {
      console.error('检查排班冲突失败:', error);
      return reply.code(500).send({ success: false, message: '检查失败' });
    }
  });

  // 删除今日排班（测试用）
  fastify.delete('/api/schedules/today', async (request, reply) => {
    const { employee_id, schedule_date } = request.query

    try {
      await pool.query(
        'DELETE FROM shift_schedules WHERE employee_id = ? AND DATE(schedule_date) = ?',
        [employee_id, schedule_date]
      )

      return { success: true, message: '今日排班已删除' }
    } catch (error) {
      console.error('删除排班失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
