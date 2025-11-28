// 加班管理 API
const { getBeijingNow } = require('../utils/time');

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
        `SELECT COALESCE(SUM(oc.overtime_hours), 0) as converted_hours
        FROM overtime_conversions oc
        WHERE oc.employee_id = ?`,
        [employee_id]
      );

      // 计算已转换的假期天数 (基于转换规则)
      const [conversions] = await pool.query(
        `SELECT oc.*, vt.code as target_type_code
        FROM overtime_conversions oc
        LEFT JOIN vacation_types vt ON oc.target_vacation_type_id = vt.id
        WHERE oc.employee_id = ?
        ORDER BY oc.created_at DESC`,
        [employee_id]
      );

      let convertedDays = 0;
      for (const conversion of conversions) {
        // 获取转换规则
        let conversionRatio = 1.0;
        if (conversion.conversion_rule_id) {
          const [rules] = await pool.query(
            'SELECT ratio FROM conversion_rules WHERE id = ? AND enabled = TRUE',
            [conversion.conversion_rule_id]
          );
          if (rules.length > 0) {
            conversionRatio = parseFloat(rules[0].ratio);
          }
        }

        // 计算转换天数 (加班小时 * 比例 / 8小时)
        const days = (parseFloat(conversion.overtime_hours) * conversionRatio) / 8;
        convertedDays += days;
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
          remaining_hours: total - compensated - converted,
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
        SELECT *
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
      await pool.query(
        `UPDATE overtime_records
        SET status = 'approved', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      );

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
      await pool.query(
        `UPDATE overtime_records
        SET status = 'rejected', approver_id = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?`,
        [approver_id, approval_note || null, id]
      );

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
