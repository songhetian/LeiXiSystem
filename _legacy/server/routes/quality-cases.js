// 案例库管理API路由
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/quality-cases');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|mp3|mp4|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // ==================== 案例CRUD ====================

  // POST /api/quality/cases - 创建案例
  fastify.post('/api/quality/cases', async (request, reply) => {
    const {
      title, category, case_type, difficulty_level, priority,
      problem_description, solution, key_points,
      related_session_id, tag_ids, status
    } = request.body;

    const user_id = request.user?.id || 1; // 从认证中获取用户ID

    // Frontend sends problem_description, we'll map it to problem column
    if (!title || !category || !problem_description || !solution) {
      return reply.code(400).send({
        success: false,
        message: '标题、分类、问题描述和解决方案为必填项'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 插入案例
      const [result] = await connection.query(
        `INSERT INTO quality_cases
         (title, category, case_type, difficulty, priority,
          problem, solution, session_id,
          status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, category, case_type || 'excellent', difficulty_level || 'medium',
         priority || 'medium', problem_description, solution,
         related_session_id, status || 'draft', user_id]
      );

      const caseId = result.insertId;

      // 关联标签
      if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
        const tagValues = tag_ids.map(tagId => [caseId, tagId]);
        await connection.query(
          'INSERT INTO case_tags (case_id, tag_id) VALUES ?',
          [tagValues]
        );
      }

      await connection.commit();
      return { success: true, id: caseId, message: '案例创建成功' };
    } catch (error) {
      await connection.rollback();
      console.error('Error creating case:', error);
      return reply.code(500).send({ success: false, message: '创建案例失败' });
    } finally {
      connection.release();
    }
  });

  // GET /api/quality/cases - 获取案例列表（支持筛选）
  fastify.get('/api/quality/cases', async (request, reply) => {
    const {
      page = 1, pageSize = 12, search = '', category, case_type,
      difficulty, tag, sortBy = 'created_at', sortOrder = 'desc', status
    } = request.query;

    const offset = (page - 1) * pageSize;

    let query = `
      SELECT DISTINCT
        qc.*,
        u.real_name as creator_name,
        qs.session_no as session_code
      FROM quality_cases qc
      LEFT JOIN users u ON qc.created_by = u.id
      LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
    `;

    const params = [];
    const conditions = [];

    // Exclude soft-deleted cases
    conditions.push('qc.deleted_at IS NULL');

    // 标签筛选需要JOIN
    if (tag) {
      query += ` INNER JOIN case_tags ct ON qc.id = ct.case_id`;
      conditions.push('ct.tag_id = ?');
      params.push(tag);
    }

    query += ' WHERE 1=1';

    // 搜索
    if (search) {
      conditions.push('(qc.title LIKE ? OR qc.problem LIKE ? OR qc.solution LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // 分类筛选
    if (category) {
      conditions.push('qc.category = ?');
      params.push(category);
    }

    // 案例类型筛选
    if (case_type) {
      conditions.push('qc.case_type = ?');
      params.push(case_type);
    }

    // 难度筛选
    if (difficulty) {
      conditions.push('qc.difficulty = ?');
      params.push(difficulty);
    }

    // 状态筛选
    if (status) {
      conditions.push('qc.status = ?');
      params.push(status);
    }
    // 不再默认只显示已发布的案例，显示所有状态

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // 获取总数 - 构建一个简化的 count 查询
    let countQuery = `
      SELECT COUNT(DISTINCT qc.id) as total
      FROM quality_cases qc
      LEFT JOIN users u ON qc.created_by = u.id
      LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
    `;

    // 添加标签筛选的 JOIN（如果需要）
    if (tag) {
      countQuery += ` INNER JOIN case_tags ct ON qc.id = ct.case_id`;
    }

    countQuery += ' WHERE 1=1';

    if (conditions.length > 0) {
      countQuery += ' AND ' + conditions.join(' AND ');
    }

    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // 排序和分页
    const validSortFields = ['created_at', 'view_count', 'like_count', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query += ` ORDER BY qc.${sortField} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), parseInt(offset));

    try {
      const [rows] = await pool.query(query, params);

      // 获取每个案例的标签
      for (let row of rows) {
        const [tags] = await pool.query(
          `SELECT t.* FROM tags t
           INNER JOIN case_tags ct ON t.id = ct.tag_id
           WHERE ct.case_id = ?`,
          [row.id]
        );
        row.tags = tags;
      }

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Error fetching cases:', error);
      return reply.code(500).send({ success: false, message: '获取案例列表失败' });
    }
  });

  // GET /api/quality/cases/:id - 获取案例详情
  fastify.get('/api/quality/cases/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [rows] = await pool.query(
        `SELECT qc.*, u.real_name as creator_name, qs.session_code
         FROM quality_cases qc
         LEFT JOIN users u ON qc.created_by = u.id
         LEFT JOIN quality_sessions qs ON qc.session_id = qs.id
         WHERE qc.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '案例不存在' });
      }

      const caseData = rows[0];

      // 获取标签
      const [tags] = await pool.query(
        `SELECT t.* FROM tags t
         INNER JOIN case_tags ct ON t.id = ct.tag_id
         WHERE ct.case_id = ?`,
        [id]
      );
      caseData.tags = tags;

      // 获取附件
      const [attachments] = await pool.query(
        'SELECT * FROM case_attachments WHERE case_id = ? ORDER BY created_at',
        [id]
      );
      caseData.attachments = attachments;

      return { success: true, data: caseData };
    } catch (error) {
      console.error('Error fetching case details:', error);
      return reply.code(500).send({ success: false, message: '获取案例详情失败' });
    }
  });

  // PUT /api/quality/cases/:id - 更新案例
  fastify.put('/api/quality/cases/:id', async (request, reply) => {
    const { id } = request.params;
    const {
      title, category, case_type, difficulty_level, priority,
      problem_description, solution, key_points,
      related_session_id, tag_ids, status
    } = request.body;

    const user_id = request.user?.id || 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 更新案例
      const [result] = await connection.query(
        `UPDATE quality_cases SET
          title = ?, category = ?, case_type = ?, difficulty = ?,
          priority = ?, problem = ?, solution = ?,
          session_id = ?, status = ?, updated_by = ?
         WHERE id = ?`,
        [title, category, case_type, difficulty_level, priority,
         problem_description, solution, related_session_id,
         status, user_id, id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return reply.code(404).send({ success: false, message: '案例不存在' });
      }

      // 更新标签（先删除旧的，再添加新的）
      await connection.query('DELETE FROM case_tags WHERE case_id = ?', [id]);

      if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
        const tagValues = tag_ids.map(tagId => [id, tagId]);
        await connection.query(
          'INSERT INTO case_tags (case_id, tag_id) VALUES ?',
          [tagValues]
        );
      }

      await connection.commit();
      return { success: true, message: '案例更新成功' };
    } catch (error) {
      await connection.rollback();
      console.error('Error updating case:', error);
      return reply.code(500).send({ success: false, message: '更新案例失败' });
    } finally {
      connection.release();
    }
  });

  // DELETE /api/quality/cases/:id - 软删除案例
  fastify.delete('/api/quality/cases/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const [result] = await pool.query(
        'UPDATE quality_cases SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (result.affectedRows === 0) {
        return reply.code(404).send({ success: false, message: '案例不存在或已删除' });
      }

      return { success: true, message: '案例已移至回收站' };
    } catch (error) {
      console.error('Error soft deleting case:', error);
      return reply.code(500).send({ success: false, message: '删除案例失败' });
    }
  });

  // GET /api/quality/cases/recycle-bin - 获取回收站案例
  fastify.get('/api/quality/cases/recycle-bin', async (request, reply) => {
    const { page = 1, pageSize = 20, search = '', category = '' } = request.query;
    const offset = (page - 1) * pageSize;

    try {
      const params = [];
      const conditions = [];

      // Only show deleted cases
      conditions.push('qc.deleted_at IS NOT NULL');

      if (search) {
        conditions.push('(qc.title LIKE ? OR qc.problem LIKE ? OR qc.solution LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (category) {
        conditions.push('qc.category = ?');
        params.push(category);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM quality_cases qc WHERE ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // Get paginated data
      const [rows] = await pool.query(
        `SELECT qc.*, u.real_name as creator_name
         FROM quality_cases qc
         LEFT JOIN users u ON qc.created_by = u.id
         WHERE ${whereClause}
         ORDER BY qc.deleted_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize), parseInt(offset)]
      );

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Error fetching recycle bin:', error);
      return reply.code(500).send({ success: false, message: '获取回收站失败' });
    }
  });

  // POST /api/quality/cases/:id/restore - 恢复已删除案例
  fastify.post('/api/quality/cases/:id/restore', async (request, reply) => {
    const { id } = request.params;

    try {
      const [result] = await pool.query(
        'UPDATE quality_cases SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
        [id]
      );

      if (result.affectedRows === 0) {
        return reply.code(404).send({ success: false, message: '案例不存在或未删除' });
      }

      return { success: true, message: '案例已恢复' };
    } catch (error) {
      console.error('Error restoring case:', error);
      return reply.code(500).send({ success: false, message: '恢复案例失败' });
    }
  });

  // DELETE /api/quality/cases/recycle-bin/empty - 清空回收站
  fastify.delete('/api/quality/cases/recycle-bin/empty', async (request, reply) => {
    try {
      const [result] = await pool.query(
        'DELETE FROM quality_cases WHERE deleted_at IS NOT NULL'
      );

      if (result.affectedRows === 0) {
        return { success: true, message: '回收站已为空' };
      }

      return { success: true, message: `已清空回收站，共删除 ${result.affectedRows} 条记录` };
    } catch (error) {
      console.error('Error emptying recycle bin:', error);
      return reply.code(500).send({ success: false, message: '清空回收站失败' });
    }
  });

  // DELETE /api/quality/cases/:id/permanent - 永久删除案例
  fastify.delete('/api/quality/cases/:id/permanent', async (request, reply) => {
    const { id } = request.params;

    try {
      const [result] = await pool.query(
        'DELETE FROM quality_cases WHERE id = ? AND deleted_at IS NOT NULL',
        [id]
      );

      if (result.affectedRows === 0) {
        return reply.code(404).send({ success: false, message: '案例不存在或未在回收站中' });
      }

      return { success: true, message: '案例已永久删除' };
    } catch (error) {
      console.error('Error permanently deleting case:', error);
      return reply.code(500).send({ success: false, message: '永久删除案例失败' });
    }
  });

  // ==================== 案例交互 ====================

  // POST /api/quality/cases/:id/like - 点赞案例
  fastify.post('/api/quality/cases/:id/like', async (request, reply) => {
    const { id } = request.params;
    const user_id = request.user?.id || 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否已点赞
      const [existing] = await connection.query(
        'SELECT id FROM case_likes WHERE case_id = ? AND user_id = ?',
        [id, user_id]
      );

      if (existing.length > 0) {
        // 取消点赞
        await connection.query(
          'DELETE FROM case_likes WHERE case_id = ? AND user_id = ?',
          [id, user_id]
        );
        await connection.query(
          'UPDATE quality_cases SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?',
          [id]
        );
        await connection.commit();
        return { success: true, liked: false, message: '已取消点赞' };
      } else {
        // 添加点赞
        await connection.query(
          'INSERT INTO case_likes (case_id, user_id) VALUES (?, ?)',
          [id, user_id]
        );
        await connection.query(
          'UPDATE quality_cases SET like_count = like_count + 1 WHERE id = ?',
          [id]
        );
        await connection.commit();
        return { success: true, liked: true, message: '点赞成功' };
      }
    } catch (error) {
      await connection.rollback();
      console.error('Error liking case:', error);
      return reply.code(500).send({ success: false, message: '操作失败' });
    } finally {
      connection.release();
    }
  });

  // POST /api/quality/cases/:id/view - 记录浏览
  fastify.post('/api/quality/cases/:id/view', async (request, reply) => {
    const { id } = request.params;

    try {
      await pool.query(
        'UPDATE quality_cases SET view_count = view_count + 1 WHERE id = ?',
        [id]
      );
      return { success: true, message: '浏览记录成功' };
    } catch (error) {
      console.error('Error recording view:', error);
      return reply.code(500).send({ success: false, message: '记录浏览失败' });
    }
  });

  // POST /api/quality/cases/:id/collect - 收藏案例
  fastify.post('/api/quality/cases/:id/collect', async (request, reply) => {
    const { id } = request.params;
    const user_id = request.user?.id || 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否已收藏
      const [existing] = await connection.query(
        'SELECT id FROM case_collections WHERE case_id = ? AND user_id = ?',
        [id, user_id]
      );

      if (existing.length > 0) {
        await connection.rollback();
        connection.release();
        return reply.code(400).send({ success: false, message: '已经收藏过此案例' });
      }

      // 添加收藏
      await connection.query(
        'INSERT INTO case_collections (case_id, user_id) VALUES (?, ?)',
        [id, user_id]
      );
      await connection.query(
        'UPDATE quality_cases SET collect_count = collect_count + 1 WHERE id = ?',
        [id]
      );

      await connection.commit();
      return { success: true, message: '收藏成功' };
    } catch (error) {
      await connection.rollback();
      console.error('Error collecting case:', error);
      return reply.code(500).send({ success: false, message: '收藏失败' });
    } finally {
      connection.release();
    }
  });

  // DELETE /api/quality/cases/:id/collect - 取消收藏
  fastify.delete('/api/quality/cases/:id/collect', async (request, reply) => {
    const { id } = request.params;
    const user_id = request.user?.id || 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'DELETE FROM case_collections WHERE case_id = ? AND user_id = ?',
        [id, user_id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return reply.code(404).send({ success: false, message: '未收藏此案例' });
      }

      await connection.query(
        'UPDATE quality_cases SET collect_count = GREATEST(collect_count - 1, 0) WHERE id = ?',
        [id]
      );

      await connection.commit();
      return { success: true, message: '取消收藏成功' };
    } catch (error) {
      await connection.rollback();
      console.error('Error uncollecting case:', error);
      return reply.code(500).send({ success: false, message: '取消收藏失败' });
    } finally {
      connection.release();
    }
  });

  // GET /api/quality/cases/check-session/:sessionId - 检查会话是否已在案例库
  fastify.get('/api/quality/cases/check-session/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;

    try {
      const [rows] = await pool.query(
        'SELECT id, title FROM quality_cases WHERE session_id = ? LIMIT 1',
        [sessionId]
      );

      if (rows.length > 0) {
        return {
          success: true,
          exists: true,
          case: rows[0]
        };
      } else {
        return {
          success: true,
          exists: false
        };
      }
    } catch (error) {
      console.error('Error checking session in cases:', error);
      return reply.code(500).send({ success: false, message: '检查失败' });
    }
  });

  // ==================== 案例推荐 ====================

  // GET /api/quality/cases/hot - 获取热门案例
  fastify.get('/api/quality/cases/hot', async (request, reply) => {
    const { limit = 10 } = request.query;

    try {
      const [rows] = await pool.query(
        `SELECT qc.*, u.real_name as creator_name
         FROM quality_cases qc
         LEFT JOIN users u ON qc.created_by = u.id
         WHERE qc.status = 'published'
         ORDER BY (qc.view_count * 0.3 + qc.like_count * 0.5 + qc.collect_count * 0.2) DESC
         LIMIT ?`,
        [parseInt(limit)]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.error('Error fetching hot cases:', error);
      return reply.code(500).send({ success: false, message: '获取热门案例失败' });
    }
  });

  // GET /api/quality/cases/latest - 获取最新案例
  fastify.get('/api/quality/cases/latest', async (request, reply) => {
    const { limit = 10 } = request.query;

    try {
      const [rows] = await pool.query(
        `SELECT qc.*, u.real_name as creator_name
         FROM quality_cases qc
         LEFT JOIN users u ON qc.created_by = u.id
         WHERE qc.status = 'published'
         ORDER BY qc.created_at DESC
         LIMIT ?`,
        [parseInt(limit)]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.error('Error fetching latest cases:', error);
      return reply.code(500).send({ success: false, message: '获取最新案例失败' });
    }
  });

  // GET /api/quality/cases/recommended - 获取推荐案例（基于用户）
  fastify.get('/api/quality/cases/recommended', async (request, reply) => {
    const { page = 1, pageSize = 12 } = request.query;
    const user_id = request.user?.id || 1;
    const offset = (page - 1) * pageSize;

    try {
      // 简单推荐算法：基于用户收藏的案例标签
      const query = `
        SELECT DISTINCT qc.*, u.real_name as creator_name
        FROM quality_cases qc
        LEFT JOIN users u ON qc.created_by = u.id
        INNER JOIN case_tags ct ON qc.id = ct.case_id
        WHERE qc.status = 'published'
          AND ct.tag_id IN (
            SELECT DISTINCT ct2.tag_id
            FROM case_collections cc
            INNER JOIN case_tags ct2 ON cc.case_id = ct2.case_id
            WHERE cc.user_id = ?
          )
          AND qc.id NOT IN (
            SELECT case_id FROM case_collections WHERE user_id = ?
          )
        ORDER BY qc.created_at DESC
      `;

      // 获取总数
      const countQuery = `SELECT COUNT(DISTINCT qc.id) as total FROM (${query}) as temp`;
      const [countResult] = await pool.query(countQuery, [user_id, user_id]);
      const total = countResult[0].total;

      // 获取分页数据
      const paginatedQuery = query + ` LIMIT ? OFFSET ?`;
      const [rows] = await pool.query(paginatedQuery, [user_id, user_id, parseInt(pageSize), parseInt(offset)]);

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Error fetching recommended cases:', error);
      return reply.code(500).send({ success: false, message: '获取推荐案例失败' });
    }
  });

  // 继续在下一个文件...
};
