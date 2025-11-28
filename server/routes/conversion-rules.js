const { getBeijingNow } = require('../utils/time');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // 获取转换规则列表
  fastify.get('/api/conversion-rules', async (request, reply) => {
    const { source_type, target_type, enabled } = request.query;
    try {
      let query = 'SELECT * FROM conversion_rules WHERE 1=1';
      const params = [];

      if (source_type) {
        query += ' AND source_type = ?';
        params.push(source_type);
      }
      if (target_type) {
        query += ' AND target_type = ?';
        params.push(target_type);
      }
      if (enabled !== undefined) {
        query += ' AND enabled = ?';
        params.push(enabled === 'true' ? 1 : 0);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(query, params);
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ 获取转换规则失败:', error);
      // 如果表不存在，返回空数组而不是报错
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return { success: true, data: [] };
      }
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 获取单个规则
  fastify.get('/api/conversion-rules/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const [rows] = await pool.query('SELECT * FROM conversion_rules WHERE id = ?', [id]);
      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '规则不存在' });
      }
      return { success: true, data: rows[0] };
    } catch (error) {
      console.error('❌ 获取转换规则详情失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 创建转换规则
  fastify.post('/api/conversion-rules', async (request, reply) => {
    const { source_type, target_type, ratio, enabled } = request.body;

    if (!source_type || !target_type || !ratio) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' });
    }

    try {
      // 检查表是否存在，不存在则创建
      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversion_rules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          source_type VARCHAR(50) NOT NULL,
          target_type VARCHAR(50) NOT NULL,
          conversion_rate DECIMAL(10, 2) NOT NULL,
          enabled TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const [result] = await pool.query(
        'INSERT INTO conversion_rules (source_type, target_type, conversion_rate, enabled) VALUES (?, ?, ?, ?)',
        [source_type, target_type, ratio, enabled !== undefined ? enabled : 1]
      );

      return {
        success: true,
        message: '创建成功',
        data: { 
          id: result.insertId, 
          source_type,
          target_type,
          conversion_rate: ratio,
          enabled
        }
      };
    } catch (error) {
      console.error('❌ 创建转换规则失败:', error);
      return reply.code(500).send({ success: false, message: '创建失败' });
    }
  });

  // 更新转换规则
  fastify.put('/api/conversion-rules/:id', async (request, reply) => {
    const { id } = request.params;
    const { source_type, target_type, ratio, enabled } = request.body;

    try {
      const updates = [];
      const params = [];

      if (source_type !== undefined) { updates.push('source_type = ?'); params.push(source_type); }
      if (target_type !== undefined) { updates.push('target_type = ?'); params.push(target_type); }
      if (ratio !== undefined) { updates.push('conversion_rate = ?'); params.push(ratio); }
      if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled); }

      if (updates.length === 0) {
        return reply.code(400).send({ success: false, message: '没有要更新的字段' });
      }

      params.push(id);
      await pool.query(
        `UPDATE conversion_rules SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      return { success: true, message: '更新成功' };
    } catch (error) {
      console.error('❌ 更新转换规则失败:', error);
      return reply.code(500).send({ success: false, message: '更新失败' });
    }
  });

  // 删除转换规则
  fastify.delete('/api/conversion-rules/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      await pool.query('DELETE FROM conversion_rules WHERE id = ?', [id]);
      return { success: true, message: '删除成功' };
    } catch (error) {
      console.error('❌ 删除转换规则失败:', error);
      return reply.code(500).send({ success: false, message: '删除失败' });
    }
  });

  // 计算转换结果(不实际执行转换)
  fastify.get('/api/conversion-rules/calculate', async (request, reply) => {
    const { source_hours, rule_id, target_type_code } = request.query;

    if (!source_hours) {
      return reply.code(400).send({ success: false, message: '缺少source_hours参数' });
    }

    try {
      let conversionRatio = 8.0;
      let ruleName = '默认规则';

      if (rule_id) {
        // 使用指定规则
        const [rules] = await pool.query(
          'SELECT * FROM conversion_rules WHERE id = ? AND enabled = TRUE',
          [rule_id]
        );
        if (rules.length > 0) {
          conversionRatio = parseFloat(rules[0].conversion_rate);
          ruleName = `规则-${rules[0].id}`;
        }
      } else if (target_type_code) {
        // 根据目标类型查找规则
        const [rules] = await pool.query(
          `SELECT * FROM conversion_rules
           WHERE source_type = 'overtime' AND target_type = ? AND enabled = TRUE
           LIMIT 1`,
          [target_type_code]
        );
        if (rules.length > 0) {
          conversionRatio = parseFloat(rules[0].conversion_rate);
          ruleName = `规则-${rules[0].id}`;
        }
      }

      // 计算转换天数 (加班小时 * 比例 / 8小时)
      const convertedDays = (parseFloat(source_hours) * conversionRatio) / 8;

      return {
        success: true,
        data: {
          source_hours: parseFloat(source_hours),
          conversion_ratio: conversionRatio,
          converted_days: parseFloat(convertedDays.toFixed(2)),
          rule_name: ruleName
        }
      };
    } catch (error) {
      console.error('❌ 计算转换结果失败:', error);
      return reply.code(500).send({ success: false, message: '计算失败' });
    }
  });
};
