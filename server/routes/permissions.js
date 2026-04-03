const { requirePermission } = require('../middleware/auth')
const { recordLog } = require('../utils/logger')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

const permissionRoutes = async (fastify, options) => {
  const connInit = await fastify.mysql.getConnection();
  try {
    await connInit.query(`
      CREATE TABLE IF NOT EXISTS permission_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        permission_ids TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connInit.release();
  }
  // Create default system templates
  fastify.post('/api/permission-templates/create-default', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const templates = [
        {
          name: '员工基础权限',
          desc: '仅包含个人业务操作：打卡、申请、聊天、阅读知识库及个人记录。',
          codes: [
            'messaging:broadcast:view', 'attendance:clock:manage', 'attendance:record:view',
            'vacation:record:view', 'attendance:leave:apply', 'attendance:overtime:apply',
            'attendance:makeup:apply', 'knowledge:article:view', 'assessment:plan:view',
            'assessment:result:view', 'user:profile:update', 'user:memo:manage',
            'finance:payslip:view'
          ]
        },
        {
          name: '部门主管权限',
          desc: '管理赋能：拥有本部门员工名册管理、考勤/报销审核及排班权限。',
          codes: [
            // 继承基础并扩展
            'messaging:broadcast:view', 'attendance:clock:manage', 'attendance:record:view',
            'vacation:record:view', 'knowledge:article:view', 'assessment:plan:view',
            'assessment:result:view', 'user:profile:update', 'user:memo:manage',
            'finance:payslip:view',
            // 部门级管理权限
            'personnel:employee:view', 'personnel:employee:manage', 'personnel:change:view',
            'attendance:stats:view', 'attendance:approval:manage', 'vacation:approval:manage',
            'attendance:schedule:view', 'attendance:schedule:manage', 'finance:reimbursement:audit',
            'asset:device:view'
          ]
        }
      ];

      for (const t of templates) {
        // 先物理清理旧的同名模板，确保更新生效
        await connection.query('DELETE FROM permission_templates WHERE name = ?', [t.name]);
        
        // 查找有效的权限 ID
        const [perms] = await connection.query('SELECT id FROM permissions WHERE code IN (?)', [t.codes]);
        const ids = perms.map(p => p.id);
        
        await connection.query(
          'INSERT INTO permission_templates (name, description, permission_ids) VALUES (?, ?, ?)',
          [t.name, t.desc, JSON.stringify(ids)]
        );
      }

      return { success: true, message: '系统预置：员工基础、部门主管模板已重新对齐并上线' };
    } catch (error) {
      console.error('同步模板失败:', error);
      return reply.code(500).send({ success: false, message: '模板对齐失败' });
    } finally {
      connection.release();
    }
  });

  // Get all roles with their permissions
  fastify.get('/api/roles', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      // 优化查询逻辑，使用多表关联减少查询次数
      const [roles] = await connection.query(`
        SELECT id, name, description, level, is_system, created_at, updated_at 
        FROM roles 
        ORDER BY id
      `);

      // 获取所有角色关联的权限，通过一次查询获取，然后在内存中映射
      const [allPermissions] = await connection.query(`
        SELECT rp.role_id, p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
      `);

      // 将权限数据映射到各个角色
      for (let role of roles) {
        role.permissions = allPermissions.filter(p => p.role_id === role.id);
      }

      return { success: true, data: roles };
    } finally {
      connection.release();
    }
  });

  // Get all available permissions
  fastify.get('/api/permissions', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [permissions] = await connection.query('SELECT * FROM permissions ORDER BY module, code');
      return { success: true, data: permissions };
    } finally {
      connection.release();
    }
  });

  // Create a new role
  fastify.post('/api/roles', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { name, description, permissionIds, is_system } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否尝试创建同名的超级管理员角色
      if (name === '超级管理员' || (is_system && is_system === 1)) {
        await connection.rollback();
        return reply.code(403).send({ success: false, message: '不能创建系统内置角色' });
      }

      // 检查是否已存在同名角色
      const [existingRoles] = await connection.query(
        'SELECT id FROM roles WHERE name = ?',
        [name]
      );

      if (existingRoles.length > 0) {
        await connection.rollback();
        return reply.code(400).send({ success: false, message: '已存在同名角色' });
      }

      const [result] = await connection.query(
        'INSERT INTO roles (name, description, is_system) VALUES (?, ?, 0)',
        [name, description]
      );
      const roleId = result.insertId;

      if (permissionIds && permissionIds.length > 0) {
        const values = permissionIds.map(pid => [roleId, pid]);
        await connection.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      return { success: true, message: '角色创建成功', roleId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // Update role permissions
  fastify.put('/api/roles/:id', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, permissionIds } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // 获取角色当前信息进行验证
      const [roleRows] = await connection.query('SELECT name, is_system FROM roles WHERE id = ?', [id]);
      if (roleRows.length === 0) {
        await connection.rollback();
        return reply.code(404).send({ success: false, message: '角色不存在' });
      }

      const role = roleRows[0];
      
      // 核心保护：禁止修改系统内置标识
      // 如果尝试修改名称，验证是否为超级管理员保护的角色
      if (role.is_system === 1) {
        if (role.name === '超级管理员' && name !== '超级管理员') {
          await connection.rollback();
          return reply.code(403).send({ success: false, message: '不能修改超级管理员角色的名称' });
        }
      }

      // 更新基本信息，明确排除 is_system 的修改
      await connection.query(
        'UPDATE roles SET name = ?, description = ? WHERE id = ?',
        [name, description, id]
      );

      // Delete existing permissions
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);

      // Insert new permissions
      if (permissionIds && permissionIds.length > 0) {
        const values = permissionIds.map(pid => [id, pid]);
        await connection.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      return { success: true, message: '角色更新成功' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // 获取带有角色和部门权限的用户列表 (高性能版 - 彻底消除 N+1)
  fastify.get('/api/users-with-roles', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [users] = await connection.query(`
        SELECT u.id, u.username, u.real_name, u.email, u.phone, d.name as department_name, u.department_id
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.status != 'deleted'
        ORDER BY u.id DESC
      `);

      if (users.length === 0) return { success: true, data: [] };
      const userIds = users.map(u => u.id);

      const [allRoles] = await connection.query(`
        SELECT ur.user_id, r.id, r.name FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id IN (?)
      `, [userIds]);

      const [allDepts] = await connection.query(`
        SELECT ud.user_id, d.id, d.name FROM departments d
        JOIN user_departments ud ON d.id = ud.department_id WHERE ud.user_id IN (?)
      `, [userIds]);

      const rolesMap = allRoles.reduce((acc, curr) => {
        if (!acc[curr.user_id]) acc[curr.user_id] = [];
        acc[curr.user_id].push({ id: curr.id, name: curr.name });
        return acc;
      }, {});

      const deptsMap = allDepts.reduce((acc, curr) => {
        if (!acc[curr.user_id]) acc[curr.user_id] = [];
        acc[curr.user_id].push({ id: curr.id, name: curr.name });
        return acc;
      }, {});

      return {
        success: true,
        data: users.map(u => ({
          ...u,
          roles: rolesMap[u.id] || [],
          departments: deptsMap[u.id] || []
        }))
      };
    } finally { connection.release(); }
  });

  // Get users with their roles (Deprecated: use /api/users-with-roles for better performance)
  fastify.get('/api/users/roles', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [users] = await connection.query(`
        SELECT u.id, u.username, u.real_name, d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.id
      `);

      for (let user of users) {
        const [roles] = await connection.query(`
          SELECT r.id, r.name, r.description, r.level, r.is_system, r.created_at, r.updated_at
          FROM roles r
          JOIN user_roles ur ON r.id = ur.role_id
          WHERE ur.user_id = ?
        `, [user.id]);
        user.roles = roles;
      }

      return { success: true, data: users };
    } finally {
      connection.release();
    }
  });

  // Get roles for a specific user
  fastify.get('/api/users/:id/roles', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [roles] = await connection.query(`
        SELECT r.id, r.name, r.description
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY r.id
      `, [id]);

      return roles;
    } finally {
      connection.release();
    }
  });

  // Add a role to a user
  fastify.post('/api/users/:id/roles', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { role_id } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      // Check if user already has this role
      const [existing] = await connection.query(
        'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
        [id, role_id]
      );

      if (existing.length > 0) {
        return { success: false, message: '用户已拥有此角色' };
      }

      await connection.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [id, role_id]
      );

      return { success: true, message: '角色分配成功' };
    } finally {
      connection.release();
    }
  });

  // Remove a role from a user
  fastify.delete('/api/users/:id/roles/:roleId', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id, roleId } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [result] = await connection.query(
        'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
        [id, roleId]
      );

      if (result.affectedRows === 0) {
        return { success: false, message: '用户没有此角色' };
      }

      return { success: true, message: '角色移除成功' };
    } finally {
      connection.release();
    }
  });

  // Update user roles (batch update)
  fastify.put('/api/users/:id/roles', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { roleIds } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // Delete existing roles
      await connection.query('DELETE FROM user_roles WHERE user_id = ?', [id]);

      // Insert new roles
      if (roleIds && roleIds.length > 0) {
        const values = roleIds.map(rid => [id, rid]);
        await connection.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();

      // 记录日志
      await recordLog(connection, {
        module: 'permission',
        action: `更新用户角色: 用户ID ${id}`,
        method: 'PUT',
        url: request.url,
        ip: request.ip,
        params: { roleIds }
      });

      // 🔔 发送实时通知给用户
      try {
        // 获取用户信息
        const [users] = await fastify.mysql.query('SELECT id, username, real_name FROM users WHERE id = ?', [id]);
        if (users.length > 0) {
          const user = users[0];

          // 获取角色名称
          if (roleIds && roleIds.length > 0) {
            const [roles] = await fastify.mysql.query('SELECT name FROM roles WHERE id IN (?)', [roleIds]);
            const roleNames = roles.map(r => r.name).join(', ');

            // 发送WebSocket通知
            if (fastify.io) {
              const { sendNotificationToUser } = require('../websocket');
              sendNotificationToUser(fastify.io, id, {
                type: 'role_assignment',
                title: '角色变更通知',
                content: `您的角色已更新为: ${roleNames}`,
                related_id: id,
                related_type: 'user_role',
                created_at: new Date()
              });
            }
          }
        }
      } catch (notifyError) {
        console.error('发送角色变更通知失败:', notifyError);
      }

      return { success: true, message: '用户角色更新成功' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // Delete role
  fastify.delete('/api/roles/:id', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否为系统角色
      const [roleRows] = await connection.query('SELECT name, is_system FROM roles WHERE id = ?', [id]);
      if (roleRows.length > 0) {
        const role = roleRows[0];
        // 特别保护超级管理员角色
        if (role.name === '超级管理员') {
          await connection.rollback();
          return reply.code(403).send({ success: false, message: '不能删除超级管理员角色' });
        }
        // 保护其他系统角色
        if (role.is_system === 1) {
          await connection.rollback();
          return reply.code(403).send({ success: false, message: '不能删除系统角色' });
        }
      }

      // 删除角色相关的所有关联数据
      await connection.query('DELETE FROM user_roles WHERE role_id = ?', [id]);
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      await connection.query('DELETE FROM role_departments WHERE role_id = ?', [id]);

      // 删除角色本身
      const [result] = await connection.query('DELETE FROM roles WHERE id = ?', [id]);

      await connection.commit();

      if (result.affectedRows > 0) {
        return { success: true, message: '角色删除成功' };
      } else {
        return { success: false, message: '角色不存在' };
      }
    } catch (error) {
      await connection.rollback();
      console.error('删除角色失败:', error);
      return reply.code(500).send({ success: false, message: '删除角色失败' });
    } finally {
      connection.release();
    }
  });

  // Get role permissions
  fastify.get('/api/roles/:id/permissions', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [permissions] = await connection.query(`
        SELECT p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.module, p.id
      `, [id]);

      return { success: true, data: permissions };
    } finally {
      connection.release();
    }
  });

  // Add permission to role
  fastify.post('/api/roles/:id/permissions', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { permission_id } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      // Check if role already has this permission
      const [existing] = await connection.query(
        'SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?',
        [id, permission_id]
      );

      if (existing.length > 0) {
        return { success: true, message: '角色已拥有此权限' };
      }

      await connection.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [id, permission_id]
      );

      return { success: true, message: '权限分配成功' };
    } catch (error) {
      console.error('添加权限失败:', error);
      return { success: false, message: '权限分配失败' };
    } finally {
      connection.release();
    }
  });

  // Delete permission from role
  fastify.delete('/api/roles/:id/permissions/:permissionId', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id, permissionId } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [result] = await connection.query(
        'DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?',
        [id, permissionId]
      );

      if (result.affectedRows === 0) {
        return { success: false, message: '角色没有此权限' };
      }

      return { success: true, message: '权限移除成功' };
    } catch (error) {
      console.error('移除权限失败:', error);
      return { success: false, message: '权限移除失败' };
    } finally {
      connection.release();
    }
  });

  // Get audit logs
  fastify.get('/api/permissions/audit-logs', {
    preHandler: requirePermission('system:log:view')
  }, async (request, reply) => {
    const { page = 1, limit = 20, employee_id, operation_type } = request.query;
    const offset = (page - 1) * limit;

    const connection = await fastify.mysql.getConnection();
    try {
      let query = `
        SELECT l.*,
               e.real_name as employee_name,
               op.real_name as operator_name
        FROM vacation_audit_logs l
        LEFT JOIN employees e ON l.employee_id = e.id
        LEFT JOIN users op ON l.operator_id = op.id
        WHERE 1=1
      `;
      const params = [];

      if (employee_id) {
        query += ' AND l.employee_id = ?';
        params.push(employee_id);
      }

      if (operation_type) {
        query += ' AND l.operation_type = ?';
        params.push(operation_type);
      }

      // Count total
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as total FROM (${query}) as t`,
        params
      );
      const total = countResult[0].total;

      // Get data
      query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await connection.query(query, params);

      return {
        success: true,
        data: rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      };
    } finally {
      connection.release();
    }
  });

  // ==================== 角色部门权限管理 ====================
  // 获取角色的部门权限列表
  fastify.get('/api/roles/:id/departments', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT d.*
         FROM departments d
         INNER JOIN role_departments rd ON d.id = rd.department_id
         WHERE rd.role_id = ?
         ORDER BY d.sort_order, d.id`,
        [id]
      );
      return { success: true, data: rows };
    } catch (error) {
      console.error('获取角色部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch role departments' });
    } finally {
      connection.release();
    }
  });

  // 为角色添加部门权限
  fastify.post('/api/roles/:id/departments', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { department_id } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.query(
        'INSERT IGNORE INTO role_departments (role_id, department_id) VALUES (?, ?)',
        [id, department_id]
      );
      return { success: true, message: '部门权限添加成功' };
    } catch (error) {
      console.error('添加角色部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to add department permission' });
    } finally {
      connection.release();
    }
  });

  // 批量设置角色的部门权限
  fastify.put('/api/roles/:id/departments', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { department_ids } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM role_departments WHERE role_id = ?', [id]);

      if (Array.isArray(department_ids) && department_ids.length > 0) {
        // Filter out invalid or non-numeric IDs to prevent SQL errors
        const validDeptIds = department_ids.filter(id => id && !isNaN(id));
        
        if (validDeptIds.length > 0) {
          const values = validDeptIds.map(deptId => [id, deptId]);
          await connection.query(
            'INSERT INTO role_departments (role_id, department_id) VALUES ?',
            [values]
          );
        }
      }

      await connection.commit();
      return { success: true, message: '部门权限设置成功', count: department_ids?.length || 0 };
    } catch (error) {
      await connection.rollback();
      console.error('批量设置角色部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to update department permissions' });
    } finally {
      connection.release();
    }
  });

  // 移除角色的部门权限
  fastify.delete('/api/roles/:roleId/departments/:departmentId', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { roleId, departmentId } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.query(
        'DELETE FROM role_departments WHERE role_id = ? AND department_id = ?',
        [roleId, departmentId]
      );
      return { success: true, message: '部门权限移除成功' };
    } catch (error) {
      console.error('移除角色部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to remove department permission' });
    } finally {
      connection.release();
    }
  });

  // ==================== 员工部门权限管理 ====================
  // 获取员工的部门权限列表
  fastify.get('/api/users/:id/departments', {
    preHandler: requirePermission('user:employee:view')  // 修改权限代码
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      // 检查用户是否存在
      const [userRows] = await connection.query('SELECT id FROM users WHERE id = ?', [id]);
      if (userRows.length === 0) {
        return { success: true, data: [] }; // 如果用户不存在，直接返回空列表，防止 500 导致整个页面崩溃
      }

      const [rows] = await connection.query(
        `SELECT d.*
         FROM departments d
         INNER JOIN user_departments ud ON d.id = ud.department_id
         WHERE ud.user_id = ?
         ORDER BY d.sort_order, d.id`,
        [id]
      );
      return { success: true, data: rows };
    } catch (error) {
      console.error('获取员工部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch user departments', details: error.message });
    } finally {
      connection.release();
    }
  });

  // 为员工添加部门权限
  fastify.post('/api/users/:id/departments', {
    preHandler: requirePermission('user:employee:manage')  // 修改权限代码
  }, async (request, reply) => {
    const { id } = request.params;
    const { department_id } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.query(
        'INSERT IGNORE INTO user_departments (user_id, department_id) VALUES (?, ?)',
        [id, department_id]
      );
      return { success: true, message: '部门权限添加成功' };
    } catch (error) {
      console.error('添加员工部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to add department permission' });
    } finally {
      connection.release();
    }
  });

  // 批量设置员工的部门权限
  fastify.put('/api/users/:id/departments', {
    preHandler: requirePermission('user:employee:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { department_ids } = request.body;
    
    console.log(`[Permission] Setting departments for user ${id}:`, department_ids);
    
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // 检查用户是否存在
      const [userRows] = await connection.query('SELECT id FROM users WHERE id = ?', [id]);
      if (userRows.length === 0) {
        await connection.rollback();
        return reply.code(404).send({ success: false, message: `用户 ID ${id} 不存在，请刷新页面重试` });
      }

      // 删除旧权限
      await connection.query('DELETE FROM user_departments WHERE user_id = ?', [id]);

      // 插入新权限
      if (Array.isArray(department_ids) && department_ids.length > 0) {
        // 过滤掉可能的非数字项
        const validDeptIds = department_ids.filter(d => d && !isNaN(d));
        if (validDeptIds.length > 0) {
          const values = validDeptIds.map(deptId => [id, deptId]);
          await connection.query(
            'INSERT INTO user_departments (user_id, department_id) VALUES ?',
            [values]
          );
        }
      }

      await connection.commit();

      // --- 🛡️ 雷犀强化：实时同步体系 ---
      // 1. 清理 Redis 缓存
      const redis = fastify.redis;
      if (redis) {
        await redis.del(`user:permissions:${id}`);
        await redis.del(`user:identity:${id}`);
      }

      // 2. WebSocket 广播静默刷新
      if (fastify.io) {
        fastify.io.to(`user_${id}`).emit('permissions_updated', { 
          message: '您的部门访问权限已由管理员更新',
          type: 'department_scope'
        });
      }

      // --- 关键修复：从 Token 中提取真实操作人 ---
      const token = request.headers.authorization?.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      const [opRows] = await connection.query('SELECT real_name, username FROM users WHERE id = ?', [decoded.id]);
      const op = opRows[0] || { real_name: '系统管理员', username: 'admin' };

      // 记录日志 (带上真实操作人信息)
      await recordLog(connection, {
        user_id: decoded.id,
        real_name: op.real_name,
        username: op.username,
        module: 'permission',
        action: `设置用户部门权限: 用户ID ${id}`,
        method: 'PUT',
        url: request.url,
        ip: request.ip,
        params: { department_ids }
      });

      return { success: true, message: '部门权限设置成功', count: department_ids?.length || 0 };
    } catch (error) {
      await connection.rollback();
      console.error('批量设置员工部门权限失败:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to update department permissions',
        details: error.message 
      });
    } finally {
      connection.release();
    }
  });

  // 移除员工的部门权限
  fastify.delete('/api/users/:userId/departments/:departmentId', {
    preHandler: requirePermission('user:employee:manage')  // 修改权限代码
  }, async (request, reply) => {
    const { userId, departmentId } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.query(
        'DELETE FROM user_departments WHERE user_id = ? AND department_id = ?',
        [userId, departmentId]
      );
      return { success: true, message: '部门权限移除成功' };
    } catch (error) {
      console.error('移除员工部门权限失败:', error);
      return reply.code(500).send({ success: false, error: 'Failed to remove department permission' });
    } finally {
      connection.release();
    }
  });

  fastify.get('/api/permission-templates', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [rows] = await connection.query('SELECT id, name, description, permission_ids, created_at, updated_at FROM permission_templates ORDER BY id DESC');
      return { success: true, data: rows.map(r => {
        const permissionIds = Array.isArray(r.permission_ids) ? r.permission_ids : (r.permission_ids ? JSON.parse(r.permission_ids) : []);
        return { ...r, permission_ids: permissionIds };
      }) };
    } finally {
      connection.release();
    }
  });

  fastify.get('/api/permission-templates/:id', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [rows] = await connection.query('SELECT id, name, description, permission_ids, created_at, updated_at FROM permission_templates WHERE id = ?', [id]);
      if (rows.length === 0) return reply.code(404).send({ success: false, message: 'Not found' });
      const r = rows[0];
      const permissionIds = Array.isArray(r.permission_ids) ? r.permission_ids : (r.permission_ids ? JSON.parse(r.permission_ids) : []);
      return { success: true, data: { ...r, permission_ids: permissionIds } };
    } finally {
      connection.release();
    }
  });

  fastify.post('/api/permission-templates', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { name, description, permission_ids } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      const [result] = await connection.query('INSERT INTO permission_templates (name, description, permission_ids) VALUES (?, ?, ?)', [name, description || null, JSON.stringify(permission_ids || [])]);
      return { success: true, id: result.insertId };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return reply.code(400).send({ success: false, message: '模板名称已存在，请使用其他名称' });
      }
      throw err;
    } finally {
      connection.release();
    }
  });

  fastify.put('/api/permission-templates/:id', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, permission_ids } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.query('UPDATE permission_templates SET name = ?, description = ?, permission_ids = ? WHERE id = ?', [name, description || null, JSON.stringify(permission_ids || []), id]);
      return { success: true };
    } finally {
      connection.release();
    }
  });

  fastify.delete('/api/permission-templates/:id', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      console.log(`[Permission Template] Attempting to delete template ID: ${id}`);
      const [result] = await connection.query('DELETE FROM permission_templates WHERE id = ?', [id]);
      
      if (result.affectedRows === 0) {
        console.warn(`⚠️ [Permission Template] No template found with ID: ${id}`);
        return reply.code(404).send({ success: false, message: '未找到该模板，可能已被删除' });
      }

      console.log(`✅ [Permission Template] Successfully deleted template ID: ${id}`);
      return { success: true };
    } catch (error) {
      console.error('❌ [Permission Template] Delete Error:', error);
      return reply.code(500).send({ success: false, message: '数据库操作失败' });
    } finally {
      connection.release();
    }
  });

  // 检查权限
  fastify.get('/api/check-permission', async (request, reply) => {
    try {
      const { permission } = request.query;
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) return { hasPermission: false };

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;

      const { getUserPermissions } = require('../utils/permission');
      const userPermissions = await getUserPermissions(fastify.mysql, userId);

      return { hasPermission: userPermissions.includes(permission) };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: 'Failed to check permission' });
    }
  });

  // 获取用户的详细权限信息（包括角色和部门权限）
  fastify.get('/api/users/:id/permissions-detail', async (request, reply) => {
    const { id } = request.params;
    const pool = fastify.mysql;
    try {
      // 获取用户基本信息
      const [users] = await pool.query('SELECT id, username, real_name, department_id FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return reply.code(404).send({ success: false, message: '用户不存在' });
      }
      const user = users[0];

      // 获取用户角色
      const [roles] = await pool.query(`
        SELECT r.id, r.name, r.description, r.level, r.is_system
        FROM roles r
        INNER JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY r.level DESC, r.id
      `, [id]);

      // 获取用户权限（通过角色）
      const [permissions] = await pool.query(`
        SELECT DISTINCT p.*
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY p.module, p.id
      `, [id]);

      // 获取用户个人部门权限
      let [userDepartments] = await pool.query(`
        SELECT DISTINCT d.*
        FROM departments d
        INNER JOIN user_departments ud ON d.id = ud.department_id
        WHERE ud.user_id = ?
        ORDER BY d.sort_order, d.id
      `, [id]);

      // 获取用户角色部门权限
      const [roleDepartments] = await pool.query(`
        SELECT DISTINCT d.*
        FROM departments d
        INNER JOIN role_departments rd ON d.id = rd.department_id
        INNER JOIN user_roles ur ON rd.role_id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY d.sort_order, d.id
      `, [id]);

      // 检查是否是超级管理员
      const isAdmin = roles.some(r => r.name === '超级管理员');

      // --- 逻辑修正：超级管理员视觉修正 ---
      // 如果是超级管理员，在 UI 展示时强制显示拥有所有部门权限
      if (isAdmin) {
        const [allDepts] = await pool.query('SELECT * FROM departments WHERE is_active = 1 ORDER BY sort_order, id');
        userDepartments = allDepts;
      }

      // 构建权限详情对象
      const permissionDetails = {
        user: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          department_id: user.department_id
        },
        roles: roles,
        permissions: permissions.map(p => p.code),
        permissionObjects: permissions,
        userDepartments: userDepartments,
        roleDepartments: roleDepartments,
        isAdmin: isAdmin,
        // 合并用户个人部门权限和角色部门权限，去重
        viewableDepartments: [...new Map([...userDepartments, ...roleDepartments].map(item => [item.id, item])).values()]
      };

      return { success: true, data: permissionDetails };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ success: false, error: 'Failed to fetch user permission details' });
    }
  });

  // 批量更新用户角色 (高性能原子操作)
  fastify.put('/api/users/roles/batch', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { userIds, roleIds } = request.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return reply.code(400).send({ success: false, message: '请选择目标用户' });
    }

    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // 1. 批量删除旧角色关系
      await connection.query('DELETE FROM user_roles WHERE user_id IN (?)', [userIds]);

      // 2. 如果提供了新角色，批量插入
      if (roleIds && roleIds.length > 0) {
        const values = [];
        userIds.forEach(uid => {
          roleIds.forEach(rid => {
            values.push([uid, rid]);
          });
        });

        if (values.length > 0) {
          await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES ?', [values]);

          // 获取被授予的角色名称，检查是否包含管理类关键词
          const [roles] = await connection.query('SELECT name FROM roles WHERE id IN (?)', [roleIds]);
          const managementKeywords = ['主管', '负责人', '组长', '经理', '部长', '总监', '超级管理员'];
          const hasSpecialRole = roles.some(r => managementKeywords.some(kw => r.name.includes(kw)));

          if (hasSpecialRole) {
            // 获取用户的 department_id，过滤掉没有部门的用户
            const [users] = await connection.query('SELECT id, department_id FROM users WHERE id IN (?) AND department_id IS NOT NULL', [userIds]);
            if (users.length > 0) {
              // 增量同步：使用 INSERT IGNORE 仅补全缺失的部门权限
              const deptValues = users.map(u => [u.id, u.department_id]);
              await connection.query('INSERT IGNORE INTO user_departments (user_id, department_id) VALUES ?', [deptValues]);
              console.log(`📡 [Permission] 已为管理类用户 [${userIds.join(',')}] 补全所属部门可见权限`);
            }
          }
        }
      }

      await connection.commit();

      // 3. 🔴 关键优化：批量清理 Redis 缓存并推送实时通知
      if (fastify.redis) {
        const pipeline = fastify.redis.pipeline();
        userIds.forEach(uid => {
          pipeline.del(`user:permissions:${uid}`);
          pipeline.del(`user:identity:${uid}`);
        });
        await pipeline.exec();
      }

      // 4. WebSocket 广播（静默刷新指令）
      if (fastify.io) {
        userIds.forEach(uid => {
          fastify.io.to(`user_${uid}`).emit('permissions_updated', { message: '您的权限已由管理员更新' });
        });
      }

      return { success: true, message: `成功处理 ${userIds.length} 名用户的角色变更` };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // Get users assigned to a role
  fastify.get('/api/roles/:id/users', {
    preHandler: requirePermission('system:role:view')
  }, async (request, reply) => {
    const { id } = request.params;
    const connection = await fastify.mysql.getConnection();
    try {
      const [users] = await connection.query(`
        SELECT u.id, u.username, u.real_name, u.email, u.phone, u.status, u.department_id, d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        INNER JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.role_id = ?
        ORDER BY u.real_name
      `, [id]);

      return { success: true, data: users };
    } finally {
      connection.release();
    }
  });

  // Update users assigned to a role (batch update)
  fastify.put('/api/roles/:id/users', {
    preHandler: requirePermission('system:role:manage')
  }, async (request, reply) => {
    const { id } = request.params;  // role id
    const { userIds } = request.body;  // array of user ids
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      // Delete existing user-role assignments for this role
      await connection.query('DELETE FROM user_roles WHERE role_id = ?', [id]);

      // Insert new user-role assignments
      if (userIds && userIds.length > 0) {
        const values = userIds.map(uid => [uid, id]);
        await connection.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      return { success: true, message: '角色用户分配更新成功' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

};

module.exports = permissionRoutes;
