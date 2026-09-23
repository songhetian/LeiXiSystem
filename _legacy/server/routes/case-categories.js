// 案例分类管理API路由
module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // GET /api/quality/case-categories - 获取所有分类（支持树形结构）
  fastify.get('/api/quality/case-categories', async (request, reply) => {
    const { includeInactive = false } = request.query;

    try {
      let query = 'SELECT * FROM case_categories';
      const params = [];

      if (!includeInactive) {
        query += ' WHERE is_active = ?';
        params.push(true);
      }

      query += ' ORDER BY sort_order ASC, id ASC';

      const [rows] = await pool.query(query, params);

      // 构建树形结构
      const buildTree = (items, parentId = null) => {
        return items
          .filter(item => item.parent_id === parentId)
          .map(item => ({
            ...item,
            children: buildTree(items, item.id)
          }));
      };

      const tree = buildTree(rows);

      return {
        success: true,
        data: tree,
        flatData: rows // 同时返回扁平数据，方便前端使用
      };
    } catch (error) {
      console.error('Error fetching case categories:', error);
      return reply.code(500).send({ success: false, message: '获取分类列表失败' });
    }
  });

  // GET /api/quality/case-categories/:id - 获取单个分类
  fastify.get('/api/quality/case-categories/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [rows] = await pool.query(
        'SELECT * FROM case_categories WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '分类不存在' });
      }

      return { success: true, data: rows[0] };
    } catch (error) {
      console.error('Error fetching case category:', error);
      return reply.code(500).send({ success: false, message: '获取分类详情失败' });
    }
  });

  // POST /api/quality/case-categories - 创建分类
  fastify.post('/api/quality/case-categories', async (request, reply) => {
    const { name, description, parent_id, sort_order = 0 } = request.body;

    if (!name) {
      return reply.code(400).send({ success: false, message: '分类名称为必填项' });
    }

    try {
      // 检查名称是否已存在
      const [existing] = await pool.query(
        'SELECT id FROM case_categories WHERE name = ?',
        [name]
      );

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '分类名称已存在' });
      }

      const [result] = await pool.query(
        `INSERT INTO case_categories (name, description, parent_id, sort_order)
         VALUES (?, ?, ?, ?)`,
        [name, description, parent_id, sort_order]
      );

      return {
        success: true,
        id: result.insertId,
        message: '分类创建成功'
      };
    } catch (error) {
      console.error('Error creating case category:', error);
      return reply.code(500).send({ success: false, message: '创建分类失败' });
    }
  });

  // PUT /api/quality/case-categories/:id - 更新分类
  fastify.put('/api/quality/case-categories/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, parent_id, sort_order, is_active } = request.body;

    try {
      // 检查分类是否存在
      const [existing] = await pool.query(
        'SELECT id FROM case_categories WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '分类不存在' });
      }

      // 检查名称是否与其他分类重复
      if (name) {
        const [duplicate] = await pool.query(
          'SELECT id FROM case_categories WHERE name = ? AND id != ?',
          [name, id]
        );

        if (duplicate.length > 0) {
          return reply.code(400).send({ success: false, message: '分类名称已存在' });
        }
      }

      // 构建更新语句
      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (parent_id !== undefined) {
        updates.push('parent_id = ?');
        params.push(parent_id);
      }
      if (sort_order !== undefined) {
        updates.push('sort_order = ?');
        params.push(sort_order);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ success: false, message: '没有需要更新的字段' });
      }

      params.push(id);

      await pool.query(
        `UPDATE case_categories SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      return { success: true, message: '分类更新成功' };
    } catch (error) {
      console.error('Error updating case category:', error);
      return reply.code(500).send({ success: false, message: '更新分类失败' });
    }
  });

  // DELETE /api/quality/case-categories/:id - 删除分类
  fastify.delete('/api/quality/case-categories/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      // 检查是否有子分类
      const [children] = await pool.query(
        'SELECT id FROM case_categories WHERE parent_id = ?',
        [id]
      );

      if (children.length > 0) {
        return reply.code(400).send({
          success: false,
          message: '该分类下存在子分类，无法删除'
        });
      }

      // 检查是否有案例使用此分类
      const [cases] = await pool.query(
        'SELECT id FROM quality_cases WHERE category = (SELECT name FROM case_categories WHERE id = ?)',
        [id]
      );

      if (cases.length > 0) {
        return reply.code(400).send({
          success: false,
          message: '该分类下存在案例，无法删除'
        });
      }

      const [result] = await pool.query(
        'DELETE FROM case_categories WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return reply.code(404).send({ success: false, message: '分类不存在' });
      }

      return { success: true, message: '分类删除成功' };
    } catch (error) {
      console.error('Error deleting case category:', error);
      return reply.code(500).send({ success: false, message: '删除分类失败' });
    }
  });
};
