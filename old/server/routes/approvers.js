/**
 * 审批人管理 API 路由
 *
 * 端点：
 * - GET /api/approvers - 获取审批人列表
 * - POST /api/approvers - 添加审批人
 * - PUT /api/approvers/:id - 更新审批人配置
 * - DELETE /api/approvers/:id - 删除审批人
 * - POST /api/approvers/:id/delegate - 设置代理人
 */

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // ============================================================
  // 获取审批人列表
  // ============================================================
  fastify.get('/api/approvers', async (request, reply) => {
    const { approver_type, is_active } = request.query

    try {
      let query = `
        SELECT a.*,
               u.real_name as user_name,
               u.username,
               d.real_name as delegate_user_name
        FROM approvers a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN users d ON a.delegate_user_id = d.id
        WHERE 1=1
      `
      const params = []

      if (approver_type) {
        query += ' AND a.approver_type = ?'
        params.push(approver_type)
      }

      if (is_active !== undefined) {
        query += ' AND a.is_active = ?'
        params.push(is_active === 'true' || is_active === '1' ? 1 : 0)
      }

      query += ' ORDER BY a.approver_type, a.id'

      const [approvers] = await pool.query(query, params)

      // 解析 JSON 字段
      const result = approvers.map(a => ({
        ...a,
        department_scope: a.department_scope
          ? (typeof a.department_scope === 'string' ? JSON.parse(a.department_scope) : a.department_scope)
          : null,
        business_types: a.business_types
          ? (typeof a.business_types === 'string' ? JSON.parse(a.business_types) : a.business_types)
          : null
      }))

      return { success: true, data: result }
    } catch (error) {
      console.error('获取审批人列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
  // 添加审批人
  // ============================================================
  fastify.post('/api/approvers', async (request, reply) => {
    const {
      user_id,
      approver_type,
      department_scope,
      amount_min,
      amount_limit,
      business_types
    } = request.body

    if (!user_id || !approver_type) {
      return reply.code(400).send({ success: false, message: '用户ID和审批人类型为必填' })
    }

    try {
      // 检查是否已存在
      const [existing] = await pool.query(
        'SELECT id FROM approvers WHERE user_id = ? AND approver_type = ?',
        [user_id, approver_type]
      )

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '该用户已配置为此类型审批人' })
      }

      const [result] = await pool.query(
        `INSERT INTO approvers
         (user_id, approver_type, department_scope, amount_min, amount_limit, business_types, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          user_id,
          approver_type,
          department_scope ? JSON.stringify(department_scope) : null,
          amount_min || 0,
          amount_limit || null,
          business_types ? JSON.stringify(business_types) : null
        ]
      )

      return {
        success: true,
        message: '添加成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('添加审批人失败:', error)
      return reply.code(500).send({ success: false, message: '添加失败' })
    }
  })

  // ============================================================
  // 更新审批人配置
  // ============================================================
  fastify.put('/api/approvers/:id', async (request, reply) => {
    const { id } = request.params
    const { department_scope, amount_min, amount_limit, business_types, is_active } = request.body

    try {
      const [existing] = await pool.query(
        'SELECT * FROM approvers WHERE id = ?',
        [id]
      )

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '审批人配置不存在' })
      }

      await pool.query(
        `UPDATE approvers
         SET department_scope = ?, amount_min = ?, amount_limit = ?, business_types = ?, is_active = ?
         WHERE id = ?`,
        [
          department_scope ? JSON.stringify(department_scope) : null,
          amount_min !== undefined ? amount_min : existing[0].amount_min,
          amount_limit || null,
          business_types ? JSON.stringify(business_types) : null,
          is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active,
          id
        ]
      )

      return { success: true, message: '更新成功' }
    } catch (error) {
      console.error('更新审批人配置失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // ============================================================
  // 删除审批人
  // ============================================================
  fastify.delete('/api/approvers/:id', async (request, reply) => {
    const { id } = request.params

    try {
      const [existing] = await pool.query(
        'SELECT * FROM approvers WHERE id = ?',
        [id]
      )

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '审批人配置不存在' })
      }

      await pool.query('DELETE FROM approvers WHERE id = ?', [id])

      return { success: true, message: '删除成功' }
    } catch (error) {
      console.error('删除审批人失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // ============================================================
  // 设置代理人
  // ============================================================
  fastify.post('/api/approvers/:id/delegate', async (request, reply) => {
    const { id } = request.params
    const { delegate_user_id, delegate_start_date, delegate_end_date } = request.body

    try {
      const [existing] = await pool.query(
        'SELECT * FROM approvers WHERE id = ?',
        [id]
      )

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '审批人配置不存在' })
      }

      // 验证日期
      if (delegate_user_id) {
        if (!delegate_start_date || !delegate_end_date) {
          return reply.code(400).send({ success: false, message: '代理开始和结束日期为必填' })
        }

        if (new Date(delegate_start_date) > new Date(delegate_end_date)) {
          return reply.code(400).send({ success: false, message: '开始日期不能晚于结束日期' })
        }

        // 检查代理人是否有效
        const [delegateUser] = await pool.query(
          'SELECT id FROM users WHERE id = ? AND status = "active"',
          [delegate_user_id]
        )

        if (delegateUser.length === 0) {
          return reply.code(400).send({ success: false, message: '代理人不存在或已禁用' })
        }
      }

      await pool.query(
        `UPDATE approvers
         SET delegate_user_id = ?, delegate_start_date = ?, delegate_end_date = ?
         WHERE id = ?`,
        [
          delegate_user_id || null,
          delegate_start_date || null,
          delegate_end_date || null,
          id
        ]
      )

      return {
        success: true,
        message: delegate_user_id ? '代理人设置成功' : '已取消代理'
      }
    } catch (error) {
      console.error('设置代理人失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // ============================================================
  // 获取可选的审批人用户列表（用于配置时选择）
  // ============================================================
  fastify.get('/api/approvers/available-users', async (request, reply) => {
    const { department_id, keyword } = request.query

    try {
      let query = `
        SELECT u.id, u.username, u.real_name, u.department_id, d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.status = 'active'
      `
      const params = []

      if (department_id) {
        query += ' AND u.department_id = ?'
        params.push(department_id)
      }

      if (keyword) {
        query += ' AND (u.username LIKE ? OR u.real_name LIKE ?)'
        params.push(`%${keyword}%`, `%${keyword}%`)
      }

      query += ' ORDER BY u.real_name LIMIT 50'

      const [users] = await pool.query(query, params)

      return { success: true, data: users }
    } catch (error) {
      console.error('获取可选用户列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
// 获取可选的角色列表（用于配置时选择）
// ============================================================
  fastify.get('/api/approvers/available-roles', async (request, reply) => {
    try {
      const [roles] = await pool.query(
        'SELECT id, name, description FROM roles ORDER BY level DESC, name'
      )

      return { success: true, data: roles }
    } catch (error) {
      console.error('获取角色列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
// 获取角色的审批流程配置
// ============================================================
  fastify.get('/api/approvers/roles/workflows', async (request, reply) => {
    try {
      const [roles] = await pool.query(
        `SELECT r.id, r.name, r.description, rw.workflow_id, 
                aw.name as workflow_name, aw.status as workflow_status
         FROM roles r
         LEFT JOIN role_workflows rw ON r.id = rw.role_id
         LEFT JOIN approval_workflows aw ON rw.workflow_id = aw.id
         ORDER BY r.level DESC, r.name`
      )

      return { success: true, data: roles }
    } catch (error) {
      console.error('获取角色流程配置失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
// 更新角色的审批流程配置
// ============================================================
  fastify.put('/api/approvers/roles/:roleId/workflow', async (request, reply) => {
    const { roleId } = request.params
    const { workflow_id } = request.body

    try {
      // 验证角色是否存在
      const [role] = await pool.query(
        'SELECT id FROM roles WHERE id = ?',
        [roleId]
      )

      if (role.length === 0) {
        return reply.code(404).send({ success: false, message: '角色不存在' })
      }

      // 如果指定了workflow_id，验证流程是否存在
      if (workflow_id) {
        const [workflow] = await pool.query(
          'SELECT id FROM approval_workflows WHERE id = ?',
          [workflow_id]
        )

        if (workflow.length === 0) {
          return reply.code(404).send({ success: false, message: '审批流程不存在' })
        }
      }

      // 检查是否已存在配置
      const [existing] = await pool.query(
        'SELECT id FROM role_workflows WHERE role_id = ?',
        [roleId]
      )

      if (existing.length > 0) {
        // 更新现有配置
        if (workflow_id) {
          await pool.query(
            'UPDATE role_workflows SET workflow_id = ?, updated_at = NOW() WHERE role_id = ?',
            [workflow_id, roleId]
          )
        } else {
          // 删除配置（使用默认流程）
          await pool.query(
            'DELETE FROM role_workflows WHERE role_id = ?',
            [roleId]
          )
        }
      } else if (workflow_id) {
        // 创建新配置
        await pool.query(
          'INSERT INTO role_workflows (role_id, workflow_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          [roleId, workflow_id]
        )
      }

      return { success: true, message: '流程配置保存成功' }
    } catch (error) {
      console.error('保存角色流程配置失败:', error)
      return reply.code(500).send({ success: false, message: '保存失败' })
    }
  })
}
