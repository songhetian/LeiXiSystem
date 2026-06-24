// 节假日配置 API
const { getBeijingNow } = require('../utils/time');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // 获取假期类型列表
  fastify.get('/api/vacation/types', async (request, reply) => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM vacation_types WHERE enabled = TRUE ORDER BY code'
      );
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ 获取假期类型失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 获取节假日列表
  fastify.get('/api/holidays', async (request, reply) => {
    const { year } = request.query;
    const currentYear = year || new Date(getBeijingNow()).getFullYear();

    try {
      const [rows] = await pool.query(
        `SELECT h.*, vt.name as vacation_type_name, vt.code as vacation_type_code
         FROM holidays h
         LEFT JOIN vacation_types vt ON h.vacation_type_id = vt.id
         WHERE h.year = ?
         ORDER BY h.month, h.created_at`,
        [currentYear]
      );
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ 获取节假日列表失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 获取月度汇总
  fastify.get('/api/holidays/monthly-summary', async (request, reply) => {
    const { year } = request.query;
    const currentYear = year || new Date(getBeijingNow()).getFullYear();

    try {
      const [rows] = await pool.query(
        `SELECT month, SUM(days) as total_days, COUNT(*) as holiday_count
         FROM holidays
         WHERE year = ?
         GROUP BY month
         ORDER BY month`,
        [currentYear]
      );

      // 填充所有月份（即使没有数据）
      const summary = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        total_days: 0,
        holiday_count: 0
      }));

      rows.forEach(row => {
        summary[row.month - 1] = {
          month: row.month,
          total_days: parseInt(row.total_days),
          holiday_count: parseInt(row.holiday_count)
        };
      });

      return { success: true, data: summary };
    } catch (error) {
      console.error('❌ 获取月度汇总失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 创建节假日
  fastify.post('/api/holidays', async (request, reply) => {
    const { name, days, month, year, vacation_type_id } = request.body;

    // 验证必填字段
    if (!name || !days || !month || !year) {
      return reply.code(400).send({ success: false, message: '请填写完整信息' });
    }

    // 验证数据范围
    if (name.length > 20) {
      return reply.code(400).send({ success: false, message: '假期名称不能超过20个字符' });
    }

    if (days < 1 || days > 31) {
      return reply.code(400).send({ success: false, message: '天数必须在1-31之间' });
    }

    if (month < 1 || month > 12) {
      return reply.code(400).send({ success: false, message: '月份必须在1-12之间' });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO holidays (name, days, month, year, vacation_type_id) VALUES (?, ?, ?, ?, ?)',
        [name, days, month, year, vacation_type_id || null]
      );

      return {
        success: true,
        message: '创建成功',
        data: { id: result.insertId, name, days, month, year, vacation_type_id }
      };
    } catch (error) {
      console.error('❌ 创建节假日失败:', error);
      return reply.code(500).send({ success: false, message: '创建失败' });
    }
  });

  // 更新节假日
  fastify.put('/api/holidays/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, days, month, vacation_type_id } = request.body;

    // 验证数据
    if (name && name.length > 20) {
      return reply.code(400).send({ success: false, message: '假期名称不能超过20个字符' });
    }

    if (days && (days < 1 || days > 31)) {
      return reply.code(400).send({ success: false, message: '天数必须在1-31之间' });
    }

    if (month && (month < 1 || month > 12)) {
      return reply.code(400).send({ success: false, message: '月份必须在1-12之间' });
    }

    try {
      // 检查是否存在
      const [existing] = await pool.query('SELECT id FROM holidays WHERE id = ?', [id]);
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '节假日不存在' });
      }

      // 构建更新语句
      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (days !== undefined) {
        updates.push('days = ?');
        params.push(days);
      }
      if (month !== undefined) {
        updates.push('month = ?');
        params.push(month);
      }
      if (vacation_type_id !== undefined) {
        updates.push('vacation_type_id = ?');
        params.push(vacation_type_id || null);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ success: false, message: '没有要更新的字段' });
      }

      params.push(id);
      await pool.query(
        `UPDATE holidays SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      return { success: true, message: '更新成功' };
    } catch (error) {
      console.error('❌ 更新节假日失败:', error);
      return reply.code(500).send({ success: false, message: '更新失败' });
    }
  });

  // 删除节假日
  fastify.delete('/api/holidays/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [result] = await pool.query('DELETE FROM holidays WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return reply.code(404).send({ success: false, message: '节假日不存在' });
      }

      return { success: true, message: '删除成功' };
    } catch (error) {
      console.error('❌ 删除节假日失败:', error);
      return reply.code(500).send({ success: false, message: '删除失败' });
    }
  });
};
