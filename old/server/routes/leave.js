// 请假管理 API
const { toBeijingDate } = require('../utils/time')
const { getNotificationTargets } = require('../utils/notificationHelper')
const { findApprover } = require('../utils/approvalHelper')
const { sendNotificationToUser } = require('../websocket')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 创建请假申请
  fastify.post('/api/leave/apply', async (request, reply) => {
    const { employee_id, user_id, leave_type, start_date, end_date, days, reason, attachments, use_conversion, conversion_days } = request.body

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

      // 验证转换假期余额
      const usedConversionDays = (use_conversion && conversion_days) ? parseFloat(conversion_days) : 0

      console.log('=== Leave Apply Debug ===')
      console.log('use_conversion:', use_conversion)
      console.log('conversion_days:', conversion_days)
      console.log('usedConversionDays:', usedConversionDays)
      console.log('========================')

      if (usedConversionDays > 0) {
        const [balanceResult] = await pool.query(
          `SELECT SUM(remaining_days) as total_remaining
           FROM vacation_conversions
           WHERE employee_id = ?`,
          [employee_id]
        )
        const totalRemaining = parseFloat(balanceResult[0].total_remaining || 0)

        if (usedConversionDays > totalRemaining) {
          return reply.code(400).send({
            success: false,
            message: `转换假期余额不足，当前可用: ${totalRemaining}天`
          })
        }
      }

      const attachmentsJson = attachments ? JSON.stringify(attachments) : null

      console.log('=== INSERT Parameters ===')
      console.log('Parameters array:', [employee_id, user_id, leave_type, start_date, end_date, days, reason, attachmentsJson, usedConversionDays])
      console.log('usedConversionDays value:', usedConversionDays, 'type:', typeof usedConversionDays)
      console.log('========================')

      const [result] = await pool.query(
        `INSERT INTO leave_records
        (employee_id, user_id, leave_type, start_date, end_date, days, reason, attachments, status, used_conversion_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [employee_id, user_id, leave_type, start_date, end_date, days, reason, attachmentsJson, usedConversionDays]
      )

      // 发送通知给审批人（部门主管）
      try {
        // 获取申请人的部门ID
        const [applicantInfo] = await pool.query('SELECT department_id, real_name FROM users WHERE id = ?', [user_id])
        const departmentId = applicantInfo[0]?.department_id
        const applicantName = applicantInfo[0]?.real_name

        // 1. 尝试查找部门主管作为审批人
        const approver = await findApprover(pool, user_id, departmentId)

        let targetUserIds = []

        if (approver) {
          targetUserIds.push(approver.id)
        } else {
          // 2. 如果找不到部门主管，回退到使用 notification_settings (通常配置为超级管理员或部门管理员角色)
          // 注意：如果配置的是'部门管理员'角色但没有找到具体的主管用户，getNotificationTargets 可能会返回所有拥有该角色的用户
          targetUserIds = await getNotificationTargets(pool, 'leave_apply', {
            departmentId,
            applicantId: user_id
          })
        }

        // 去重
        targetUserIds = [...new Set(targetUserIds)]

        if (targetUserIds.length > 0) {
          const startDateStr = toBeijingDate(start_date)
          const endDateStr = toBeijingDate(end_date)
          const title = '新请假申请'
          const content = `${applicantName} 申请请假 ${days} 天 (${startDateStr} 至 ${endDateStr})`

          // 批量插入通知
          const values = targetUserIds.map(uid => [
            uid, 'leave_apply', title, content, result.insertId, 'leave'
          ])

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
            [values]
          )

          // 发送WebSocket通知
          if (fastify.io) {
            targetUserIds.forEach(uid => {
              sendNotificationToUser(fastify.io, uid, {
                type: 'leave_apply',
                title,
                content,
                related_id: result.insertId,
                related_type: 'leave',
                created_at: new Date()
              })
            })
          }
        }
      } catch (notifyError) {
        console.error('发送请假申请通知失败:', notifyError)
      }

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
          DATE_FORMAT(lr.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
          lr.approval_note,
          lr.used_conversion_days,
          lr.created_at,
          lr.updated_at,
          u.real_name as approver_name
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

        // 如果使用了转换假期，扣减转换假期
        console.log('=== 转换假期扣减开始 ===');
        console.log('请假记录ID:', id);
        console.log('员工ID:', leaveRecord.employee_id);
        console.log('使用的转换假期天数(原始):', leaveRecord.used_conversion_days);
        console.log('使用的转换假期天数(类型):', typeof leaveRecord.used_conversion_days);

        if (leaveRecord.used_conversion_days && parseFloat(leaveRecord.used_conversion_days) > 0) {
          console.log('✅ 进入转换假期扣减逻辑');
          let remaining_to_use = parseFloat(leaveRecord.used_conversion_days);
          console.log('需要扣减的天数:', remaining_to_use);

          // 获取所有可用的转换记录（按创建时间排序，先进先出）
          const [conversions] = await connection.query(
            `SELECT id, remaining_days
            FROM vacation_conversions
            WHERE employee_id = ? AND remaining_days > 0
            ORDER BY created_at ASC
            FOR UPDATE`,
            [leaveRecord.employee_id]
          );

          console.log('查询到的可用转换记录数量:', conversions.length);
          console.log('转换记录详情:', JSON.stringify(conversions, null, 2));

          if (conversions.length === 0) {
            console.error('❌ 错误：没有找到可用的转换假期记录！');
            await connection.rollback();
            connection.release();
            return reply.code(400).send({
              success: false,
              message: '转换假期余额不足，无法完成审批'
            });
          }

          // 逐个扣减转换记录
          let totalDeducted = 0;
          for (const conversion of conversions) {
            if (remaining_to_use <= 0) break;

            const available = parseFloat(conversion.remaining_days);
            const to_deduct = Math.min(available, remaining_to_use);

            console.log(`处理转换记录 ID=${conversion.id}:`);
            console.log(`  - 可用天数: ${available}`);
            console.log(`  - 本次扣减: ${to_deduct}`);

            // 更新转换记录的剩余天数
            const [updateResult] = await connection.query(
              `UPDATE vacation_conversions
              SET remaining_days = remaining_days - ?
              WHERE id = ?`,
              [to_deduct, conversion.id]
            );
            console.log(`  - 更新转换记录影响行数: ${updateResult.affectedRows}`);

            // 记录使用明细
            const [insertResult] = await connection.query(
              `INSERT INTO conversion_usage_records
              (conversion_id, leave_record_id, used_days)
              VALUES (?, ?, ?)`,
              [conversion.id, id, to_deduct]
            );
            console.log(`  - 插入使用记录ID: ${insertResult.insertId}`);

            remaining_to_use -= to_deduct;
            totalDeducted += to_deduct;
          }

          console.log('转换假期扣减完成:');
          console.log('  - 总共扣减天数:', totalDeducted);
          console.log('  - 剩余未扣减:', remaining_to_use);

          if (remaining_to_use > 0.01) { // 允许小数精度误差
            console.warn('⚠️ 警告：转换假期余额不足，还有', remaining_to_use, '天未能扣减');
          }
        } else {
          console.log('❌ 未进入转换假期扣减逻辑');
          console.log('原因: used_conversion_days 为空或为0');
        }
        console.log('=== 转换假期扣减结束 ===');

        // 扣减基础假期余额（使用装饰器函数）
        if (fastify.deductLeaveBalance) {
          const year = new Date(leaveRecord.start_date).getFullYear()
          const baseDaysToDeduct = parseFloat(leaveRecord.days) - parseFloat(leaveRecord.used_conversion_days || 0)

          if (baseDaysToDeduct > 0) {
            await fastify.deductLeaveBalance(
              leaveRecord.employee_id,
              leaveRecord.user_id,
              leaveRecord.leave_type,
              baseDaysToDeduct,
              year,
              approver_id,
              request.ip
            )
          }
        }

        // 同时更新 vacation_type_balances 表（新系统）
        const year = new Date(leaveRecord.start_date).getFullYear()
        const baseDaysToDeduct = parseFloat(leaveRecord.days) - parseFloat(leaveRecord.used_conversion_days || 0)

        if (baseDaysToDeduct > 0) {
          // 映射请假类型到假期类型代码
          const typeCodeMap = {
            'annual': 'annual_leave',
            'sick': 'sick_leave',
            'personal': 'personal_leave',
            'compensatory': 'compensatory_leave',
            'overtime_leave': 'overtime_leave'
          }

          const typeCode = typeCodeMap[leaveRecord.leave_type] || `${leaveRecord.leave_type}_leave`

          // 查找对应的假期类型ID
          const [vacationTypes] = await connection.query(
            'SELECT id FROM vacation_types WHERE code = ?',
            [typeCode]
          )

          if (vacationTypes.length > 0) {
            const vacationTypeId = vacationTypes[0].id

            // 更新 vacation_type_balances 表
            await connection.query(
              `UPDATE vacation_type_balances
               SET used_days = used_days + ?
               WHERE employee_id = ? AND year = ? AND vacation_type_id = ?`,
              [baseDaysToDeduct, leaveRecord.employee_id, year, vacationTypeId]
            )
          }
        }

        console.log('🔔🔔🔔 DEBUG: 到达通知创建代码块');
        console.log('🔔🔔🔔 DEBUG: leaveRecord =', JSON.stringify(leaveRecord, null, 2));

        // 发送通知给申请人（在排班更新之前）
        try {
          console.log('=== 开始创建请假审批通知 ===')
          console.log('申请人user_id:', leaveRecord.user_id)
          console.log('请假记录ID:', id)

          if (!leaveRecord.user_id) {
            console.error('❌ 错误：user_id 为空，无法创建通知')
          } else {
            // 使用统一的时间处理函数格式化日期
            const startDateStr = toBeijingDate(leaveRecord.start_date);
            const endDateStr = toBeijingDate(leaveRecord.end_date);
            const title = '请假申请已通过'
            const content = `您的请假申请（${startDateStr} 至 ${endDateStr}）已通过审批`

            // 获取目标用户（通常是申请人，但也可能配置了其他人）
            const targetUserIds = await getNotificationTargets(pool, 'leave_approval', {
              applicantId: leaveRecord.user_id,
              departmentId: null // 审批通过通常不需要部门上下文，除非要通知部门其他人
            })

            // 确保申请人总是收到通知（如果配置中没有包含申请人，这里强制添加，或者完全依赖配置）
            // 这里我们完全依赖配置，但默认配置应该包含申请人
            // 为了安全起见，如果列表为空，我们至少通知申请人
            if (targetUserIds.length === 0) targetUserIds.push(leaveRecord.user_id)

            // 批量插入通知
            const values = targetUserIds.map(uid => [
              uid, 'leave_approval', title, content, id, 'leave'
            ])

            const [notificationResult] = await connection.query(
              `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
              [values]
            )

            console.log('✅ 通知创建成功')

            // 🔔 实时推送通知（WebSocket）
            if (fastify.io) {
              targetUserIds.forEach(uid => {
                sendNotificationToUser(fastify.io, uid, {
                  id: notificationResult.insertId, // 注意：批量插入时 insertId 是第一个ID，这里简化处理可能不准确，但不影响推送显示
                  type: 'leave_approval',
                  title,
                  content,
                  related_id: id,
                  related_type: 'leave',
                  created_at: new Date()
                })
              })
            }
          }
          console.log('=== 请假审批通知创建完成 ===')
        } catch (notificationError) {
          console.error('❌ 创建通知失败:', notificationError)
          console.error('错误详情:', notificationError.message)
          console.error('错误堆栈:', notificationError.stack)
          // 不抛出错误，允许审批继续完成
        }

        console.log('🔔🔔🔔 DEBUG: 通知创建代码块执行完毕');

        // 自动更新排班
        console.log('📍 准备调用排班更新函数...')
        try {
          if (fastify.updateScheduleForLeave) {
            await fastify.updateScheduleForLeave(leaveRecord);
            console.log('📍 排班更新函数调用完成')
          } else {
            console.log('⚠️ 排班更新函数不存在')
          }
        } catch (scheduleError) {
          console.error('❌ 排班更新出错:', scheduleError)
          console.error('错误详情:', scheduleError.message)
          // 不抛出错误，继续审批流程
        }

        console.log('💾 准备提交事务...')
        await connection.commit()
        console.log('✅ 事务提交成功！')

        connection.release()
        console.log('🔌 数据库连接已释放')

        console.log('✅✅✅ 请假审批流程完成，准备返回结果')

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
      // 获取请假记录信息
      const [leaveRecords] = await pool.query(
        'SELECT user_id, start_date, end_date FROM leave_records WHERE id = ?',
        [id]
      )

      if (leaveRecords.length === 0) {
        return reply.code(404).send({ success: false, message: '请假记录不存在' })
      }

      await pool.query(
        `UPDATE leave_records
        SET status = 'rejected', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      )

      // 发送通知给申请人
      try {
        // 使用统一的时间处理函数格式化日期
        const startDateStr = toBeijingDate(leaveRecords[0].start_date);
        const endDateStr = toBeijingDate(leaveRecords[0].end_date);
        const title = '请假申请被拒绝'
        const content = approval_note
          ? `您的请假申请（${startDateStr} 至 ${endDateStr}）被拒绝：${approval_note}`
          : `您的请假申请（${startDateStr} 至 ${endDateStr}）未通过审批`;

        // 获取目标用户
        const targetUserIds = await getNotificationTargets(pool, 'leave_rejection', {
          applicantId: leaveRecords[0].user_id
        })

        if (targetUserIds.length === 0) targetUserIds.push(leaveRecords[0].user_id)

        // 批量插入
        const values = targetUserIds.map(uid => [
          uid, 'leave_rejection', title, content, id, 'leave'
        ])

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
          [values]
        )
        console.log('✅ 拒绝通知创建成功');

        // 🔔 实时推送通知（WebSocket）
        if (fastify.io) {
          targetUserIds.forEach(uid => {
            sendNotificationToUser(fastify.io, uid, {
              type: 'leave_rejection',
              title,
              content,
              related_id: id,
              related_type: 'leave',
              created_at: new Date()
            })
          })
        }
      } catch (notificationError) {
        console.error('❌ 创建拒绝通知失败:', notificationError);
        // 不抛出错误，允许拒绝操作继续完成
      }

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
        'SELECT status, user_id, start_date, end_date FROM leave_records WHERE id = ?',
        [id]
      )

      if (records.length === 0) {
        return reply.code(404).send({ success: false, message: '请假记录不存在' })
      }

      const leave = records[0]

      if (leave.status !== 'pending') {
        return reply.code(400).send({ success: false, message: '只能撤销待审批的请假' })
      }

      await pool.query(
        'UPDATE leave_records SET status = \'cancelled\' WHERE id = ?',
        [id]
      )

      // 发送撤销通知给部门管理员
      try {
        const startDateStr = toBeijingDate(leave.start_date)
        const endDateStr = toBeijingDate(leave.end_date)

        // 获取申请人信息
        const [users] = await pool.query('SELECT real_name, department_id FROM users WHERE id = ?', [leave.user_id])
        const applicantName = users[0]?.real_name || '未知用户'
        const departmentId = users[0]?.department_id

        const title = '请假申请已撤销'
        const content = `${applicantName} 撤销了请假申请（${startDateStr} 至 ${endDateStr}）`

        // 获取目标用户 (部门管理员)
        const targetUserIds = await getNotificationTargets(pool, 'leave_cancel', {
          departmentId,
          applicantId: leave.user_id
        })

        if (targetUserIds.length > 0) {
          // 批量插入通知
          const values = targetUserIds.map(uid => [
            uid, 'leave_cancel', title, content, id, 'leave'
          ])

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
            [values]
          )

          // 发送WebSocket通知
          if (fastify.io) {
            targetUserIds.forEach(uid => {
              sendNotificationToUser(fastify.io, uid, {
                type: 'leave_cancel',
                title,
                content,
                related_id: id,
                related_type: 'leave',
                created_at: new Date()
              })
            })
          }
        }
      } catch (notifyError) {
        console.error('发送撤销通知失败:', notifyError)
      }

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
