// 假期转换记录管理 API
module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // 创建转换记录（从加班时长转换）
  fastify.post('/api/vacation/convert-from-overtime', async (request, reply) => {
    const { employee_id, user_id, overtime_hours, notes } = request.body;

    if (!employee_id || !overtime_hours) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' });
    }

    try {
      // 查询启用的转换规则（移除source_type条件）
      const [rules] = await pool.query(
        `SELECT * FROM conversion_rules
        WHERE enabled = TRUE
        ORDER BY id DESC LIMIT 1`
      );

      if (rules.length === 0) {
        return reply.code(400).send({ success: false, message: '未找到启用的转换规则' });
      }

      const rule = rules[0];
      const ratio = parseFloat(rule.ratio || rule.conversion_rate || 0.125);
      const hoursPerDay = Math.round(1 / ratio); // 例如：8小时/天

      // 计算可以转换成多少整天
      const totalHours = parseFloat(overtime_hours);
      const wholeDays = Math.floor(totalHours / hoursPerDay); // 例如：23 / 8 = 2天

      // 计算实际需要转换的小时数（整天对应的小时）
      const hoursToConvert = wholeDays * hoursPerDay; // 例如：2 * 8 = 16小时

      const converted_days = wholeDays;

      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // 1. 计算总加班时长 (已审批)
        const [totalResult] = await connection.query(
          `SELECT COALESCE(SUM(hours), 0) as total_hours
           FROM overtime_records
           WHERE employee_id = ? AND status = 'approved'`,
          [employee_id]
        );
        const totalHours = parseFloat(totalResult[0].total_hours);

        // 2. 计算已转换时长 (从 vacation_conversions 表)
        const [convertedResult] = await connection.query(
          `SELECT COALESCE(SUM(source_hours), 0) as converted_hours
           FROM vacation_conversions
           WHERE employee_id = ? AND source_type = 'overtime'`,
          [employee_id]
        );
        const convertedHours = parseFloat(convertedResult[0].converted_hours);

        // 3. 计算剩余可用时长 (不扣减调休)
        const remainingHours = totalHours - convertedHours;

        if (hoursToConvert > remainingHours) {
          await connection.rollback();
          connection.release();
          return reply.code(400).send({ success: false, message: `加班余额不足，当前剩余: ${remainingHours}小时` });
        }

        // 5. 插入转换记录
        const [result] = await connection.query(
          `INSERT INTO vacation_conversions
          (user_id, employee_id, source_type, source_hours, converted_days, remaining_days, conversion_ratio, conversion_rule_id, notes)
          VALUES (?, ?, 'overtime', ?, ?, ?, ?, ?, ?)`,
          [user_id, employee_id, hoursToConvert, converted_days, converted_days, ratio, rule.id, notes || null]
        );

        await connection.commit();
        connection.release();

        return {
          success: true,
          message: '转换成功',
          data: {
            conversion_id: result.insertId,
            converted_days: converted_days,
            remaining_days: converted_days,
            rule_name: rule.name,
            ratio: ratio
          }
        };
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error('创建转换记录失败:', error);
      return reply.code(500).send({ success: false, message: '转换失败' });
    }
  });

  // 查询转换假期余额
  fastify.get('/api/vacation/conversion-balance/:employee_id', async (request, reply) => {
    const { employee_id } = request.params;

    try {
      // 查询所有转换记录
      const [conversions] = await pool.query(
        `SELECT
          id,
          source_type,
          source_hours,
          converted_days,
          remaining_days,
          conversion_ratio,
          notes,
          created_at
        FROM vacation_conversions
        WHERE employee_id = ?
        ORDER BY created_at DESC`,
        [employee_id]
      );

      // 查询已使用天数 (从 conversion_usage_records 表)
      const [usageResult] = await pool.query(
        `SELECT COALESCE(SUM(cur.used_days), 0) as total_used
         FROM conversion_usage_records cur
         LEFT JOIN vacation_conversions vc ON cur.conversion_id = vc.id
         WHERE vc.employee_id = ?`,
        [employee_id]
      );
      const total_used_days = parseFloat(usageResult[0].total_used);

      // 计算总计
      const total_converted_days = conversions.reduce((sum, c) => sum + parseFloat(c.converted_days || 0), 0);
      const remaining_days = total_converted_days - total_used_days;

      return {
        success: true,
        data: {
          total_converted_days: Math.floor(total_converted_days),
          remaining_days: Math.floor(remaining_days),
          used_days: Math.floor(total_used_days),
          conversions: conversions
        }
      };
    } catch (error) {
      console.error('查询转换余额失败:', error);
      return reply.code(500).send({ success: false, message: '查询失败' });
    }
  });

  // 使用转换假期（内部方法，由请假API调用）
  fastify.post('/api/vacation/use-conversion', async (request, reply) => {
    const { employee_id, leave_record_id, days_to_use } = request.body;

    if (!employee_id || !leave_record_id || !days_to_use) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let remaining_to_use = parseFloat(days_to_use);
      const usage_records = [];

      // 获取所有可用的转换记录（按创建时间排序，先进先出）
      const [conversions] = await connection.query(
        `SELECT id, remaining_days
        FROM vacation_conversions
        WHERE employee_id = ? AND remaining_days > 0
        ORDER BY created_at ASC
        FOR UPDATE`,
        [employee_id]
      );

      // 逐个扣减转换记录
      for (const conversion of conversions) {
        if (remaining_to_use <= 0) break;

        const available = parseFloat(conversion.remaining_days);
        const to_deduct = Math.min(available, remaining_to_use);

        // 更新转换记录的剩余天数
        await connection.query(
          `UPDATE vacation_conversions
          SET remaining_days = remaining_days - ?
          WHERE id = ?`,
          [to_deduct, conversion.id]
        );

        // 记录使用明细
        await connection.query(
          `INSERT INTO conversion_usage_records
          (conversion_id, leave_record_id, used_days)
          VALUES (?, ?, ?)`,
          [conversion.id, leave_record_id, to_deduct]
        );

        usage_records.push({
          conversion_id: conversion.id,
          used_days: to_deduct
        });

        remaining_to_use -= to_deduct;
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: '使用转换假期成功',
        data: {
          total_used: Math.floor(parseFloat(days_to_use) - remaining_to_use),
          usage_records: usage_records
        }
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('使用转换假期失败:', error);
      return reply.code(500).send({ success: false, message: '使用失败' });
    }
  });

  // 查询转换假期使用记录
  fastify.get('/api/vacation/conversion-usage/:leave_record_id', async (request, reply) => {
    const { leave_record_id } = request.params;

    try {
      const [records] = await pool.query(
        `SELECT
          cur.id,
          cur.conversion_id,
          cur.used_days,
          cur.created_at,
          vc.source_type,
          vc.source_hours,
          vc.conversion_ratio
        FROM conversion_usage_records cur
        LEFT JOIN vacation_conversions vc ON cur.conversion_id = vc.id
        WHERE cur.leave_record_id = ?
        ORDER BY cur.created_at ASC`,
        [leave_record_id]
      );

      const total_used = records.reduce((sum, r) => sum + parseFloat(r.used_days || 0), 0);

      return {
        success: true,
        data: {
          total_used: Math.floor(total_used),
          records: records
        }
      };
    } catch (error) {
      console.error('查询使用记录失败:', error);
      return reply.code(500).send({ success: false, message: '查询失败' });
    }
  });
};
