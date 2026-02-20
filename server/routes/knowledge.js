const { recordLog } = require('../utils/logger');

async function knowledgeRoutes(fastify, options) {
  const pool = fastify.mysql;
  const redis = fastify.redis;

  // 获取知识库分类列表
  fastify.get('/api/knowledge/categories', async (request, reply) => {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM knowledge_categories
        WHERE is_deleted = 0 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to fetch knowledge categories' });
    }
  });

  // 创建知识库分类
  fastify.post('/api/knowledge/categories', async (request, reply) => {
    const { name, description, icon, owner_id, type, is_public } = request.body;
    try {
      if (!name) {
        return reply.code(400).send({ error: 'Category name is required' });
      }

      const [result] = await pool.query(
        'INSERT INTO knowledge_categories (name, description, icon, owner_id, type, is_public) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || null, icon || '📁', owner_id || null, type || 'common', is_public !== undefined ? is_public : 1]
      );

      return { success: true, id: result.insertId };
    } catch (error) {
      console.error('Failed to create knowledge category:', error);
      reply.code(500).send({ error: 'Failed to create knowledge category: ' + error.message });
    }
  })

  // 更新知识库分类
  fastify.put('/api/knowledge/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, icon, is_hidden, is_published, is_public } = request.body;
    try {
      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description || null);
      }
      if (icon !== undefined) {
        updates.push('icon = ?');
        values.push(icon || '📁');
      }
      if (is_hidden !== undefined) {
        updates.push('is_hidden = ?');
        values.push(is_hidden ? 1 : 0);
      }
      if (is_published !== undefined) {
        updates.push('is_published = ?');
        values.push(is_published ? 1 : 0);
      }
      if (is_public !== undefined) {
        updates.push('is_public = ?');
        values.push(is_public ? 1 : 0);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No updates provided' });
      }

      values.push(id);
      await pool.query(
        `UPDATE knowledge_categories SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return { success: true };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to update knowledge category' });
    }
  });

  // 删除知识库分类
  fastify.delete('/api/knowledge/categories/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      await pool.query(
        'UPDATE knowledge_articles SET category_id = NULL WHERE category_id = ?',
        [id]
      );

      await pool.query('DELETE FROM knowledge_categories WHERE id = ?', [id]);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete knowledge category:', error);
      reply.code(500).send({ error: 'Failed to delete knowledge category' });
    }
  });

  // 切换分类显示隐藏状态
  fastify.post('/api/knowledge/categories/:id/toggle-visibility', async (request, reply) => {
    const { id } = request.params;
    const { is_hidden } = request.body;

    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        await connection.query(
          'UPDATE knowledge_categories SET is_hidden = ? WHERE id = ?',
          [is_hidden ? 1 : 0, id]
        );

        const newArticleStatus = is_hidden ? 'archived' : 'published';
        const [result] = await connection.query(
          'UPDATE knowledge_articles SET status = ? WHERE category_id = ?',
          [newArticleStatus, id]
        );

        await connection.commit();
        connection.release();

        return {
          success: true,
          affectedArticles: result.affectedRows,
          message: is_hidden
            ? `已隐藏分类，${result.affectedRows} 篇文档已归档`
            : `已显示分类，${result.affectedRows} 篇文档已发布`
        };
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error('切换分类可见性失败', error);
      reply.code(500).send({ error: 'Failed to toggle category visibility: ' + error.message });
    }
  });

  // 创建知识文章
  fastify.post('/api/knowledge/articles', async (request, reply) => {
    if (!pool) {
      return reply.code(500).send({
        error: 'Database connection failed',
        message: '请检查数据库配置并确保数据库服务正在运行'
      });
    }

    const { title, category_id, summary, content, type, status, icon, attachments, is_public, owner_id } = request.body;
    try {
      const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;

      const [result] = await pool.query(
        `INSERT INTO knowledge_articles
        (title, category_id, summary, content, attachments, type, status, icon, is_public, owner_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, category_id || null, summary || null, content || '', attachmentsJson, type || 'common', status || 'published', icon || '📄', is_public !== undefined ? is_public : 1, owner_id || null, request.user?.id || null]
      );
      return { success: true, id: result.insertId };
    } catch (error) {
      console.error('创建知识文章失败:', error);
      reply.code(500).send({
        error: 'Failed to create knowledge article',
        message: error.message
      });
    }
  });

  // 获取知识文章列表
  fastify.get('/api/knowledge/articles', async (request, reply) => {
    try {
      const { type, category_id, owner_id, is_public, status = 'published' } = request.query;

      let query = `
        SELECT * FROM knowledge_articles
        WHERE is_deleted = 0 AND deleted_at IS NULL
      `;
      const params = [];

      if (type && type !== 'all') {
        query += ' AND type = ?';
        params.push(type);
      }

      if (category_id) {
        query += ' AND category_id = ?';
        params.push(category_id);
      }

      if (owner_id) {
        query += ' AND owner_id = ?';
        params.push(owner_id);
      }

      if (is_public !== undefined) {
        query += ' AND is_public = ?';
        params.push(is_public === 'true' || is_public === '1' ? 1 : 0);
      }

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      
      const [rows] = await pool.query(query + ' ORDER BY created_at DESC', params);
      return rows;
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to fetch knowledge articles' });
    }
  });

  // ==================== 我的知识库 (My Knowledge) 专项接口 ====================

  // 获取个人分类
  fastify.get('/api/my-knowledge/categories', async (request, reply) => {
    const { userId } = request.query;
    try {
      const [rows] = await pool.query(
        'SELECT * FROM knowledge_categories WHERE owner_id = ? AND is_deleted = 0 AND deleted_at IS NULL ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (e) { return reply.code(500).send({ error: e.message }); }
  });

  // 获取个人文档
  fastify.get('/api/my-knowledge/articles', async (request, reply) => {
    const { userId, category_id } = request.query;
    try {
      let query = 'SELECT * FROM knowledge_articles WHERE owner_id = ? AND is_deleted = 0 AND deleted_at IS NULL';
      const params = [userId];
      if (category_id) { query += ' AND category_id = ?'; params.push(category_id); }
      const [rows] = await pool.query(query + ' ORDER BY created_at DESC', params);
      return rows;
    } catch (e) { return reply.code(500).send({ error: e.message }); }
  });

  // 更新分类可见性
  fastify.put('/api/my-knowledge/categories/:id/visibility', async (request, reply) => {
    const { id } = request.params;
    const { is_hidden } = request.body;
    try {
      await pool.query('UPDATE knowledge_categories SET is_hidden = ? WHERE id = ?', [is_hidden, id]);
      return { success: true };
    } catch (e) { return reply.code(500).send({ error: e.message }); }
  });

  // ==================== 回收站 (Recycle Bin) 专项接口 ====================

  fastify.get('/api/knowledge/recycle-bin/categories', async (request, reply) => {
    const { userId } = request.query;
    const [rows] = await pool.query('SELECT * FROM knowledge_categories WHERE owner_id = ? AND (is_deleted = 1 OR deleted_at IS NOT NULL)', [userId]);
    return rows;
  });

  fastify.get('/api/knowledge/recycle-bin/articles', async (request, reply) => {
    const { userId } = request.query;
    const [rows] = await pool.query('SELECT * FROM knowledge_articles WHERE owner_id = ? AND (status = "deleted" OR is_deleted = 1)', [userId]);
    return rows;
  });

  fastify.post('/api/knowledge/recycle-bin/:type/:id/restore', async (request, reply) => {
    const { type, id } = request.params;
    const table = type === 'category' ? 'knowledge_categories' : 'knowledge_articles';
    const statusField = type === 'article' ? ', status = "published"' : '';
    await pool.query(`UPDATE ${table} SET is_deleted = 0, deleted_at = NULL${statusField} WHERE id = ?`, [id]);
    return { success: true };
  });

  fastify.delete('/api/knowledge/recycle-bin/:type/:id/permanent', async (request, reply) => {
    const { type, id } = request.params;
    const table = type === 'category' ? 'knowledge_categories' : 'knowledge_articles';
    
    try {
      // --- 关键优化：永久删除前先清理物理文件 ---
      if (type === 'article') {
        const [article] = await pool.query('SELECT attachments FROM knowledge_articles WHERE id = ?', [id]);
        if (article[0]?.attachments) {
          const fs = require('fs');
          const path = require('path');
          const files = JSON.parse(article[0].attachments || '[]');
          files.forEach(f => {
            const filePath = path.join(fastify.uploadDir, path.basename(f.url || f.path || ''));
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ 已物理删除附件: ${filePath}`);
            }
          });
        }
      }

      await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return { success: true, message: '已彻底从系统和磁盘中移除' };
    } catch (e) {
      return reply.code(500).send({ success: false, message: e.message });
    }
  });

  // --- 性能优化：阅读量自增接口 (Redis 优先模式) ---
  fastify.post('/api/knowledge/articles/:id/view', async (request, reply) => {
    const { id } = request.params;
    if (redis) {
      // 使用 Redis 记录阅读量，避免频繁写库
      await redis.hincrby('stats:article:views', id, 1);
      return { success: true };
    } else {
      await pool.query('UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = ?', [id]);
      return { success: true };
    }
  });
}

module.exports = knowledgeRoutes;