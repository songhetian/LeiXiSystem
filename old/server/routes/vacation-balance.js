// 假期余额管理 API
module.exports = async function (fastify, opts) {
  const pool = fastify.mysql
  const { getBeijingNow } = require('../utils/time')

  // 获取或初始化员工假期余额
  async function getOrCreateVacationBalance(employeeId, userId, year) {
    const [balances] = await pool.query(
      'SELECT * FROM vacation_balances WHERE employee_id = ? AND year = ?',
      [employeeId, year]
    )

    if (balances.length > 0) {
      return balances[0]
    }

    // 获取默认配置
    const [settings] = await pool.query(
      'SELECT setting_key, setting_value FROM vacation_settings WHERE setting_key IN ("annual_leave_default", "sick_leave_default")'
    )

    const annualDefault = parseFloat(settings.find(s => s.setting_key === 'annual_leave_default')?.setting_value || 5)
    const sickDefault = parseFloat(settings.find(s => s.setting_key === 'sick_leave_default')?.setting_value || 10)

    // 创建新记录
    const [result] = await pool.query(
      `INSERT INTO vacation_balances
       (employee_id, user_id, year, annual_leave_total, sick_leave_total)
       VALUES (?, ?, ?, ?, ?)`,
      [employeeId, userId, year, annualDefault, sickDefault]
    )

    const [newBalance] = await pool.query(
      'SELECT * FROM vacation_balances WHERE id = ?',
      [result.insertId]
    )

    return newBalance[0]
  }

  // 创建审计日志
  async function createAuditLog(connection, employeeId, userId, operationType, operationDetail, balanceBefore, balanceAfter, operatorId, ipAddress) {
    await connection.query(
      `INSERT INTO vacation_audit_logs
       (employee_id, user_id, operation_type, operation_detail, balance_before, balance_after, operator_id, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        userId,
        operationType,
        JSON.stringify(operationDetail),
        JSON.stringify(balanceBefore),
        JSON.stringify(balanceAfter),
        operatorId,
        ipAddress
      ]
    )
  }

  // 获取个人假期余额
  fastify.get('/api/vacation/balance', async (request, reply) => {
    const { employee_id, year = parseInt(getBeijingNow().substring(0, 4)) } = request.query

    try {
      if (!employee_id) {
        return reply.code(400).send({ success: false, message: '缺少员工ID参数' })
      }

      // 获取用户ID
      const [employees] = await pool.query(
        'SELECT user_id FROM employees WHERE id = ?',
        [employee_id]
      )

      if (employees.length === 0) {
        return reply.code(404).send({ success: false, message: '员工不存在' })
      }

      const balance = await getOrCreateVacationBalance(employee_id, employees[0].user_id, year)


      // 计算剩余天数
      const data = {
        ...balance,
        annual_leave_remaining: parseFloat(balance.annual_leave_total) - parseFloat(balance.annual_leave_used),
        sick_leave_remaining: parseFloat(balance.sick_leave_total) - parseFloat(balance.sick_leave_used),
        compensatory_leave_remaining: parseFloat(balance.compensatory_leave_total) - parseFloat(balance.compensatory_leave_used),
        overtime_leave_remaining: parseFloat(balance.overtime_leave_total || 0) - parseFloat(balance.overtime_leave_used || 0),
        overtime_hours_remaining: parseFloat(balance.overtime_hours_total) - parseFloat(balance.overtime_hours_converted)
      }

      return { success: true, data }
    } catch (error) {
      console.error('获取假期余额失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取全员假期余额汇总（HR权限）
  fastify.get('/api/vacation/balance/all', async (request, reply) => {
    const { department_id, search, year = parseInt(getBeijingNow().substring(0, 4)), page = 1, limit = 20 } = request.query

    try {
      const offset = (page - 1) * limit
      let query = `
        SELECT
          vb.*,
          e.employee_no,
          u.real_name,
          u.username,
          d.name as department_name,
          (vb.annual_leave_total - vb.annual_leave_used) as annual_leave_remaining,
          (vb.sick_leave_total - vb.sick_leave_used) as sick_leave_remaining,
          (vb.compensatory_leave_total - vb.compensatory_leave_used) as compensatory_leave_remaining,
          (COALESCE(vb.overtime_leave_total, 0) - COALESCE(vb.overtime_leave_used, 0)) as overtime_leave_remaining,
          (vb.overtime_hours_total - vb.overtime_hours_converted) as overtime_hours_remaining
        FROM vacation_balances vb
        LEFT JOIN employees e ON vb.employee_id = e.id
        LEFT JOIN users u ON vb.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE vb.year = ?
      `
      const params = [year]

      if (department_id) {
        query += ' AND u.department_id = ?'
        params.push(department_id)
      }

      if (search) {
        query += ' AND (u.real_name LIKE ? OR u.username LIKE ? OR e.employee_no LIKE ?)'
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern)
      }

      query += ' ORDER BY vb.created_at DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [records] = await pool.query(query, params)

      // 获取总数
      let countQuery = `
        SELECT COUNT(*) as total
        FROM vacation_balances vb
        LEFT JOIN users u ON vb.user_id = u.id
        WHERE vb.year = ?
      `
      const countParams = [year]

      if (department_id) {
        countQuery += ' AND u.department_id = ?'
        countParams.push(department_id)
      }

      if (search) {
        countQuery += ' AND (u.real_name LIKE ? OR u.username LIKE ?)'
        const searchPattern = `%${search}%`
        countParams.push(searchPattern, searchPattern)
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
      console.error('获取全员假期余额失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 手动调整假期余额（HR权限）
  fastify.post('/api/vacation/balance/adjust', async (request, reply) => {
    const { employee_id, year, adjustments, operator_id, reason } = request.body

    try {
      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        // 获取用户ID
        const [employees] = await connection.query(
          'SELECT user_id FROM employees WHERE id = ?',
          [employee_id]
        )

        if (employees.length === 0) {
          await connection.rollback()
          connection.release()
          return reply.code(404).send({ success: false, message: '员工不存在' })
        }

        const userId = employees[0].user_id

        // 获取调整前的余额
        const balanceBefore = await getOrCreateVacationBalance(employee_id, userId, year)

        // 更新余额
        const updates = []
        const updateValues = []

        if (adjustments.annual_leave_total !== undefined) {
          updates.push('annual_leave_total = ?')
          updateValues.push(adjustments.annual_leave_total)
        }
        if (adjustments.sick_leave_total !== undefined) {
          updates.push('sick_leave_total = ?')
          updateValues.push(adjustments.sick_leave_total)
        }
        if (adjustments.compensatory_leave_total !== undefined) {
          updates.push('compensatory_leave_total = ?')
          updateValues.push(adjustments.compensatory_leave_total)
        }

        if (updates.length > 0) {
          updateValues.push(employee_id, year)
          await connection.query(
            `UPDATE vacation_balances SET ${updates.join(', ')} WHERE employee_id = ? AND year = ?`,
            updateValues
          )
        }

        // 获取调整后的余额
        const [balanceAfterRows] = await connection.query(
          'SELECT * FROM vacation_balances WHERE employee_id = ? AND year = ?',
          [employee_id, year]
        )
        const balanceAfter = balanceAfterRows[0]

        // 创建审计日志
        await createAuditLog(
          connection,
          employee_id,
          userId,
          'balance_adjust',
          { reason, adjustments },
          balanceBefore,
          balanceAfter,
          operator_id,
          request.ip
        )

        await connection.commit()
        connection.release()

        return { success: true, message: '余额调整成功', data: balanceAfter }
      } catch (error) {
        await connection.rollback()
        connection.release()
        throw error
      }
    } catch (error) {
      console.error('调整假期余额失败:', error)
      return reply.code(500).send({ success: false, message: '调整失败' })
    }
  })

  // 获取假期余额变更历史
  fastify.get('/api/vacation/balance/history', async (request, reply) => {
    const { employee_id, page = 1, limit = 20 } = request.query

    try {
      if (!employee_id) {
        return reply.code(400).send({ success: false, message: '缺少员工ID参数' })
      }

      const offset = (page - 1) * limit

      const [records] = await pool.query(
        `SELECT
          val.*,
          u.real_name as operator_name
        FROM vacation_audit_logs val
        LEFT JOIN users u ON val.operator_id = u.id
        WHERE val.employee_id = ?
        ORDER BY val.created_at DESC
        LIMIT ? OFFSET ?`,
        [employee_id, parseInt(limit), offset]
      )

      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM vacation_audit_logs WHERE employee_id = ?',
        [employee_id]
      )

      // Process records to flatten structure for frontend
      const formattedRecords = records.map(record => {
        const detail = typeof record.operation_detail === 'string'
          ? JSON.parse(record.operation_detail)
          : record.operation_detail;

        const balanceAfter = typeof record.balance_after === 'string'
          ? JSON.parse(record.balance_after)
          : record.balance_after;

        let changeType = 'adjustment';
        let leaveType = 'general';
        let amount = 0;
        let reason = detail.reason || '-';

        switch (record.operation_type) {
          case 'leave_approve':
            changeType = 'deduction';
            leaveType = detail.leaveType;
            amount = -detail.days;
            reason = '请假扣减';
            break;
          case 'overtime_approve':
            changeType = 'addition';
            leaveType = 'overtime_hours';
            amount = detail.hours;
            reason = '加班累计';
            break;
          case 'overtime_convert':
            changeType = 'conversion';
            leaveType = 'compensatory_leave';
            amount = detail.days;
            reason = `加班转调休 (${detail.hours}小时 -> ${detail.days}天)`;
            break;
          case 'balance_adjust':
          case 'batch_adjust':
            changeType = 'adjustment';
            // Try to find what changed
            if (detail.adjustments) {
              const adj = detail.adjustments;
              if (adj.annual_leave_total) { leaveType = 'annual_leave'; amount = adj.annual_leave_total; }
              else if (adj.sick_leave_total) { leaveType = 'sick_leave'; amount = adj.sick_leave_total; }
              else if (adj.compensatory_leave_total) { leaveType = 'compensatory_leave'; amount = adj.compensatory_leave_total; }
            }
            break;
        }

        return {
          id: record.id,
          created_at: record.created_at,
          operator_name: record.operator_name,
          change_type: changeType,
          leave_type: leaveType,
          amount: amount,
          balance_after: balanceAfter ? (balanceAfter.annual_leave_total || balanceAfter.total_days) : null, // Simplified
          reason: reason,
          full_detail: detail // Keep full detail just in case
        };
      });

      return {
        success: true,
        data: formattedRecords,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total
        }
      }
    } catch (error) {
      console.error('获取余额变更历史失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 暴露获取余额函数供其他模块调用
  fastify.decorate('getVacationBalance', getOrCreateVacationBalance)

  // 扣减假期余额（内部函数，供其他模块调用）
  fastify.decorate('deductLeaveBalance', async function(employeeId, userId, leaveType, days, year, operatorId, ipAddress) {
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // 获取扣减前的余额
      const balanceBefore = await getOrCreateVacationBalance(employeeId, userId, year)

      // 映射请假类型到字段名
      const fieldMap = {
        'annual': 'annual_leave_used',
        'sick': 'sick_leave_used',
        'compensatory': 'compensatory_leave_used',
        'overtime_leave': 'overtime_leave_used'
      }

      const field = fieldMap[leaveType]
      if (!field) {
        throw new Error(`不支持的请假类型: ${leaveType}`)
      }

      // 更新余额
      await connection.query(
        `UPDATE vacation_balances SET ${field} = ${field} + ? WHERE employee_id = ? AND year = ?`,
        [days, employeeId, year]
      )

      // 获取扣减后的余额
      const [balanceAfterRows] = await connection.query(
        'SELECT * FROM vacation_balances WHERE employee_id = ? AND year = ?',
        [employeeId, year]
      )
      const balanceAfter = balanceAfterRows[0]

      // 创建审计日志
      await createAuditLog(
        connection,
        employeeId,
        userId,
        'leave_approve',
        { leaveType, days },
        balanceBefore,
        balanceAfter,
        operatorId,
        ipAddress
      )

      await connection.commit()
      connection.release()

      return { success: true, balanceAfter }
    } catch (error) {
      await connection.rollback()
      connection.release()
      throw error
    }
  })

  // 累计加班时长（内部函数，供其他模块调用）
  fastify.decorate('accumulateOvertimeHours', async function(employeeId, userId, hours, year, operatorId, ipAddress) {
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // 获取累计前的余额
      const balanceBefore = await getOrCreateVacationBalance(employeeId, userId, year)

      // 更新加班总时长
      await connection.query(
        'UPDATE vacation_balances SET overtime_hours_total = overtime_hours_total + ? WHERE employee_id = ? AND year = ?',
        [hours, employeeId, year]
      )

      // 获取累计后的余额
      const [balanceAfterRows] = await connection.query(
        'SELECT * FROM vacation_balances WHERE employee_id = ? AND year = ?',
        [employeeId, year]
      )
      const balanceAfter = balanceAfterRows[0]

      // 创建审计日志
      await createAuditLog(
        connection,
        employeeId,
        userId,
        'overtime_approve',
        { hours },
        balanceBefore,
        balanceAfter,
        operatorId,
        ipAddress
      )

      await connection.commit()
      connection.release()

      return { success: true, balanceAfter }
    } catch (error) {
      await connection.rollback()
      connection.release()
      throw error
    }
  })

  

  // 批量调整假期额度
  fastify.post('/api/vacation/balance/batch-adjust', async (request, reply) => {
    const { filters, adjustment_type, adjustments, operator_id, reason } = request.body

    if (!filters || !adjustments || !reason) {
      return reply.code(400).send({ success: false, message: '参数不完整' })
    }

    try {
      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        // 1. 获取目标员工
        let query = `
          SELECT e.id, e.user_id, u.real_name
          FROM employees e
          LEFT JOIN users u ON e.user_id = u.id
          WHERE e.status = 'active'
        `
        const params = []

        if (filters.department_id) {
          query += ' AND u.department_id = ?'
          params.push(filters.department_id)
        }

        if (filters.search) {
          query += ' AND (u.real_name LIKE ? OR e.employee_no LIKE ?)'
          params.push(`%${filters.search}%`, `%${filters.search}%`)
        }

        const [employees] = await connection.query(query, params)
        let updatedCount = 0

        // 2. 遍历更新
        for (const emp of employees) {
          // 获取或创建余额记录 (使用当前连接)
          let [balances] = await connection.query(
            'SELECT * FROM vacation_balances WHERE employee_id = ? AND year = ? FOR UPDATE',
            [emp.id, filters.year]
          )

          let balanceBefore = null
          let balanceData = null

          if (balances.length === 0) {
            // 获取默认配置
            const [settings] = await connection.query(
              'SELECT setting_key, setting_value FROM vacation_settings WHERE setting_key IN ("annual_leave_default", "sick_leave_default")'
            )
            const annualDefault = parseFloat(settings.find(s => s.setting_key === 'annual_leave_default')?.setting_value || 5)
            const sickDefault = parseFloat(settings.find(s => s.setting_key === 'sick_leave_default')?.setting_value || 10)

            // 创建新记录
            const [insertResult] = await connection.query(
              `INSERT INTO vacation_balances
               (employee_id, user_id, year, annual_leave_total, sick_leave_total, compensatory_leave_total)
               VALUES (?, ?, ?, ?, ?, 0)`,
              [emp.id, emp.user_id, filters.year, annualDefault, sickDefault]
            )

            balanceData = {
              id: insertResult.insertId,
              employee_id: emp.id,
              user_id: emp.user_id,
              year: filters.year,
              annual_leave_total: annualDefault,
              sick_leave_total: sickDefault,
              compensatory_leave_total: 0
            }

            // 新建记录的"变更前"状态可以视为0或默认值，这里为了记录清晰，设为初始值
            balanceBefore = { ...balanceData }
          } else {
            balanceData = balances[0]
            balanceBefore = { ...balanceData }
          }

          // 计算新值
          let hasChange = false
          const newValues = { ...balanceData }

          // 处理年假
          if (adjustments.annual_leave_total !== '' && adjustments.annual_leave_total !== null) {
            const val = parseFloat(adjustments.annual_leave_total)
            if (adjustment_type === 'set') newValues.annual_leave_total = val
            else if (adjustment_type === 'increase') newValues.annual_leave_total += val
            else if (adjustment_type === 'decrease') newValues.annual_leave_total = Math.max(0, newValues.annual_leave_total - val)
            hasChange = true
          }

          // 处理病假
          if (adjustments.sick_leave_total !== '' && adjustments.sick_leave_total !== null) {
            const val = parseFloat(adjustments.sick_leave_total)
            if (adjustment_type === 'set') newValues.sick_leave_total = val
            else if (adjustment_type === 'increase') newValues.sick_leave_total += val
            else if (adjustment_type === 'decrease') newValues.sick_leave_total = Math.max(0, newValues.sick_leave_total - val)
            hasChange = true
          }

          // 处理调休
          if (adjustments.compensatory_leave_total !== '' && adjustments.compensatory_leave_total !== null) {
            const val = parseFloat(adjustments.compensatory_leave_total)
            if (adjustment_type === 'set') newValues.compensatory_leave_total = val
            else if (adjustment_type === 'increase') newValues.compensatory_leave_total += val
            else if (adjustment_type === 'decrease') newValues.compensatory_leave_total = Math.max(0, newValues.compensatory_leave_total - val)
            hasChange = true
          }

          if (hasChange) {
            // 更新数据库
            await connection.query(
              `UPDATE vacation_balances
               SET annual_leave_total = ?, sick_leave_total = ?, compensatory_leave_total = ?
               WHERE id = ?`,
              [newValues.annual_leave_total, newValues.sick_leave_total, newValues.compensatory_leave_total, balanceData.id]
            )

            // 创建审计日志
            await createAuditLog(
              connection,
              emp.id,
              emp.user_id,
              'batch_adjust',
              {
                reason,
                adjustment_type,
                adjustments,
                filters
              },
              balanceBefore,
              newValues,
              operator_id,
              request.ip
            )

            updatedCount++
          }
        }

        await connection.commit()
        connection.release()

        return { success: true, updatedCount, message: `成功更新 ${updatedCount} 条记录` }
      } catch (error) {
        await connection.rollback()
        connection.release()
        throw error
      }
    } catch (error) {
      console.error('批量调整额度失败:', error)
      return reply.code(500).send({ success: false, message: '批量调整失败: ' + error.message })
    }
  })
}
