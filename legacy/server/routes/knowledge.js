const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { recordLog } = require('../utils/logger');

async function knowledgeRoutes(fastify, options) {
  const pool = fastify.mysql;
  const redis = fastify.redis;

  async function authenticateRequest(request) {
    const token = request.headers.authorization?.replace('Bearer ', '').trim();
    if (!token || token === 'null' || token === 'undefined' || token.split('.').length !== 3) {
      return null;
    }
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

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

    const { title, category_id, summary, content, type, status, icon, attachments, is_public, owner_id, original_article_id } = request.body;
    try {
      let attachmentsJson = null;
      if (typeof attachments === 'string') {
        attachmentsJson = attachments.trim() ? attachments : null;
      } else if (Array.isArray(attachments)) {
        attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : null;
      } else if (attachments && typeof attachments === 'object') {
        attachmentsJson = JSON.stringify(attachments);
      }

      const [result] = await pool.query(
        `INSERT INTO knowledge_articles
        (title, category_id, summary, content, attachments, original_article_id, type, status, icon, is_public, owner_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, category_id || null, summary || null, content || '', attachmentsJson, original_article_id || null, type || 'common', status || 'published', icon || '📄', is_public !== undefined ? is_public : 1, owner_id || null, request.user?.id || null]
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
      const { type, category_id, owner_id, is_public, status = 'published', search, page = 1, pageSize = 20 } = request.query;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      let query = `
        SELECT * FROM knowledge_articles
        WHERE is_deleted = 0 AND deleted_at IS NULL
      `;
      let countQuery = `
        SELECT COUNT(*) as total FROM knowledge_articles
        WHERE is_deleted = 0 AND deleted_at IS NULL
      `;
      const params = [];

      if (search) {
        const searchClause = ' AND (title LIKE ? OR summary LIKE ?)';
        query += searchClause;
        countQuery += searchClause;
        params.push(`%${search}%`, `%${search}%`);
      }

      if (type && type !== 'all') {
        const typeClause = ' AND type = ?';
        query += typeClause;
        countQuery += typeClause;
        params.push(type);
      }

      if (category_id) {
        const catClause = ' AND category_id = ?';
        query += catClause;
        countQuery += catClause;
        params.push(category_id);
      }

      if (owner_id) {
        const ownerClause = ' AND owner_id = ?';
        query += ownerClause;
        countQuery += ownerClause;
        params.push(owner_id);
      }

      if (is_public !== undefined) {
        const publicClause = ' AND is_public = ?';
        query += publicClause;
        countQuery += publicClause;
        params.push(is_public === 'true' || is_public === '1' ? 1 : 0);
      }

      if (status && status !== 'all') {
        const statusClause = ' AND status = ?';
        query += statusClause;
        countQuery += statusClause;
        params.push(status);
      }
      
      const [countRows] = await pool.query(countQuery, params);
      const total = countRows[0].total;

      const [rows] = await pool.query(query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?', [...params, limit, offset]);
      
      return {
        data: rows,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to fetch knowledge articles' });
    }
  });

  // 获取单篇知识文章
  fastify.get('/api/knowledge/articles/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const [rows] = await pool.query('SELECT * FROM knowledge_articles WHERE id = ? AND is_deleted = 0', [id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Article not found' });
      return rows[0];
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // 删除知识文章 (核心补全：支持取消收藏与删除)
  fastify.delete('/api/knowledge/articles/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      // 1. 先检查文章类型
      const [rows] = await pool.query('SELECT type, owner_id FROM knowledge_articles WHERE id = ?', [id]);
      if (rows.length === 0) return reply.code(404).send({ error: '文档不存在' });

      const article = rows[0];

      // 2. 如果是个人库(收藏)内容，直接物理删除
      if (article.type === 'personal') {
        await pool.query('DELETE FROM knowledge_articles WHERE id = ?', [id]);
        return { success: true, message: '已成功取消收藏' };
      }

      // 3. 如果是公共库内容，执行逻辑删除
      await pool.query('UPDATE knowledge_articles SET is_deleted = 1, deleted_at = NOW() WHERE id = ?', [id]);
      return { success: true, message: '文档已移至回收站' };
    } catch (error) {
      console.error('Delete article failed:', error);
      return reply.code(500).send({ error: '操作失败', message: error.message });
    }
  });

  // 更新知识文章
  fastify.put('/api/knowledge/articles/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const {
        title,
        content,
        summary,
        category_id,
        is_public,
        status,
        attachments,
        notes
      } = updates;

      const [currentRows] = await pool.query(
        'SELECT id, category_id, type, owner_id FROM knowledge_articles WHERE id = ? AND is_deleted = 0 AND deleted_at IS NULL',
        [id]
      );

      if (currentRows.length === 0) {
        return reply.code(404).send({ error: 'Article not found' });
      }

      const currentArticle = currentRows[0];
      const nextCategoryId = Object.prototype.hasOwnProperty.call(updates, 'category_id')
        ? (category_id || null)
        : currentArticle.category_id;

      const updateFields = [];
      const values = [];

      if (title !== undefined) {
        updateFields.push('title = ?');
        values.push(title);
      }
      if (content !== undefined) {
        updateFields.push('content = ?');
        values.push(content);
      }
      if (summary !== undefined) {
        updateFields.push('summary = ?');
        values.push(summary);
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'category_id')) {
        updateFields.push('category_id = ?');
        values.push(category_id || null);
      }
      if (is_public !== undefined) {
        updateFields.push('is_public = ?');
        values.push(Number(is_public) === 1 ? 1 : 0);
      }
      if (status !== undefined) {
        updateFields.push('status = ?');
        values.push(status);
      }
      if (attachments !== undefined) {
        updateFields.push('attachments = ?');
        values.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments || []));
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        values.push(notes);
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: 'No updates provided' });
      }

      updateFields.push('updated_at = NOW()');
      values.push(id);

      await pool.query(
        `UPDATE knowledge_articles SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );

      if (
        currentArticle.type === 'common' &&
        is_public !== undefined &&
        Number(is_public) === 1 &&
        nextCategoryId
      ) {
        await pool.query(
          `UPDATE knowledge_categories
           SET is_public = 1
           WHERE id = ? AND type = 'common' AND is_deleted = 0 AND deleted_at IS NULL`,
          [nextCategoryId]
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Update article failed:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // ==================== 我的知识库 (My Knowledge) 专项接口 ====================

  // 获取个人分类
  fastify.get('/api/my-knowledge/categories', async (request, reply) => {
    const authUser = await authenticateRequest(request);
    const userId = request.query?.userId || authUser?.id;
    console.log('--- [Backend Knowledge] Category Request ---');
    console.log('Received userId from query/auth:', userId);
    try {
      if (!userId) {
        return reply.code(400).send({ error: 'userId is required' });
      }
      
      const targetUserId = Number(userId);
      console.log('Querying for owner_id (converted):', targetUserId);

      // 🔴 物理锁死：仅返回该用户下的个人类型(personal)且未删除的分类
      const [rows] = await pool.query(
        "SELECT * FROM knowledge_categories WHERE owner_id = ? AND type = 'personal' AND is_deleted = 0 AND deleted_at IS NULL ORDER BY name ASC",
        [targetUserId]
      );
      
      console.log('Query result count:', rows.length);
      return rows;
    } catch (e) { 
      console.error('Fetch categories failed:', e);
      return reply.code(500).send({ error: e.message }); 
    }
  });

  // 创建个人分类
  fastify.post('/api/my-knowledge/categories', async (request, reply) => {
    const { name, description, icon, owner_id } = request.body;
    try {
      if (!name) {
        return reply.code(400).send({ error: 'Category name is required' });
      }

      const [result] = await pool.query(
        `INSERT INTO knowledge_categories (name, description, icon, owner_id, type, is_public)
         VALUES (?, ?, ?, ?, 'personal', 0)`,
        [name, description || null, icon || '📁', owner_id || null]
      );

      return { success: true, id: result.insertId };
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // 更新个人分类
  fastify.put('/api/my-knowledge/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, icon } = request.body;
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

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No updates provided' });
      }

      values.push(id);
      await pool.query(
        `UPDATE knowledge_categories SET ${updates.join(', ')} WHERE id = ? AND type = 'personal'`,
        values
      );

      return { success: true };
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // 删除个人分类
  fastify.delete('/api/my-knowledge/categories/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      await pool.query(
        "UPDATE knowledge_articles SET category_id = NULL WHERE category_id = ? AND type = 'personal'",
        [id]
      );
      await pool.query(
        "DELETE FROM knowledge_categories WHERE id = ? AND type = 'personal'",
        [id]
      );
      return { success: true };
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // 获取个人文档
  fastify.get('/api/my-knowledge/articles', async (request, reply) => {
    const authUser = await authenticateRequest(request);
    const userId = request.query?.userId || authUser?.id;
    const { category_id } = request.query;
    try {
      if (!userId) {
        return reply.code(400).send({ error: 'userId is required' });
      }
      // 🔴 关键修复：强制过滤 type = 'personal'，确保个人库只显示收藏或私有内容
      let query = "SELECT * FROM knowledge_articles WHERE owner_id = ? AND type = 'personal' AND is_deleted = 0 AND deleted_at IS NULL";
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
