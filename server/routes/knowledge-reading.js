const jwt = require('jsonwebtoken');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;
  const redis = fastify.redis;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  const getUserFromRequest = async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return null;
      }
      const decoded = fastify.jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch {
      return null;
    }
  };

  const genSessionId = () => {
    try {
      return require('crypto').randomUUID();
    } catch {
      return 'sess_' + Math.random().toString(36).slice(2) + Date.now();
    }
  };

  // Start reading session
  fastify.post('/api/knowledge/articles/:id/reading/start', async (request, reply) => {
    const user = await getUserFromRequest(request, reply);
    if (!user) {
      return reply.code(401).send({ success: false, message: '未登录' });
    }
    const { id: articleId } = request.params;
    const sessionId = genSessionId();
    const now = Date.now();

    const cacheKey = `kb_session:${sessionId}`;
    const payload = {
      session_id: sessionId,
      article_id: Number(articleId),
      user_id: user.id,
      department_id: user.department_id || null,
      started_at_ms: now,
      heartbeats_count: 0,
      active_seconds: 0,
      wheel_events: 0,
      mousemove_events: 0,
      keydown_events: 0,
      scroll_depth_percent: 0
    };

    try {
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', 60 * 30);
      return { success: true, session_id: sessionId };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, message: '创建阅读会话失败' });
    }
  });

  // Heartbeat to accumulate active seconds and events
  fastify.put('/api/knowledge/articles/:id/reading/heartbeat', async (request, reply) => {
    const user = await getUserFromRequest(request, reply);
    if (!user) {
      return reply.code(401).send({ success: false, message: '未登录' });
    }
    const { id: articleId } = request.params;
    const { session_id, active_delta = 0, wheel = 0, mousemove = 0, keydown = 0, scroll_depth_percent = 0 } = request.body || {};
    if (!session_id) {
      return reply.code(400).send({ success: false, message: '缺少 session_id' });
    }
    const cacheKey = `kb_session:${session_id}`;
    try {
      const raw = await redis.get(cacheKey);
      if (!raw) {
        return reply.code(404).send({ success: false, message: '会话不存在或已过期' });
      }
      const data = JSON.parse(raw);
      if (Number(data.article_id) !== Number(articleId) || Number(data.user_id) !== Number(user.id)) {
        return reply.code(403).send({ success: false, message: '会话不匹配' });
      }
      data.heartbeats_count += 1;
      data.active_seconds += Math.max(0, Math.min(60, Number(active_delta) || 0));
      data.wheel_events += Number(wheel) || 0;
      data.mousemove_events += Number(mousemove) || 0;
      data.keydown_events += Number(keydown) || 0;
      data.scroll_depth_percent = Math.max(Number(data.scroll_depth_percent) || 0, Math.min(100, Number(scroll_depth_percent) || 0));
      await redis.set(cacheKey, JSON.stringify(data), 'EX', 60 * 30);
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, message: '心跳更新失败' });
    }
  });

  // End reading session and persist
  fastify.put('/api/knowledge/articles/:id/reading/end', async (request, reply) => {
    const user = await getUserFromRequest(request, reply);
    if (!user) {
      return reply.code(401).send({ success: false, message: '未登录' });
    }
    const { id: articleId } = request.params;
    const { session_id, close_type = 'user_close' } = request.body || {};
    if (!session_id) {
      return reply.code(400).send({ success: false, message: '缺少 session_id' });
    }
    const cacheKey = `kb_session:${session_id}`;
    try {
      const raw = await redis.get(cacheKey);
      if (!raw) {
        return reply.code(404).send({ success: false, message: '会话不存在或已过期' });
      }
      await redis.del(cacheKey);
      const data = JSON.parse(raw);
      if (Number(data.article_id) !== Number(articleId) || Number(data.user_id) !== Number(user.id)) {
        return reply.code(403).send({ success: false, message: '会话不匹配' });
      }
      const nowMs = Date.now();
      const durationSeconds = Math.max(0, Math.round((nowMs - Number(data.started_at_ms)) / 1000));
      const activeSeconds = Math.min(durationSeconds, Number(data.active_seconds) || 0);
      const scrollDepthPercent = Math.min(100, Number(data.scroll_depth_percent) || 0);

      const minValid = durationSeconds >= 5;
      const activeRatioOk = durationSeconds > 0 ? (activeSeconds / durationSeconds) >= 0.6 : false;
      const fullRead = minValid && activeRatioOk && scrollDepthPercent >= 80 ? 1 : 0;

      // Persist session
      await pool.query(
        `INSERT INTO knowledge_article_read_sessions (
          session_id, user_id, department_id, article_id, started_at, ended_at, duration_seconds, active_seconds, scroll_depth_percent, full_read, close_type, heartbeats_count, wheel_events, mousemove_events, keydown_events
        ) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?/1000), FROM_UNIXTIME(?/1000), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session_id,
          user.id,
          data.department_id || null,
          articleId,
          Number(data.started_at_ms),
          nowMs,
          durationSeconds,
          activeSeconds,
          scrollDepthPercent,
          fullRead,
          close_type,
          Number(data.heartbeats_count) || 0,
          Number(data.wheel_events) || 0,
          Number(data.mousemove_events) || 0,
          Number(data.keydown_events) || 0
        ]
      );

      // Update daily stats
      const [res] = await pool.query(
        `INSERT INTO knowledge_article_daily_stats (article_id, stat_date, views_count, full_reads_count, total_duration_seconds, total_active_seconds)
         VALUES (?, CURDATE(), 1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           views_count = views_count + 1,
           full_reads_count = full_reads_count + VALUES(full_reads_count),
           total_duration_seconds = total_duration_seconds + VALUES(total_duration_seconds),
           total_active_seconds = total_active_seconds + VALUES(total_active_seconds)`,
        [articleId, fullRead, durationSeconds, activeSeconds]
      );

      return { success: true, duration_seconds: durationSeconds, active_seconds: activeSeconds, scroll_depth_percent: scrollDepthPercent, full_read: !!fullRead };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, message: '结束会话失败' });
    }
  });
};