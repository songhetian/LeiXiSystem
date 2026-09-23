const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const { recordLog } = require('../utils/logger');
const { syncUserChatGroups } = require('../utils/personnelClosure');

async function personnelLogicRoutes(fastify, options) {
  const pool = fastify.mysql;
  const redis = fastify.redis;

  // ============================================================
  // 高性能审计工具：Redis 缓存操作人信息 (解决 DB 查询慢的问题)
  // ============================================================
  const auditAction = async (request, module, action, targetId = null) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      const opId = decoded.id;
      const cacheKey = `user:identity:${opId}`;

      let op = null;

      // 1. 优先从 Redis 获取操作人名片
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) op = JSON.parse(cached);
      }

      // 2. 缓存未命中，查一次数据库并回写缓存
      if (!op) {
        const [opRows] = await pool.query('SELECT username, real_name FROM users WHERE id = ?', [opId]);
        op = opRows[0] || { username: 'system', real_name: '系统' };
        if (redis) await redis.set(cacheKey, JSON.stringify(op), 'EX', 86400); // 缓存 24 小时
      }

      // 3. 异步记录日志 (不阻塞主业务)
      recordLog(pool, {
        user_id: opId,
        username: op.username,
        real_name: op.real_name,
        module,
        action: `${action}${targetId ? ` (目标ID: ${targetId})` : ''}`,
        method: request.method,
        url: request.url,
        ip: request.ip,
        status: 1
      }).catch(e => console.error('Log Record Error:', e));

    } catch (e) { console.error('Audit Engine Error:', e); }
  };

  // 1. 设置主管 (带 Redis 日志 + 缓存清理)
  fastify.put('/api/users/:userId/department-manager', async (request, reply) => {
    const { userId } = request.params;
    const { isDepartmentManager } = request.body;
    await pool.query('UPDATE users SET is_department_manager = ? WHERE id = ?', [isDepartmentManager ? 1 : 0, userId]);
    
    if (redis) {
      const keys = await redis.keys('list:employees:*');
      if (keys.length > 0) await redis.del(...keys);
    }
    await auditAction(request, 'user', `${isDepartmentManager ? '设为' : '取消'}部门主管`, userId);
    return { success: true };
  });

  // 2. 状态调整闭环 (支持 deleted 状态)
  fastify.put('/api/employees/:id/status-closure', async (request, reply) => {
    const { id } = request.params;
    const { status, reason, changeDate } = request.body;
    
    console.log(`[Status Closure] ID: ${id}, Target Status: ${status}`);

    const [empRows] = await pool.query('SELECT user_id, department_id, position_id FROM employees WHERE id = ?', [id]);
    if (empRows.length === 0) return { success: false, message: '员工不存在' };
    const { user_id, department_id, position_id } = empRows[0];

    try {
      // 1. 更新数据库状态 (同步两表)
      await pool.query('UPDATE employees SET status = ? WHERE id = ?', [status, id]);
      await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, user_id]);
      
      // 2. 聊天组闭环 (Redis + WebSocket + 强制断开)
      const { forceDisconnectUser } = require('../websocket');
      await syncUserChatGroups(pool, user_id, department_id, status === 'active', redis, fastify.io);

      if (status !== 'active') {
        forceDisconnectUser(fastify.io, user_id);
        await pool.query('UPDATE devices SET device_status = "idle", current_user_id = NULL WHERE current_user_id = ?', [user_id]);
        if (redis) {
          await redis.del(`user:session:${user_id}`);
          await redis.del(`user:permissions:${user_id}`);
        }
      }

      // 3. 记录变动履历
      await pool.query(
        `INSERT INTO employee_changes (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position_id, new_position_id, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user_id, status === 'resigned' ? 'resign' : (status === 'active' ? 'hire' : (status === 'deleted' ? 'terminate' : 'transfer')), changeDate || new Date(), department_id, department_id, position_id, position_id, reason || '手动状态调整']
      );

      if (redis) {
        const keys = await redis.keys('*employees*');
        if (keys.length > 0) await redis.del(...keys);
        const { cacheUserProfile } = require('../utils/personnelClosure');
        await cacheUserProfile(pool, redis, user_id);
      }

      await auditAction(request, 'user', `变更状态为: ${status}`, user_id);
      return { success: true };
    } catch (err) {
      console.error('[Status Closure Error]:', err);
      return reply.code(500).send({ success: false, message: err.message });
    }
  });

  // 3. 批量恢复 (一键在职)
  fastify.post('/api/employees/batch-restore', async (request, reply) => {
    const { ids } = request.body;
    if (!ids || ids.length === 0) return { success: false };
    for (const id of ids) {
      const [emp] = await pool.query('SELECT user_id, department_id FROM employees WHERE id = ?', [id]);
      if (emp.length > 0) {
        await pool.query('UPDATE employees SET status = "active" WHERE id = ?', [id]);
        await pool.query('UPDATE users SET status = "active" WHERE id = ?', [emp[0].user_id]);
        await syncUserChatGroups(pool, emp[0].user_id, emp[0].department_id, true, redis, fastify.io);
      }
    }
    if (redis) {
      const keys = await redis.keys('*employees*');
      if (keys.length > 0) await redis.del(...keys);
    }
    await auditAction(request, 'user', `批量恢复(在职) ${ids.length} 名成员`);
    return { success: true };
  });

  // 4. 批量状态闭环 (一键离职/停用)
  fastify.post('/api/employees/batch-closure', async (request, reply) => {
    const { ids, status, reason } = request.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return reply.code(400).send({ success: false, message: '无效的参数' });
    }

    const { forceDisconnectUser } = require('../websocket');
    let successCount = 0;

    for (const id of ids) {
      try {
        const [empRows] = await pool.query('SELECT user_id, department_id, position_id FROM employees WHERE id = ?', [id]);
        if (empRows.length === 0) continue;
        const { user_id, department_id, position_id } = empRows[0];

        // 1. 更新数据库状态
        await pool.query('UPDATE employees SET status = ? WHERE id = ?', [status, id]);
        await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, user_id]);

        // 2. 聊天组闭环 (Redis + WebSocket 广播)
        await syncUserChatGroups(pool, user_id, department_id, status === 'active', redis, fastify.io);

        // 3. 如果非在职，强制踢下线并回收设备
        if (status !== 'active') {
          forceDisconnectUser(fastify.io, user_id);
          await pool.query('UPDATE devices SET device_status = "idle", current_user_id = NULL WHERE current_user_id = ?', [user_id]);
          if (redis) {
            await redis.del(`user:session:${user_id}`);
            await redis.del(`user:permissions:${user_id}`);
          }
        }

        // 4. 记录变动履历
        try {
          await pool.query(
            `INSERT INTO employee_changes (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position_id, new_position_id, reason)
             VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
            [id, user_id, status === 'resigned' ? 'resign' : (status === 'active' ? 'hire' : (status === 'deleted' ? 'terminate' : 'transfer')), department_id, department_id, position_id, position_id, reason || '批量状态调整']
          );
        } catch (e) {}

        successCount++;
      } catch (err) {
        console.error(`Batch closure failed for ID ${id}:`, err);
      }
    }

    // 清理全局列表缓存
    if (redis) {
      const keys = await redis.keys('*employees*');
      if (keys.length > 0) await redis.del(...keys);
    }

    await auditAction(request, 'user', `批量变更 ${successCount} 名员工状态为: ${status}`);
    return { success: true, message: `成功处理 ${successCount} 名员工` };
  });
}

module.exports = personnelLogicRoutes;