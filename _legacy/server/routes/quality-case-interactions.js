// 案例评论、附件和学习记录API（续）
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
  limits: { fileSize: 10 * 1024 * 1024 },
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

  // ==================== 案例评论管理 ====================

  // POST /api/quality/cases/:id/comments - 添加评论
  fastify.post('/api/quality/cases/:id/comments', async (request, reply) => {
    const { id } = request.params;
    const { content, parent_id } = request.body;
    const user_id = request.user?.id || 1;

    if (!content || content.trim().length === 0) {
      return reply.code(400).send({ success: false, message: '评论内容不能为空' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 插入评论
      const [result] = await connection.query(
        'INSERT INTO case_comments (case_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
        [id, user_id, parent_id || null, content]
      );

      // 更新案例评论数
      await connection.query(
        'UPDATE quality_cases SET comment_count = comment_count + 1 WHERE id = ?',
        [id]
      );

      await connection.commit();
      return { success: true, id: result.insertId, message: '评论成功' };
    } catch (error) {
      await connection.rollback();
      console.error('Error adding comment:', error);
      return reply.code(500).send({ success: false, message: '添加评论失败' });
    } finally {
      connection.release();
    }
  });

  // GET /api/quality/cases/:id/comments - 获取评论列表
  fastify.get('/api/quality/cases/:id/comments', async (request, reply) => {
    const { id } = request.params;
    const { page = 1, pageSize = 20 } = request.query;
    const offset = (page - 1) * pageSize;

    try {
      // 获取顶级评论
      const [comments] = await pool.query(
        `SELECT cc.*, u.real_name as user_name, u.avatar
         FROM case_comments cc
         LEFT JOIN users u ON cc.user_id = u.id
         WHERE cc.case_id = ? AND cc.parent_id IS NULL
         ORDER BY cc.created_at DESC
         LIMIT ? OFFSET ?`,
        [id, parseInt(pageSize), parseInt(offset)]
      );

      // 获取每个评论的回复
      for (let comment of comments) {
        const [replies] = await pool.query(
          `SELECT cc.*, u.real_name as user_name, u.avatar
           FROM case_comments cc
           LEFT JOIN users u ON cc.user_id = u.id
           WHERE cc.parent_id = ?
           ORDER BY cc.created_at ASC`,
          [comment.id]
        );
        comment.replies = replies;
      }

      // 获取总数
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM case_comments WHERE case_id = ? AND parent_id IS NULL',
        [id]
      );

      return {
        success: true,
        data: comments,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / pageSize)
        }
      };
    } catch (error) {
      console.error('Error fetching comments:', error);
      return reply.code(500).send({ success: false, message: '获取评论失败' });
    }
  });

  // PUT /api/quality/comments/:id - 修改评论
  fastify.put('/api/quality/comments/:id', async (request, reply) => {
    const { id } = request.params;
    const { content } = request.body;
    const user_id = request.user?.id || 1;

    if (!content || content.trim().length === 0) {
      return reply.code(400).send({ success: false, message: '评论内容不能为空' });
    }

    try {
      const [result] = await pool.query(
        'UPDATE case_comments SET content = ? WHERE id = ? AND user_id = ?',
        [content, id, user_id]
      );

      if (result.affectedRows === 0) {
        return reply.code(404).send({ success: false, message: '评论不存在或无权修改' });
      }

      return { success: true, message: '评论修改成功' };
    } catch (error) {
      console.error('Error updating comment:', error);
      return reply.code(500).send({ success: false, message: '修改评论失败' });
    }
  });

  // DELETE /api/quality/comments/:id - 删除评论
  fastify.delete('/api/quality/comments/:id', async (request, reply) => {
    const { id } = request.params;
    const user_id = request.user?.id || 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 获取评论信息
      const [comments] = await connection.query(
        'SELECT case_id FROM case_comments WHERE id = ? AND user_id = ?',
        [id, user_id]
      );

      if (comments.length === 0) {
        await connection.rollback();
        connection.release();
        return reply.code(404).send({ success: false, message: '评论不存在或无权删除' });
      }

      const caseId = comments[0].case_id;

      // 删除评论（级联删除回复）
      await connection.query('DELETE FROM case_comments WHERE id = ?', [id]);

      // 更新案例评论数
      await connection.query(
        'UPDATE quality_cases SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?',
        [caseId]
      );

      await connection.commit();
      return { success: true, message: '评论删除成功' };
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting comment:', error);
      return reply.code(500).send({ success: false, message: '删除评论失败' });
    } finally {
      connection.release();
    }
  });

  // POST /api/quality/comments/:id/like - 点赞评论
  fastify.post('/api/quality/comments/:id/like', async (request, reply) => {
    const { id } = request.params;
    const user_id = request.user?.id || 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否已点赞
      const [existing] = await connection.query(
        'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [id, user_id]
      );

      if (existing.length > 0) {
        // 取消点赞
        await connection.query(
          'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
          [id, user_id]
        );
        await connection.query(
          'UPDATE case_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?',
          [id]
        );
        await connection.commit();
        return { success: true, liked: false, message: '已取消点赞' };
      } else {
        // 添加点赞
        await connection.query(
          'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
          [id, user_id]
        );
        await connection.query(
          'UPDATE case_comments SET like_count = like_count + 1 WHERE id = ?',
          [id]
        );
        await connection.commit();
        return { success: true, liked: true, message: '点赞成功' };
      }
    } catch (error) {
      await connection.rollback();
      console.error('Error liking comment:', error);
      return reply.code(500).send({ success: false, message: '操作失败' });
    } finally {
      connection.release();
    }
  });

  // ==================== 案例附件管理 ====================

  // POST /api/quality/cases/:id/attachments - 上传附件
  fastify.post('/api/quality/cases/:id/attachments', {
    preHandler: upload.single('file')
  }, async (request, reply) => {
    const { id } = request.params;
    const file = request.file;

    if (!file) {
      return reply.code(400).send({ success: false, message: '请选择文件' });
    }

    try {
      // 确定文件类型
      let fileType = 'document';
      if (file.mimetype.startsWith('image/')) fileType = 'image';
      else if (file.mimetype.startsWith('audio/')) fileType = 'audio';
      else if (file.mimetype.startsWith('video/')) fileType = 'video';

      // 保存附件信息
      const fileUrl = `/uploads/quality-cases/${file.filename}`;
      const [result] = await pool.query(
        `INSERT INTO case_attachments
         (case_id, file_name, file_type, file_size, file_url)
         VALUES (?, ?, ?, ?, ?)`,
        [id, file.originalname, fileType, file.size, fileUrl]
      );

      return {
        success: true,
        id: result.insertId,
        file: {
          id: result.insertId,
          name: file.originalname,
          type: fileType,
          size: file.size,
          url: fileUrl
        },
        message: '文件上传成功'
      };
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return reply.code(500).send({ success: false, message: '文件上传失败' });
    }
  });

  // GET /api/quality/cases/:id/attachments - 获取附件列表
  fastify.get('/api/quality/cases/:id/attachments', async (request, reply) => {
    const { id } = request.params;

    try {
      const [attachments] = await pool.query(
        'SELECT * FROM case_attachments WHERE case_id = ? ORDER BY created_at',
        [id]
      );

      return { success: true, data: attachments };
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return reply.code(500).send({ success: false, message: '获取附件列表失败' });
    }
  });

  // DELETE /api/quality/attachments/:id - 删除附件
  fastify.delete('/api/quality/attachments/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      // 获取附件信息
      const [attachments] = await pool.query(
        'SELECT file_url FROM case_attachments WHERE id = ?',
        [id]
      );

      if (attachments.length === 0) {
        return reply.code(404).send({ success: false, message: '附件不存在' });
      }

      // 删除文件
      const filePath = path.join(__dirname, '../..', attachments[0].file_url);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
      }

      // 删除数据库记录
      await pool.query('DELETE FROM case_attachments WHERE id = ?', [id]);

      return { success: true, message: '附件删除成功' };
    } catch (error) {
      console.error('Error deleting attachment:', error);
      return reply.code(500).send({ success: false, message: '删除附件失败' });
    }
  });

  // GET /api/quality/attachments/:id/download - 下载附件
  fastify.get('/api/quality/attachments/:id/download', async (request, reply) => {
    const { id } = request.params;

    try {
      const [attachments] = await pool.query(
        'SELECT file_name, file_url FROM case_attachments WHERE id = ?',
        [id]
      );

      if (attachments.length === 0) {
        return reply.code(404).send({ success: false, message: '附件不存在' });
      }

      const filePath = path.join(__dirname, '../..', attachments[0].file_url);
      return reply.download(filePath, attachments[0].file_name);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      return reply.code(500).send({ success: false, message: '下载附件失败' });
    }
  });

  // ==================== 学习记录管理 ====================

  // POST /api/quality/cases/:id/learning - 更新学习记录
  fastify.post('/api/quality/cases/:id/learning', async (request, reply) => {
    const { id } = request.params;
    const { learning_duration, completed, last_position } = request.body;
    const user_id = request.user?.id || 1;

    try {
      await pool.query(
        `INSERT INTO case_learning_records
         (case_id, user_id, learning_duration, completed, last_position)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         learning_duration = learning_duration + VALUES(learning_duration),
         completed = VALUES(completed),
         last_position = VALUES(last_position),
         updated_at = CURRENT_TIMESTAMP`,
        [id, user_id, learning_duration || 0, completed || false, last_position || 0]
      );

      return { success: true, message: '学习记录更新成功' };
    } catch (error) {
      console.error('Error updating learning record:', error);
      return reply.code(500).send({ success: false, message: '更新学习记录失败' });
    }
  });

  // GET /api/quality/learning/progress - 获取学习进度
  fastify.get('/api/quality/learning/progress', async (request, reply) => {
    const { case_id } = request.query;
    const user_id = request.user?.id || 1;

    try {
      if (case_id) {
        // 获取特定案例的学习记录
        const [records] = await pool.query(
          `SELECT * FROM case_learning_records
           WHERE case_id = ? AND user_id = ?`,
          [case_id, user_id]
        );
        return { success: true, data: records[0] || null };
      } else {
        // 获取用户所有学习记录
        const [records] = await pool.query(
          `SELECT clr.*, qc.title as case_title
           FROM case_learning_records clr
           LEFT JOIN quality_cases qc ON clr.case_id = qc.id
           WHERE clr.user_id = ?
           ORDER BY clr.updated_at DESC`,
          [user_id]
        );
        return { success: true, data: records };
      }
    } catch (error) {
      console.error('Error fetching learning progress:', error);
      return reply.code(500).send({ success: false, message: '获取学习进度失败' });
    }
  });

  // ==================== 案例收藏管理 ====================

  // POST /api/quality/cases/:id/favorite - 添加收藏
  fastify.post('/api/quality/cases/:id/favorite', async (request, reply) => {
    const { id } = request.params;
    const { user_id } = request.body;
    const userId = user_id || request.user?.id || 1;

    try {
      await pool.query(
        'INSERT IGNORE INTO user_case_favorites (user_id, case_id) VALUES (?, ?)',
        [userId, id]
      );
      return { success: true, message: '收藏成功' };
    } catch (error) {
      console.error('Error adding favorite:', error);
      return reply.code(500).send({ success: false, message: '收藏失败' });
    }
  });

  // DELETE /api/quality/cases/:id/favorite - 取消收藏
  fastify.delete('/api/quality/cases/:id/favorite', async (request, reply) => {
    const { id } = request.params;
    const { user_id } = request.body || {};
    const userId = user_id || request.user?.id || 1;

    try {
      await pool.query(
        'DELETE FROM user_case_favorites WHERE user_id = ? AND case_id = ?',
        [userId, id]
      );
      return { success: true, message: '取消收藏成功' };
    } catch (error) {
      console.error('Error removing favorite:', error);
      return reply.code(500).send({ success: false, message: '取消收藏失败' });
    }
  });

  // GET /api/quality/users/:userId/favorites - 获取用户收藏的案例
  fastify.get('/api/quality/users/:userId/favorites', async (request, reply) => {
    const { userId } = request.params;
    const { page = 1, pageSize = 12 } = request.query;
    const offset = (page - 1) * pageSize;

    try {
      const [cases] = await pool.query(
        `SELECT qc.*, u.real_name as creator_name, ucf.created_at as favorited_at
         FROM user_case_favorites ucf
         INNER JOIN quality_cases qc ON ucf.case_id = qc.id
         LEFT JOIN users u ON qc.created_by = u.id
         WHERE ucf.user_id = ?
         ORDER BY ucf.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(pageSize), parseInt(offset)]
      );

      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM user_case_favorites WHERE user_id = ?',
        [userId]
      );

      return {
        success: true,
        data: cases,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / pageSize)
        }
      };
    } catch (error) {
      console.error('Error fetching favorites:', error);
      return reply.code(500).send({ success: false, message: '获取收藏列表失败' });
    }
  });
};
