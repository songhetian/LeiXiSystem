const jwt = require('jsonwebtoken')
const { recordLog } = require('./logger')
const dayjs = require('dayjs')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// ============================================================
// 核心工具：自动化聊天群组同步 (数据库 + Redis 双写闭环 + WebSocket 实时通知)
// ============================================================
async function syncUserChatGroups(pool, userId, departmentId, isActive, redis = null, io = null) {
  try {
    if (isActive) {
      // 1. 恢复在职/入职：加入部门群组
      const [groups] = await pool.query('SELECT id FROM chat_groups WHERE department_id = ?', [departmentId]);
      if (groups.length > 0) {
        const groupId = groups[0].id;
        // DB 同步
        await pool.query('INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, "member")', [groupId, userId]);
        
        // Redis 同步
        if (redis) {
          await redis.sadd(`chat:group:${groupId}:members`, userId);
          await redis.expire(`chat:group:${groupId}:members`, 86400 * 7);
        }

        // WebSocket 实时通知
        if (io) {
          io.to(`group_${groupId}`).emit('member_update', { groupId, action: 'join', userId });
        }
      }
    } else {
      // 2. 离职/停用/删除：从所有群组移除
      const [userGroups] = await pool.query('SELECT group_id FROM chat_group_members WHERE user_id = ?', [userId]);
      
      // DB 同步
      await pool.query('DELETE FROM chat_group_members WHERE user_id = ?', [userId]);
      
      // Redis 同步 & WebSocket 广播
      if (userGroups.length > 0) {
        for (const g of userGroups) {
          if (redis) await redis.srem(`chat:group:${g.group_id}:members`, userId);
          if (io) io.to(`group_${g.group_id}`).emit('member_update', { groupId: g.group_id, action: 'leave', userId });
        }
      }
    }
  } catch (err) { console.error('Chat Sync Failed:', err); }
}

// ============================================================
// 辅助工具：从请求提取操作人并记录日志
// ============================================================
async function logAdminAction(request, pool, module, action, targetUserId = null) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const [opRows] = await pool.query('SELECT username, real_name FROM users WHERE id = ?', [decoded.id]);
    const operator = opRows[0] || { username: 'unknown', real_name: '未知' };

    await recordLog(pool, {
      user_id: decoded.id,
      username: operator.username,
      real_name: operator.real_name,
      module,
      action: `${action}${targetUserId ? ` (目标用户ID: ${targetUserId})` : ''}`,
      method: request.method,
      url: request.url,
      ip: request.ip,
      status: 1
    });
  } catch (err) { console.error('Logging Failed:', err); }
}

/**
 * 缓存用户信息名片到 Redis (Hash 结构)
 */
async function cacheUserProfile(pool, redis, userId) {
  if (!redis) return;
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.real_name as name, u.avatar, d.name as dept 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.id = ?
    `, [userId]);
    
    if (rows.length > 0) {
      const user = rows[0];
      const cacheKey = `user:profile:${userId}`;
      await redis.set(cacheKey, JSON.stringify({
        id: user.id,
        name: user.name,
        avatar: user.avatar || '',
        dept: user.dept || ''
      }), 'EX', 86400 * 7); // 7天过期
    }
  } catch (err) { console.error('Cache User Profile Failed:', err); }
}

module.exports = { syncUserChatGroups, logAdminAction, cacheUserProfile };
