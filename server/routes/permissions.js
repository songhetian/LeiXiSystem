const permissionRoutes = async (fastify, options) => {
  // Get all roles with their permissions
  fastify.get('/api/roles', async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [roles] = await connection.query('SELECT id, name, description, level, is_system, created_at, updated_at FROM roles ORDER BY id');

      // Get permissions for each role
      for (let role of roles) {
        const [perms] = await connection.query(`
          SELECT p.*
          FROM permissions p
          JOIN role_permissions rp ON p.id = rp.permission_id
          WHERE rp.role_id = ?
        `, [role.id]);
        role.permissions = perms;
      }

      return { success: true, data: roles };
    } finally {
      connection.release();
    }
  });

  // Get all available permissions
  fastify.get('/api/permissions', async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [permissions] = await connection.query('SELECT * FROM permissions ORDER BY module, code');
      return { success: true, data: permissions };
    } finally {
      connection.release();
    }
  });

  // Create a new role
  fastify.post('/api/roles', async (request, reply) => {
    const { name, description, permissionIds } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'INSERT INTO roles (name, description) VALUES (?, ?)',
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
  fastify.put('/api/roles/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, permissionIds } = request.body;
    const connection = await fastify.mysql.getConnection();
    try {
      await connection.beginTransaction();

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

  // Get users with their roles
  fastify.get('/api/users/roles', async (request, reply) => {
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
  fastify.get('/api/users/:id/roles', async (request, reply) => {
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
  fastify.post('/api/users/:id/roles', async (request, reply) => {
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
  fastify.delete('/api/users/:id/roles/:roleId', async (request, reply) => {
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
  fastify.put('/api/users/:id/roles', async (request, reply) => {
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
      return { success: true, message: '用户角色更新成功' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // Get role permissions
  fastify.get('/api/roles/:id/permissions', async (request, reply) => {
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
  fastify.post('/api/roles/:id/permissions', async (request, reply) => {
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

  // Remove permission from role
  fastify.delete('/api/roles/:id/permissions/:permissionId', async (request, reply) => {
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
  fastify.get('/api/permissions/audit-logs', async (request, reply) => {
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
};

module.exports = permissionRoutes;
