const jwt = require('jsonwebtoken')
const { broadcastNotification } = require('../websocket')
const { recordLog } = require('../utils/logger')

const JWT_SECRET = process.env.JWT_SECRET || 'TZafsqtgW5t5EHRLJ49ca46rzoEfk37Lmx2hwxQR5m9KoQDYUmM5KhRyPKtxRccQ'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // Helper: Get user from token
  const getUserFromToken = (request) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) throw new Error('Unauthorized')
    return jwt.verify(token, JWT_SECRET)
  }

  // 1. Get Contacts (Groups Only - Enhanced with visibility and mute)
  fastify.get('/api/chat/contacts', async (request, reply) => {
    try {
      const user = getUserFromToken(request)
      const currentUserId = user.id
      const { extractUserPermissions } = require('../middleware/checkPermission')
      const permissions = await extractUserPermissions(request, pool)

      console.log(`[Chat Contacts] User: ${user.real_name}, Role: ${user.role}, canViewAll: ${permissions?.canViewAllDepartments}`);

      // Base query
      let query = `
        SELECT DISTINCT g.id, g.name, g.owner_id, 'group' as type, g.avatar, g.department_id,
               gm.is_muted,
               (SELECT COUNT(*) FROM chat_messages m WHERE m.group_id = g.id AND m.id > IFNULL(gm.last_read_message_id, 0)) as unread_count
        FROM chat_groups g
        LEFT JOIN chat_group_members gm ON g.id = gm.group_id AND gm.user_id = ?
        WHERE (1=0 
      `
      const params = [currentUserId]

      // Super Admin bypass: Show all department groups, but only show custom groups if they are a member
      if (user.role === '超级管理员' || user.role === 'admin' || (permissions && permissions.canViewAllDepartments)) {
          console.log('[Chat Contacts] Admin Detected - showing all dept groups + personal memberships');
          // 管理员可见：1. 自己在里面的群（含私密群） 2. 所有的部门群组
          query += ` OR gm.user_id IS NOT NULL OR g.department_id IS NOT NULL`
      } else {
          // Normal User filters
          query += ` OR gm.user_id IS NOT NULL`
          
          if (permissions) {
              const depts = new Set(permissions.viewableDepartmentIds || []);
              if (permissions.departmentId) depts.add(permissions.departmentId);
              
              if (depts.size > 0) {
                  const deptArray = Array.from(depts);
                  query += ` OR g.department_id IN (${deptArray.map(() => '?').join(',')})`
                  params.push(...deptArray);
              }
          }
      }
      
      query += ')'; // Close the WHERE clause

      const [groups] = await pool.query(query, params)

      const redis = fastify.redis;
      // Enrich groups with last message
      const enrichedGroups = await Promise.all(groups.map(async (g) => {
          let lastMsg = null;
          if (redis) {
              const cached = await redis.get(`chat:group:${g.id}:last_msg`);
              if (cached) lastMsg = JSON.parse(cached);
          }
          
          if (!lastMsg) {
              const [dbMsg] = await pool.query(
                  'SELECT content, created_at as time, msg_type FROM chat_messages WHERE group_id = ? ORDER BY id DESC LIMIT 1',
                  [g.id]
              );
              if (dbMsg.length > 0) {
                  lastMsg = {
                      content: dbMsg[0].msg_type === 'text' ? dbMsg[0].content : (dbMsg[0].msg_type === 'image' ? '[图片]' : '[文件]'),
                      time: dbMsg[0].time
                  };
              }
          }
          
          return {
              ...g,
              is_muted: !!g.is_muted,
              last_message: lastMsg?.content || '暂无消息',
              last_message_time: lastMsg?.time || null
          };
      }));

      return { success: true, data: enrichedGroups }
    } catch (err) {
      console.error(err)
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // 2. Create Group (Based on permissions)
  fastify.post('/api/chat/groups', async (request, reply) => {
    try {
      const user = getUserFromToken(request)
      const { extractUserPermissions } = require('../middleware/checkPermission')
      const permissions = await extractUserPermissions(request, pool)

      // 使用统一的权限代码校验
      const canManage = user.role === '超级管理员' || user.role === 'admin' || 
                        (permissions && permissions.permissions.includes('messaging:chat:manage'));

      if (!canManage) {
          return reply.code(403).send({ success: false, message: '您没有创建群组的权限' })
      }

      const { name, memberIds, avatar } = request.body

      if (!name || !memberIds || memberIds.length === 0) {
        return reply.code(400).send({ success: false, message: 'Invalid group data' })
      }

      // Create Group
      const [result] = await pool.query(
        'INSERT INTO chat_groups (name, owner_id, avatar, type) VALUES (?, ?, ?, ?)',
        [name, user.id, avatar || null, 'group']
      )
      const groupId = result.insertId

      // Add Members
      const membersToAdd = [...new Set([...memberIds, user.id])]
      const values = membersToAdd.map(uid => [groupId, uid, uid === user.id ? 'admin' : 'member'])
      
      await pool.query(
        'INSERT INTO chat_group_members (group_id, user_id, role) VALUES ?',
        [values]
      )

      // --- 同步到 Redis ---
      if (fastify.redis) {
          await fastify.redis.sadd(`chat:group:${groupId}:members`, ...membersToAdd);
          await fastify.redis.expire(`chat:group:${groupId}:members`, 86400 * 7);
      }

      await recordLog(pool, {
        user_id: user.id,
        username: user.username,
        real_name: user.real_name,
        module: 'messaging',
        action: `创建自定义群组: ${name}`,
        method: 'POST',
        url: request.url,
        ip: request.ip,
        status: 1
      });

      return { success: true, data: { id: groupId, name } }
    } catch (err) {
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // 3. Get Members (Optimized with Roles & Profile Caching)
  fastify.get('/api/chat/groups/:id/members', async (request, reply) => {
    try {
      const { id } = request.params
      const redis = fastify.redis
      const cacheKey = `chat:group:${id}:members`
      const roleKey = `chat:group:${id}:roles`
      
      let memberIds = []
      if (redis) memberIds = await redis.smembers(cacheKey)

      // 如果 Redis 没数据，从 DB 加载全量信息并同步
      if (!memberIds || memberIds.length === 0) {
        const [rows] = await pool.query('SELECT user_id, role FROM chat_group_members WHERE group_id = ?', [id]);
        if (rows.length === 0) return { success: true, data: [] };
        
        memberIds = rows.map(r => String(r.user_id));
        if (redis) {
          await redis.sadd(cacheKey, ...memberIds);
          // 存储角色映射
          const roleMap = {};
          rows.forEach(r => roleMap[r.user_id] = r.role);
          await redis.hset(roleKey, roleMap);
          await redis.expire(cacheKey, 86400 * 7);
          await redis.expire(roleKey, 86400 * 7);
        }
      }

      // 批量获取名片和角色
      const members = [];
      const missingIds = [];
      
      if (redis) {
        const pipeline = redis.pipeline();
        memberIds.forEach(uid => pipeline.hgetall(`user:profile:${uid}`));
        const profileResults = await pipeline.exec();
        const roleMap = await redis.hgetall(roleKey);
        
        profileResults.forEach((res, index) => {
          const [err, user] = res;
          const uid = memberIds[index];
          if (!err && user && user.id) {
            members.push({ ...user, role: roleMap[uid] || 'member' });
          } else {
            missingIds.push(uid);
          }
        });
      } else {
        missingIds.push(...memberIds);
      }

      // 补全缺失缓存
      if (missingIds.length > 0) {
        const [dbUsers] = await pool.query(`
          SELECT u.id, u.real_name as name, u.avatar, d.name as department_name, gm.role
          FROM chat_group_members gm
          JOIN users u ON gm.user_id = u.id
          LEFT JOIN departments d ON u.department_id = d.id 
          WHERE gm.group_id = ? AND u.id IN (?)
        `, [id, missingIds]);

        const { cacheUserProfile } = require('../utils/personnelClosure');
        for (const u of dbUsers) {
          members.push(u);
          if (redis) {
            await cacheUserProfile(pool, redis, u.id);
            await redis.hset(roleKey, u.id, u.role);
          }
        }
      }

      return { success: true, data: members }
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // 4. Get History (Optimized with Recent Cache)
  fastify.get('/api/chat/history', async (request, reply) => {
    try {
      const user = getUserFromToken(request)
      const { targetId, targetType, limit = 30, beforeId } = request.query
      
      if (targetType !== 'group') {
         return reply.code(400).send({ success: false, message: 'Only group chat is supported.' })
      }

      // 1. 优先尝试从 Redis 获取最近历史 (仅当没有 beforeId 分页时)
      const redis = fastify.redis;
      if (redis && !beforeId) {
          const historyKey = `chat:group:${targetId}:recent_messages`;
          const cachedMsgs = await redis.lrange(historyKey, 0, parseInt(limit) - 1);
          
          if (cachedMsgs && cachedMsgs.length > 0) {
              console.log(`[Chat History] Cache Hit for group ${targetId}`);
              // Redis 存的是字符串，需要解析并反转顺序 (因为是 lpush 进去的)
              const msgs = cachedMsgs.map(m => JSON.parse(m)).reverse();
              return { success: true, data: msgs, from: 'cache' };
          }
      }

      // 2. 权限校验 (Cache Miss 后才执行，节省开销)
      const { extractUserPermissions } = require('../middleware/checkPermission')
      const permissions = await extractUserPermissions(request, pool)

      // Check access: member OR visible department group OR super admin
      const [membership] = await pool.query(
          'SELECT 1 FROM chat_group_members WHERE group_id = ? AND user_id = ?',
          [targetId, user.id]
      )

      if (membership.length === 0) {
          const [groupInfo] = await pool.query('SELECT department_id FROM chat_groups WHERE id = ?', [targetId]);
          const deptId = groupInfo[0]?.department_id;
          
          let hasAccess = false;
          if (permissions?.canViewAllDepartments) {
              hasAccess = true;
          } else if (deptId && permissions) {
              const viewableDepts = permissions.viewableDepartmentIds || [];
              if (deptId === permissions.departmentId || viewableDepts.includes(deptId)) {
                  hasAccess = true;
              }
          }

          if (!hasAccess) {
              return reply.code(403).send({success: false, message: 'Not in group and no department permission'})
          }
      }

      let query = `
          SELECT m.*, u.real_name as sender_name, u.avatar as sender_avatar
          FROM chat_messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.group_id = ?
        `
      let params = [targetId]

      if (beforeId) {
        query += ' AND m.id < ?'
        params.push(beforeId)
      }

      query += ' ORDER BY m.id DESC LIMIT ?'
      params.push(parseInt(limit))

      const [messages] = await pool.query(query, params)

      return { success: true, data: messages.reverse() }
    } catch (err) {
      console.error(err)
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // 5. Mute Toggle
  fastify.post('/api/chat/mute', async (request, reply) => {
      try {
          const user = getUserFromToken(request)
          const { groupId, isMuted } = request.body
          await pool.query(
              'UPDATE chat_group_members SET is_muted = ? WHERE group_id = ? AND user_id = ?',
              [isMuted ? 1 : 0, groupId, user.id]
          )
          return { success: true }
      } catch (err) {
          return reply.code(500).send({ success: false })
      }
  })

  // 6. Get All Users (for group creation)
  fastify.get('/api/chat/users', async (request, reply) => {
      try {
          const [users] = await pool.query('SELECT id, real_name as name, avatar FROM users WHERE status = "active"')
          return { success: true, data: users }
      } catch (err) {
          return reply.code(500).send({ success: false })
      }
  })

  // 7. Mark Messages as Read
  fastify.post('/api/chat/read', async (request, reply) => {
    try {
      const user = getUserFromToken(request);
      const { groupId, messageId } = request.body;

      if (!groupId) return reply.code(400).send({ success: false, message: 'Missing groupId' });

      // 如果提供了 messageId，则更新到该位置；否则尝试获取最新一条消息 ID
      let finalId = messageId;
      if (!finalId) {
        const [lastMsg] = await pool.query(
          'SELECT id FROM chat_messages WHERE group_id = ? ORDER BY id DESC LIMIT 1',
          [groupId]
        );
        finalId = lastMsg[0]?.id || 0;
      }

      await pool.query(
        'UPDATE chat_group_members SET last_read_message_id = ? WHERE group_id = ? AND user_id = ?',
        [finalId, groupId, user.id]
      );

      // 如果有 Socket.io，可以选发一个未读数更新事件
      if (fastify.io) {
        fastify.io.to(`user_${user.id}`).emit('unread_count_update', { groupId, lastReadId: finalId });
      }

      return { success: true };
    } catch (err) {
      console.error('[Chat Read] Error:', err);
      return reply.code(500).send({ success: false });
    }
  });

  // 8. Update Group (Admin/Owner only)
  fastify.put('/api/chat/groups/:id', async (request, reply) => {
    try {
      const user = getUserFromToken(request);
      const { id } = request.params;
      const { name, avatar } = request.body;
      
      // 检查权限：管理员或群主
      const [group] = await pool.query('SELECT owner_id FROM chat_groups WHERE id = ?', [id]);
      if (group.length === 0) return reply.code(404).send({ success: false, message: '群组不存在' });
      
      if (user.role !== '超级管理员' && user.role !== 'admin' && group[0].owner_id !== user.id) {
        return reply.code(403).send({ success: false, message: '无权修改此群组' });
      }

      await pool.query('UPDATE chat_groups SET name = ?, avatar = ? WHERE id = ?', [name, avatar || null, id]);
      return { success: true, message: '更新成功' };
    } catch (err) { return reply.code(500).send({ success: false }); }
  });

  // 9. Delete/Disband Group (With Physical File Cleanup)
  fastify.delete('/api/chat/groups/:id', async (request, reply) => {
    try {
      const user = getUserFromToken(request);
      const { id } = request.params;
      
      const [group] = await pool.query('SELECT owner_id, department_id FROM chat_groups WHERE id = ?', [id]);
      if (group.length === 0) return reply.code(404).send({ success: false, message: '群组不存在' });
      
      // 部门群不允许随意删除
      if (group[0].department_id) {
        return reply.code(400).send({ success: false, message: '部门群组不可直接删除，请通过部门管理操作' });
      }

      // --- 物理文件清理逻辑 ---
      try {
        const [files] = await pool.query('SELECT file_url FROM chat_messages WHERE group_id = ? AND msg_type IN ("image", "file")', [id]);
        if (files.length > 0) {
          const fs = require('fs');
          const path = require('path');
          files.forEach(f => {
            if (f.file_url && f.file_url.startsWith('/uploads/')) {
              const filename = f.file_url.replace('/uploads/', '');
              const fullPath = path.join(fastify.uploadDir, filename);
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.log(`🗑️ 已物理删除群组文件: ${filename}`);
              }
            }
          });
        }
      } catch (fileErr) { console.error('File cleanup failed:', fileErr); }

      await pool.query('DELETE FROM chat_groups WHERE id = ?', [id]);
      await pool.query('DELETE FROM chat_group_members WHERE group_id = ?', [id]);
      await pool.query('DELETE FROM chat_messages WHERE group_id = ?', [id]);
      
      // 清理 Redis
      if (fastify.redis) {
        await fastify.redis.del(`chat:group:${id}:members`);
        await fastify.redis.del(`chat:group:${id}:last_msg`);
        await fastify.redis.del(`chat:group:${id}:recent_messages`); // 清理历史缓存
      }

      return { success: true, message: '群组已解散且附件已清理' };
    } catch (err) { return reply.code(500).send({ success: false }); }
  });

  // 10. Manual Member Management (Add/Kick)
  fastify.post('/api/chat/groups/:id/members/manage', async (request, reply) => {
    try {
      const user = getUserFromToken(request);
      const { id } = request.params;
      const { action, userIds } = request.body; // action: 'add' | 'kick'
      
      if (action === 'add') {
        const values = userIds.map(uid => [id, uid, 'member']);
        await pool.query('INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES ?', [values]);
        if (fastify.redis) await fastify.redis.sadd(`chat:group:${id}:members`, ...userIds);
      } else {
        await pool.query('DELETE FROM chat_group_members WHERE group_id = ? AND user_id IN (?)', [id, userIds]);
        if (fastify.redis) {
          for (const uid of userIds) await fastify.redis.srem(`chat:group:${id}:members`, uid);
        }
      }

      // 广播通知前端刷新
      if (fastify.io) {
        fastify.io.to(`group_${id}`).emit('member_update', { groupId: id, action });
      }

      return { success: true };
    } catch (err) { return reply.code(500).send({ success: false }); }
  });

  // 11. List All Groups (For Admin Dashboard)
  fastify.get('/api/chat/admin/groups', async (request, reply) => {
    try {
      const [groups] = await pool.query(`
        SELECT g.*, d.name as department_name, u.real_name as owner_name,
        (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) as member_count
        FROM chat_groups g
        LEFT JOIN departments d ON g.department_id = d.id
        LEFT JOIN users u ON g.owner_id = u.id
        ORDER BY g.created_at DESC
      `);
      return { success: true, data: groups };
    } catch (err) { return reply.code(500).send({ success: false }); }
  });
}