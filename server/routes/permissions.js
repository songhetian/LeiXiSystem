const permissionRoutes = async (fastify, options) => {
  // Get all roles with their permissions
  fastify.get('/api/roles', async (request, reply) => {
    const connection = await fastify.mysql.getConnection();
    try {
      const [roles] = await connection.query('SELECT * FROM roles ORDER BY id');

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
          SELECT r.*
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

  // Update user roles
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
