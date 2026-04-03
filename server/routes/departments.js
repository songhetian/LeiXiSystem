// 部门管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')
const { recordLog } = require('../utils/logger')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 管理端获取部门列表（支持包括已删除的）
  fastify.get('/api/departments', async (request, reply) => {
    const { includeDeleted, name } = request.query

    try {
      let query = 'SELECT * FROM departments WHERE 1=1'
      const params = []

      if (includeDeleted !== 'true') {
        query += ' AND status != "deleted"'
      }

      if (name) {
        query += ' AND name LIKE ?'
        params.push(`%${name}%`)
      }

      query += ' ORDER BY sort_order, id'

      const [rows] = await pool.query(query, params)
      return rows
    } catch (error) {
      console.error('获取部门管理列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取部门列表 (带权限感知的安全视图)
  fastify.get('/api/departments/list', async (request, reply) => {
    try {
      const { _t, _retry } = request.query;
      
      // 1. 严格提取用户权限 (如果带了 _retry，则强制跳过 Redis 缓存)
      const { getUserPermissions } = require('../middleware/checkPermission');
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../config');
      
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '').trim();
      
      if (!token) return reply.code(401).send({ success: false, message: '身份过期' });
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 🚀 核心物理穿透：如果是带了重试标志，强制物理查询数据库
      let permissions;
      if (_retry === 'true') {
        // 物理同步：直接查库，不走 Redis，不走 Token 旧数据
        permissions = await getUserPermissions(pool, decoded.id, null, null); 
      } else {
        permissions = await require('../middleware/checkPermission').extractUserPermissions(request, pool);
      }
      
      if (!permissions) return reply.code(401).send({ success: false, message: '权限识别失败' });

      let query = 'SELECT * FROM departments WHERE status != "deleted"'
      const params = []

      // 3. 🚀 严格分级决策
      // 🛡️ 雷犀强化：只有显式名为“超级管理员”的角色才放行，不再信任 admin 用户名
      const isRealAdmin = permissions.roles?.some(r => r.name === '超级管理员');
      
      if (isRealAdmin) {
        query += ' AND status = "active"'
      } else if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        query += ` AND id IN (${permissions.viewableDepartmentIds.map(() => '?').join(',')})`
        params.push(...permissions.viewableDepartmentIds)
      } else if (permissions.departmentId) {
        query += ' AND id = ?'
        params.push(permissions.departmentId)
      } else {
        return { success: true, data: [] }
      }

      query += ' ORDER BY sort_order, id'

      const [rows] = await pool.query(query, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('部门权限引擎物理穿透失败:', error)
      return reply.code(500).send({ success: false, message: '系统繁忙' })
    }
  })

  // 获取所有部门列表（无权限过滤，用于下拉选择）
  fastify.get('/api/departments/all', async (request, reply) => {
    const { includeInactive } = request.query;
    const redis = fastify.redis;
    const cacheKey = `metadata:departments:all:${includeInactive === 'true' ? 'full' : 'active'}`;

    try {
      // 1. 尝试从 Redis 获取
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return { success: true, data: JSON.parse(cached) };
        }
      }

      // 2. Redis 没有，查 MySQL
      let query = 'SELECT * FROM departments WHERE 1=1';
      if (includeInactive !== 'true') {
        query += ' AND status = "active"';
      } else {
        query += ' AND status != "deleted"';
      }
      query += ' ORDER BY sort_order, id';
      
      const [rows] = await pool.query(query)

      // 3. 写入 Redis (有效期 24 小时)
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(rows), 'EX', 86400);
      }

      return { success: true, data: rows }
    } catch (error) {
      console.error('获取所有部门列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取单个部门详情
  fastify.get('/api/departments/detail/:id', async (request, reply) => {
    const { id } = request.params
    const redis = fastify.redis;
    const cacheKey = `metadata:department:detail:${id}`;

    try {
      // 尝试从缓存获取
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return { success: true, data: JSON.parse(cached) };
      }

      const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id])
      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '部门不存在' })
      }

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(rows[0]), 'EX', 3600);
      }

      return { success: true, data: rows[0] }
    } catch (error) {
      console.error('获取部门详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 创建部门
  fastify.post('/api/departments/create', async (request, reply) => {
    const { name, parent_id, description, manager_id, status, sort_order } = request.body
    const redis = fastify.redis;

    try {
      // 验证必填字段
      if (!name) {
        return reply.code(400).send({ success: false, message: '请填写部门名称' })
      }

      // 检查部门名称是否已存在
      const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [name])
      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '部门名称已存在' })
      }

      const [result] = await pool.query(
        `INSERT INTO departments
        (name, parent_id, description, manager_id, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          parent_id || null,
          description || null,
          manager_id || null,
          status || 'active',
          sort_order || 0
        ]
      )

      // 清理部门列表缓存
      if (redis) {
        await redis.del('metadata:departments:all:active');
        await redis.del('metadata:departments:all:full');
      }

      // --- Auto-Create Chat Group for Department ---
      try {
        const deptId = result.insertId;
        // Find a valid owner (Manager or Admin or First User)
        let ownerId = manager_id;
        
        if (!ownerId) {
            // 修正：数据库中暂无 is_system 字段，使用角色名 "超级管理员" 查找群主
            const [admins] = await pool.query(`
                SELECT u.id 
                FROM users u
                JOIN user_roles ur ON u.id = ur.user_id
                JOIN roles r ON ur.role_id = r.id
                WHERE r.name = '超级管理员' AND u.status = 'active'
                ORDER BY u.id ASC
                LIMIT 1
            `);
            if (admins.length > 0) ownerId = admins[0].id;
        }

        // 如果还没找到，兜底找第一个用户（防止报错，但不推荐）
        if (!ownerId) {
            const [firstUser] = await pool.query('SELECT id FROM users WHERE status = "active" ORDER BY id ASC LIMIT 1');
            if (firstUser.length > 0) ownerId = firstUser[0].id;
        }
        
        if (ownerId) {
            const [groupResult] = await pool.query(
                'INSERT INTO chat_groups (name, owner_id, type, department_id) VALUES (?, ?, ?, ?)',
                [name, ownerId, 'group', deptId]
            );
            
            const groupId = groupResult.insertId;
            
            // 自动将群主加入成员列表
            await pool.query(
                'INSERT INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                [groupId, ownerId, 'owner']
            );

            // Record Operation Log
            await recordLog(pool, {
                user_id: 0, // System action
                username: 'system',
                real_name: '系统自动',
                module: 'messaging',
                action: `自动为新部门 [${name}] 创建聊天群组`,
                method: 'SYSTEM',
                url: '/api/departments/create',
                ip: '127.0.0.1',
                status: 1
            });
        }
      } catch (groupErr) {
          console.error('Failed to auto-create group for department:', groupErr);
          // Don't fail the request, just log it.
      }

      return {
        success: true,
        message: '部门创建成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('创建部门失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // 更新部门
  fastify.put('/api/departments/update/:id', async (request, reply) => {
    const { id } = request.params
    const { name, parent_id, description, manager_id, status, sort_order } = request.body
    const redis = fastify.redis;

    try {
      // 检查部门是否存在
      const [existing] = await pool.query('SELECT id FROM departments WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '部门不存在' })
      }

      // 检查名称是否与其他部门重复
      const [nameCheck] = await pool.query('SELECT id FROM departments WHERE name = ? AND id != ?', [name, id])
      if (nameCheck.length > 0) {
        return reply.code(400).send({ success: false, message: '部门名称已存在' })
      }

      await pool.query(
        `UPDATE departments SET
        name = ?, parent_id = ?, description = ?, manager_id = ?, status = ?, sort_order = ?
        WHERE id = ?`,
        [
          name,
          parent_id || null,
          description || null,
          manager_id || null,
          status || 'active',
          sort_order || 0,
          id
        ]
      )

      // --- Sync Name to Chat Group ---
      try {
          await pool.query('UPDATE chat_groups SET name = ? WHERE department_id = ?', [name, id]);
      } catch (syncErr) {
          console.error('Failed to sync group name:', syncErr);
      }

      // 清理缓存
      if (redis) {
        await redis.del('metadata:departments:all:active');
        await redis.del('metadata:departments:all:full');
        await redis.del(`metadata:department:detail:${id}`);
      }

      return { success: true, message: '部门更新成功' }
    } catch (error) {
      console.error('更新部门失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除部门 (软删除)
  fastify.delete('/api/departments/delete/:id', async (request, reply) => {
    const { id } = request.params
    const redis = fastify.redis;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 检查部门是否存在
      const [existing] = await connection.query('SELECT id, name FROM departments WHERE id = ?', [id])
      if (existing.length === 0) {
        await connection.rollback();
        return reply.code(404).send({ success: false, message: '部门不存在' })
      }

      // 2. 执行软删除：更新部门状态
      await connection.query("UPDATE departments SET status = 'deleted' WHERE id = ?", [id]);

      // 3. 同时将该部门下的所有员工状态设置为 deleted (联动删除)
      await connection.query(`
        UPDATE employees e
        LEFT JOIN users u ON e.user_id = u.id
        SET e.status = 'deleted', u.status = 'deleted'
        WHERE u.department_id = ?
      `, [id]);

      // 4. 处理关联的聊天群组 (目前通过清除 department_id 关联来保留群组数据但不影响部门重建)
      await connection.query('UPDATE chat_groups SET department_id = NULL WHERE department_id = ?', [id]);

      await connection.commit();

      // 5. 清理缓存
      if (redis) {
        await redis.del('metadata:departments:all:active');
        await redis.del('metadata:departments:all:full');
        await redis.del(`metadata:department:detail:${id}`);
        // 清理员工列表相关的缓存
        const keys = await redis.keys('list:employees:default:*');
        if (keys.length > 0) await redis.del(...keys);
      }

      // 6. 记录日志
      await recordLog(connection, {
          user_id: 0, 
          username: 'system',
          real_name: '系统自动',
          module: 'organization',
          action: `软删除部门 [${existing[0].name}] 及其关联员工`,
          method: 'DELETE',
          url: `/api/departments/delete/${id}`,
          ip: '127.0.0.1',
          status: 1
      });

      return { success: true, message: '部门及其关联员工已成功标记为删除' }
    } catch (error) {
      await connection.rollback();
      console.error('删除部门失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败: ' + error.message })
    } finally {
      connection.release();
    }
  })

  // 恢复部门
  fastify.post('/api/departments/restore/:id', async (request, reply) => {
    const { id } = request.params
    const redis = fastify.redis;

    try {
      // 1. 恢复部门状态
      await pool.query("UPDATE departments SET status = 'active' WHERE id = ?", [id]);

      // 2. 同时恢复该部门下的所有已删除员工和用户状态
      await pool.query(`
        UPDATE employees e
        LEFT JOIN users u ON e.user_id = u.id
        SET e.status = 'active', u.status = 'active'
        WHERE u.department_id = ? AND (e.status = 'deleted' OR u.status = 'deleted')
      `, [id]);

      // 清理缓存
      if (redis) {
        await redis.del('metadata:departments:all:active');
        await redis.del('metadata:departments:all:full');
        await redis.del(`metadata:department:detail:${id}`);
        const keys = await redis.keys('list:employees:default:*');
        if (keys.length > 0) await redis.del(...keys);
      }

      // 记录日志
      await recordLog(pool, {
          user_id: 0,
          username: 'system',
          real_name: '系统自动',
          module: 'organization',
          action: `恢复部门 [ID: ${id}] 及其关联员工`,
          method: 'POST',
          url: `/api/departments/restore/${id}`,
          ip: '127.0.0.1',
          status: 1
      });

      return { success: true, message: '部门及其关联员工已恢复启用' };
    } catch (error) {
      console.error('恢复部门失败:', error);
      return reply.code(500).send({ success: false, message: '恢复失败: ' + error.message });
    }
  })

  // 一键同步/补全所有部门的聊天群组
  fastify.post('/api/departments/sync-all-groups', async (request, reply) => {
    const connection = await pool.getConnection();
    const redis = fastify.redis;
    
    try {
      await connection.beginTransaction();

      // 1. 获取所有非删除状态的部门
      const [depts] = await connection.query("SELECT * FROM departments WHERE status != 'deleted'");
      
      let createdCount = 0;
      let memberSyncedCount = 0;

      for (const dept of depts) {
        // 2. 检查该部门是否已有群组
        const [existingGroups] = await connection.query("SELECT id FROM chat_groups WHERE department_id = ?", [dept.id]);
        
        let groupId;
        if (existingGroups.length === 0) {
          // 3. 创建缺失的群组
          // 确定群主 (部门负责人 -> 第一个超级管理员 -> 第一个用户)
          let ownerId = dept.manager_id;
          if (!ownerId) {
            const [admins] = await connection.query(`
              SELECT u.id FROM users u 
              JOIN user_roles ur ON u.id = ur.user_id 
              JOIN roles r ON ur.role_id = r.id 
              WHERE r.name = '超级管理员' AND u.status = 'active' LIMIT 1
            `);
            ownerId = admins[0]?.id;
          }
          if (!ownerId) {
            const [users] = await connection.query("SELECT id FROM users WHERE status = 'active' LIMIT 1");
            ownerId = users[0]?.id;
          }

          if (ownerId) {
            const [gRes] = await connection.query(
              "INSERT INTO chat_groups (name, owner_id, type, department_id) VALUES (?, ?, 'group', ?)",
              [dept.name, ownerId, dept.id]
            );
            groupId = gRes.insertId;
            createdCount++;
            
            // 将群主加入成员表
            await connection.query("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, 'admin')", [groupId, ownerId]);
          }
        } else {
          groupId = existingGroups[0].id;
        }

        // 4. 同步该部门下的所有员工进群
        if (groupId) {
          const [deptUsers] = await connection.query("SELECT id FROM users WHERE department_id = ? AND status = 'active'", [dept.id]);
          if (deptUsers.length > 0) {
            const values = deptUsers.map(u => [groupId, u.id, 'member']);
            // 使用 INSERT IGNORE 避免重复插入导致的报错
            await connection.query("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES ?", [values]);
            memberSyncedCount += deptUsers.length;
            
            // 同步到 Redis (如果可用)
            if (redis) {
              const uids = deptUsers.map(u => String(u.id));
              await redis.sadd(`chat:group:${groupId}:members`, ...uids);
            }
          }
        }
      }

      await connection.commit();
      
      // 记录日志
      await recordLog(connection, {
          user_id: 0, 
          username: 'system',
          real_name: '系统自动',
          module: 'messaging',
          action: `执行一键同步部门群组：新建群组 ${createdCount} 个，同步成员 ${memberSyncedCount} 人次`,
          method: 'POST',
          url: '/api/departments/sync-all-groups',
          ip: '127.0.0.1',
          status: 1
      });

      return { 
        success: true, 
        message: `同步完成！新建群组 ${createdCount} 个，同步成员 ${memberSyncedCount} 人次`,
        data: { createdCount, memberSyncedCount } 
      };
    } catch (error) {
      await connection.rollback();
      console.error('一键同步群组失败:', error);
      return reply.code(500).send({ success: false, message: '同步失败: ' + error.message });
    } finally {
      connection.release();
    }
  });

  // 获取部门员工列表
  fastify.get('/api/departments/employees/:departmentId', async (request, reply) => {
    const { departmentId } = request.params

    try {

      // 查询该部门的所有员工（通过employees表关联users表）
      const [employees] = await pool.query(
        `SELECT
          e.id,
          e.employee_no,
          e.user_id,
          u.real_name,
          u.username,
          u.email,
          u.phone,
          u.department_id,
          pos.name as position,
          e.hire_date,
          e.status,
          e.rating
        FROM employees e
        INNER JOIN users u ON e.user_id = u.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        WHERE u.department_id = ? AND u.status = 'active' AND e.status = 'active'
        ORDER BY e.employee_no`,
        [departmentId]
      )

      return {
        success: true,
        data: employees
      }
    } catch (error) {
      console.error('获取部门员工失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取部门员工失败: ' + error.message
      })
    }
  })
}
