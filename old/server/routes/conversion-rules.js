const { getBeijingNow } = require('../utils/time');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // 获取转换规则列表
  fastify.get('/api/conversion-rules', async (request, reply) => {
    const { enabled } = request.query;
    try {
      let query = 'SELECT * FROM conversion_rules WHERE 1=1';
      const params = [];

      if (enabled !== undefined) {
        query += ' AND enabled = ?';
        params.push(enabled === 'true' ? 1 : 0);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(query, params);
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ 获取转换规则失败:', error);
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
    const { name, ratio, enabled, description } = request.body;

    if (!ratio) {
      return reply.code(400).send({ success: false, message: '缺少转换比例参数' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 如果要启用新规则，先禁用其他规则
      const isEnabled = enabled !== undefined ? enabled : 1;
      if (isEnabled) {
        await connection.query('UPDATE conversion_rules SET enabled = 0');
      }

      const [result] = await connection.query(
        'INSERT INTO conversion_rules (name, ratio, conversion_rate, enabled, description) VALUES (?, ?, ?, ?, ?)',
        [name || '转换规则', ratio, ratio, isEnabled, description || null]
      );

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: '创建成功',
        data: {
          id: result.insertId,
          name,
          ratio,
          enabled: isEnabled
        }
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('❌ 创建转换规则失败:', error);
      return reply.code(500).send({ success: false, message: '创建失败' });
    }
  });

  // 更新转换规则
  fastify.put('/api/conversion-rules/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, ratio, enabled, description } = request.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 如果要启用此规则，先禁用其他规则
      if (enabled === true || enabled === 1) {
        await connection.query('UPDATE conversion_rules SET enabled = 0 WHERE id != ?', [id]);
      }

      const updates = [];
      const params = [];

      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (ratio !== undefined) {
        updates.push('ratio = ?');
        params.push(ratio);
        updates.push('conversion_rate = ?');
        params.push(ratio);
      }
      if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }

      if (updates.length === 0) {
        await connection.rollback();
        connection.release();
        return reply.code(400).send({ success: false, message: '没有要更新的字段' });
      }

      params.push(id);
      await connection.query(
        `UPDATE conversion_rules SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      await connection.commit();
      connection.release();

      return { success: true, message: '更新成功' };
    } catch (error) {
      await connection.rollback();
      connection.release();
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
};
