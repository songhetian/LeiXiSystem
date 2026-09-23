// 加班管理 API
const { getBeijingNow } = require('../utils/time');
const { getNotificationTargets } = require('../utils/notificationHelper');
const { findApprover } = require('../utils/approvalHelper');
const { sendNotificationToUser } = require('../websocket');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // 获取员工加班统计
  fastify.get('/api/overtime/stats', async (request, reply) => {
    const { employee_id } = request.query;

    try {
      // 总加班时长
      const [totalHours] = await pool.query(
        `SELECT COALESCE(SUM(hours), 0) as total_hours
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved'`,
        [employee_id]
      );

      // 已调休时长
      const [compensatedHours] = await pool.query(
        `SELECT COALESCE(SUM(hours), 0) as compensated_hours
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved' AND is_compensated = 1`,
        [employee_id]
      );

      // 已转换为假期的加班时长
      const [convertedHours] = await pool.query(
        `SELECT COALESCE(SUM(source_hours), 0) as converted_hours
        FROM vacation_conversions
        WHERE employee_id = ? AND source_type = 'overtime'`,
        [employee_id]
      );

      // 获取最近的转换记录
      const [conversions] = await pool.query(
        `SELECT vc.*, cr.name as rule_name
        FROM vacation_conversions vc
        LEFT JOIN conversion_rules cr ON vc.conversion_rule_id = cr.id
        WHERE vc.employee_id = ? AND vc.source_type = 'overtime'
        ORDER BY vc.created_at DESC`,
        [employee_id]
      );

      let convertedDays = 0;
      for (const conversion of conversions) {
        convertedDays += parseFloat(conversion.converted_days);
      }

      const total = parseFloat(totalHours[0].total_hours);
      const compensated = parseFloat(compensatedHours[0].compensated_hours);
      const converted = parseFloat(convertedHours[0].converted_hours);

      return {
        success: true,
        data: {
          total_hours: total,
          compensated_hours: compensated,
          converted_hours: converted,
          remaining_hours: total - converted,
          converted_days: parseFloat(convertedDays.toFixed(2)),
          conversions: conversions.slice(0, 5) // 最近5条转换记录
        }
      };
    } catch (error) {
      console.error('获取加班统计失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 获取加班记录列表
  fastify.get('/api/overtime/records', async (request, reply) => {
    const { employee_id, status, page = 1, limit = 20 } = request.query;

    try {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = `
        SELECT
          id,
          employee_id,
          user_id,
          DATE_FORMAT(overtime_date, '%Y-%m-%d') as overtime_date,
          start_time,
          end_time,
          hours,
          reason,
          status,
          is_compensated,
          approver_id,
          approved_at,
          approval_note,
          created_at,
          updated_at
        FROM overtime_records
        WHERE 1=1
      `;
      const params = [];

      if (employee_id) {
        query += ' AND employee_id = ?';
        params.push(employee_id);
      }

      if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [records] = await pool.query(query, params);

      // 获取总数
      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM overtime_records WHERE 1=1';
      const countParams = [];

      if (employee_id) {
        countQuery += ' AND employee_id = ?';
        countParams.push(employee_id);
      }

      if (status && status !== 'all') {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }

      const [countResult] = await pool.query(countQuery, countParams);

      return {
        success: true,
        data: records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total
        }
      };
    } catch (error) {
      console.error('获取加班记录失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 申请加班 (新接口,匹配前端数据格式)
  fastify.post('/api/overtime/apply', async (request, reply) => {
    const { employee_id, user_id, overtime_date, start_time, end_time, reason } = request.body;

    if (!employee_id || !overtime_date || !start_time || !end_time) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' });
    }

    try {
      // 计算加班时长
      const startDateTime = new Date(start_time);
      const endDateTime = new Date(end_time);
      const diffMs = endDateTime - startDateTime;
      const hours = (diffMs / (1000 * 60 * 60)).toFixed(1);

      if (hours <= 0) {
        return reply.code(400).send({ success: false, message: '结束时间必须晚于开始时间' });
      }

      const [result] = await pool.query(
        `INSERT INTO overtime_records
        (employee_id, user_id, overtime_date, start_time, end_time, hours, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, user_id, overtime_date, start_time, end_time, hours, reason || '', 'pending']
      );

      // 发送通知给审批人
      try {
        // 获取申请人的部门ID
        const [applicantInfo] = await pool.query('SELECT department_id, real_name FROM users WHERE id = ?', [user_id]);
        const departmentId = applicantInfo[0]?.department_id;
        const applicantName = applicantInfo[0]?.real_name;

        // 格式化日期
        const overtimeDateObj = new Date(overtime_date);
        const formattedOvertimeDate = overtimeDateObj.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        // 1. 尝试查找部门主管作为审批人
        const approver = await findApprover(pool, user_id, departmentId);

        let targetUserIds = [];

        if (approver) {
          targetUserIds.push(approver.id);
        } else {
          // 2. 回退策略
          targetUserIds = await getNotificationTargets(pool, 'overtime_apply', {
            departmentId,
            applicantId: user_id
          });
        }

        // 去重
        targetUserIds = [...new Set(targetUserIds)];

        if (targetUserIds.length > 0) {
          const title = '新加班申请';
          const content = `${applicantName} 申请加班 ${hours} 小时 (${formattedOvertimeDate})`;

          // 批量插入通知
          const values = targetUserIds.map(uid => [
            uid, 'overtime_apply', title, content, result.insertId, 'overtime'
          ]);

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
            [values]
          );

          // 发送WebSocket通知
          if (fastify.io) {
            targetUserIds.forEach(uid => {
              sendNotificationToUser(fastify.io, uid, {
                type: 'overtime_apply',
                title,
                content,
                related_id: result.insertId,
                related_type: 'overtime',
                created_at: new Date()
              });
            });
          }
        }
      } catch (notifyError) {
        console.error('发送加班申请通知失败:', notifyError);
      }

      return {
        success: true,
        message: '申请成功',
        data: { id: result.insertId }
      };
    } catch (error) {
      console.error('申请加班失败:', error);
      return reply.code(500).send({ success: false, message: '申请失败' });
    }
  });

  // 申请加班 (旧接口,保留兼容性)
  fastify.post('/api/overtime/records', async (request, reply) => {
    const { employee_id, date, hours, reason } = request.body;

    if (!employee_id || !date || !hours) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO overtime_records (employee_id, date, hours, reason, status) VALUES (?, ?, ?, ?, ?)',
        [employee_id, date, hours, reason || '', 'pending']
      );

      return {
        success: true,
        message: '申请成功',
        data: { id: result.insertId }
      };
    } catch (error) {
      console.error('申请加班失败:', error);
      return reply.code(500).send({ success: false, message: '申请失败' });
    }
  });

  // 审批加班
  fastify.post('/api/overtime/records/:id/approve', async (request, reply) => {
    const { id } = request.params;
    const { approver_id, approval_note } = request.body;

    try {
      // 获取加班记录信息
      const [overtimeRecords] = await pool.query(
        'SELECT user_id, overtime_date, hours FROM overtime_records WHERE id = ?',
        [id]
      );

      if (overtimeRecords.length === 0) {
        return reply.code(404).send({ success: false, message: '加班记录不存在' });
      }

      // 格式化日期
      const overtimeDate = new Date(overtimeRecords[0].overtime_date);
      const formattedDate = overtimeDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      await pool.query(
        `UPDATE overtime_records
        SET status = 'approved', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      );

      // --- 通知逻辑加固：接入配置中心 ---
      try {
        const title = '加班申请已通过'
        const content = `您的加班申请（${formattedDate}，${overtimeRecords[0].hours}小时）已通过审批`
        
        const targetUserIds = await getNotificationTargets(pool, 'overtime_approval', {
          applicantId: overtimeRecords[0].user_id,
          departmentId: null
        })

        if (targetUserIds.length === 0) targetUserIds.push(overtimeRecords[0].user_id)

        const values = targetUserIds.map(uid => [
          uid, 'overtime_approval', title, content, id, 'overtime'
        ])

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
          [values]
        )

        if (fastify.io) {
          targetUserIds.forEach(uid => {
            sendNotificationToUser(fastify.io, uid, {
              type: 'overtime_approval',
              title,
              content,
              related_id: id,
              related_type: 'overtime',
              created_at: new Date()
            })
          })
        }
      } catch (notifyErr) { console.error('加班审批通知失败:', notifyErr) }

      return {
        success: true,
        message: '审批通过'
      };
    } catch (error) {
      console.error('审批加班失败:', error);
      return reply.code(500).send({ success: false, message: '审批失败' });
    }
  });

  // 拒绝加班
  fastify.post('/api/overtime/records/:id/reject', async (request, reply) => {
    const { id } = request.params;
    const { approver_id, approval_note } = request.body;

    try {
      // 获取加班记录信息
      const [overtimeRecords] = await pool.query(
        'SELECT user_id, overtime_date FROM overtime_records WHERE id = ?',
        [id]
      );

      if (overtimeRecords.length === 0) {
        return reply.code(404).send({ success: false, message: '加班记录不存在' });
      }

      // 格式化日期
      const overtimeDate = new Date(overtimeRecords[0].overtime_date);
      const formattedDate = overtimeDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      await pool.query(
        `UPDATE overtime_records
        SET status = 'rejected', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      );

      // --- 通知逻辑加固：接入配置中心 ---
      try {
        const title = '加班申请被拒绝'
        const content = approval_note || `您的加班申请（${formattedDate}）未通过审批`
        
        const targetUserIds = await getNotificationTargets(pool, 'overtime_rejection', {
          applicantId: overtimeRecords[0].user_id
        })

        if (targetUserIds.length === 0) targetUserIds.push(overtimeRecords[0].user_id)

        const values = targetUserIds.map(uid => [
          uid, 'overtime_rejection', title, content, id, 'overtime'
        ])

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES ?`,
          [values]
        )

        if (fastify.io) {
          targetUserIds.forEach(uid => {
            sendNotificationToUser(fastify.io, uid, {
              type: 'overtime_rejection',
              title,
              content,
              related_id: id,
              related_type: 'overtime',
              created_at: new Date()
            })
          })
        }
      } catch (notifyErr) { console.error('加班拒绝通知失败:', notifyErr) }

      return {
        success: true,
        message: '已拒绝'
      };
    } catch (error) {
      console.error('拒绝加班失败:', error);
      return reply.code(500).send({ success: false, message: '操作失败' });
    }
  });
};
