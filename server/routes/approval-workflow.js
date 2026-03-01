/**
 * 审批流程配置 API 路由
 *
 * 端点：
 * - GET /api/approval-workflow - 获取流程列表
 * - POST /api/approval-workflow - 创建审批流程
 * - PUT /api/approval-workflow/:id - 更新审批流程
 * - DELETE /api/approval-workflow/:id - 删除审批流程
 * - GET /api/approval-workflow/:id/nodes - 获取流程节点
 * - POST /api/approval-workflow/:id/nodes - 配置流程节点
 */

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // ============================================================
  // 获取审批流程列表
  // ============================================================
  fastify.get('/api/approval-workflow', async (request, reply) => {
    const { type = 'reimbursement', status } = request.query

    try {
      let query = `
        SELECT w.*,
               u.real_name as created_by_name,
               (SELECT COUNT(*) FROM approval_workflow_nodes WHERE workflow_id = w.id) as node_count
        FROM approval_workflows w
        LEFT JOIN users u ON w.created_by = u.id
        WHERE w.type = ?
      `
      const params = [type]

      if (status) {
        query += ' AND w.status = ?'
        params.push(status)
      }

      query += ' ORDER BY w.is_default DESC, w.id ASC'

      const [workflows] = await pool.query(query, params)

      return { success: true, data: workflows }
    } catch (error) {
      console.error('获取审批流程列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
  // 获取单个审批流程详情
  // ============================================================
  fastify.get('/api/approval-workflow/:id', async (request, reply) => {
    const { id } = request.params

    try {
      const [workflows] = await pool.query(
        `SELECT w.*, u.real_name as created_by_name
         FROM approval_workflows w
         LEFT JOIN users u ON w.created_by = u.id
         WHERE w.id = ?`,
        [id]
      )

      if (workflows.length === 0) {
        return reply.code(404).send({ success: false, message: '流程不存在' })
      }

      // 获取节点
      const [nodes] = await pool.query(
        `SELECT n.*,
                u.real_name as approver_name,
                r.name as role_name
         FROM approval_workflow_nodes n
         LEFT JOIN users u ON n.approver_id = u.id
         LEFT JOIN roles r ON n.role_id = r.id
         WHERE n.workflow_id = ?
         ORDER BY n.node_order ASC`,
        [id]
      )

      return {
        success: true,
        data: {
          ...workflows[0],
          nodes
        }
      }
    } catch (error) {
      console.error('获取审批流程详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
  // 创建审批流程
  // ============================================================
  fastify.post('/api/approval-workflow', async (request, reply) => {
    const { name, type = 'reimbursement', description, is_default, conditions, created_by, nodes = [] } = request.body

    try {
      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        // 如果设为默认，取消其他默认流程
        if (is_default) {
          await connection.query(
            'UPDATE approval_workflows SET is_default = 0 WHERE type = ?',
            [type]
          )
        }

        // 插入流程
        const [result] = await connection.query(
          `INSERT INTO approval_workflows
           (name, type, description, is_default, conditions, status, created_by)
           VALUES (?, ?, ?, ?, ?, 'active', ?)`,
          [name, type, description, is_default ? 1 : 0,
           conditions ? JSON.stringify(conditions) : null, created_by]
        )
        const workflowId = result.insertId

        // 插入节点
        if (nodes.length > 0) {
          const nodeValues = nodes.map((node, index) => [
            workflowId,
            index + 1,
            node.node_name,
            node.approver_type,
            node.approver_id || null,
            node.role_id || null,
            node.custom_type_name || null,
            node.approval_mode || 'serial',
            node.can_skip ? 1 : 0,
            node.skip_conditions ? JSON.stringify(node.skip_conditions) : null
          ])
          await connection.query(
            `INSERT INTO approval_workflow_nodes
             (workflow_id, node_order, node_name, approver_type, approver_id, role_id, custom_type_name, approval_mode, can_skip, skip_conditions)
             VALUES ?`,
            [nodeValues]
          )
        }

        await connection.commit()
        connection.release()

        return {
          success: true,
          message: '创建成功',
          data: { id: workflowId }
        }
      } catch (error) {
        await connection.rollback()
        connection.release()
        throw error
      }
    } catch (error) {
      console.error('创建审批流程失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败: ' + error.message })
    }
  })

  // ============================================================
  // 更新审批流程
  // ============================================================
  fastify.put('/api/approval-workflow/:id', async (request, reply) => {
    const { id } = request.params
    const { name, description, is_default, conditions, status } = request.body

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      const [existing] = await connection.query(
        'SELECT * FROM approval_workflows WHERE id = ? FOR UPDATE',
        [id]
      )

      if (existing.length === 0) {
        await connection.rollback()
        connection.release()
        return reply.code(404).send({ success: false, message: '流程不存在' })
      }

      const workflow = existing[0]

      // 如果设为默认，取消其他默认流程
      if (is_default && !workflow.is_default) {
        await connection.query(
          'UPDATE approval_workflows SET is_default = 0 WHERE type = ? AND id != ?',
          [workflow.type, id]
        )
      }

      await connection.query(
        `UPDATE approval_workflows
         SET name = ?, description = ?, is_default = ?, conditions = ?, status = ?
         WHERE id = ?`,
        [name, description, is_default ? 1 : 0,
         conditions ? (typeof conditions === 'string' ? conditions : JSON.stringify(conditions)) : null, 
         status || 'active', id]
      )

      await connection.commit()
      connection.release()
      return { success: true, message: '更新成功' }
    } catch (error) {
      await connection.rollback()
      connection.release()
      console.error('更新审批流程失败:', error)
      return reply.code(500).send({ 
        success: false, 
        message: '更新失败: ' + error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      })
    }
  })

  // ============================================================
  // 删除审批流程
  // ============================================================
  fastify.delete('/api/approval-workflow/:id', async (request, reply) => {
    const { id } = request.params

    try {
      const [existing] = await pool.query(
        'SELECT is_default FROM approval_workflows WHERE id = ?',
        [id]
      )

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '流程不存在' })
      }

      if (existing[0].is_default) {
        return reply.code(400).send({ success: false, message: '不能删除默认流程' })
      }

      // 检查是否有在使用的报销单
      const [using] = await pool.query(
        'SELECT COUNT(*) as count FROM reimbursements WHERE workflow_id = ? AND status = "approving"',
        [id]
      )

      if (using[0].count > 0) {
        return reply.code(400).send({ success: false, message: '该流程正在被使用中，无法删除' })
      }

      await pool.query('DELETE FROM approval_workflows WHERE id = ?', [id])

      return { success: true, message: '删除成功' }
    } catch (error) {
      console.error('删除审批流程失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // ============================================================
  // 获取流程节点
  // ============================================================
  fastify.get('/api/approval-workflow/:id/nodes', async (request, reply) => {
    const { id } = request.params

    try {
      const [nodes] = await pool.query(
        `SELECT n.*,
                u.real_name as approver_name,
                r.name as role_name
         FROM approval_workflow_nodes n
         LEFT JOIN users u ON n.approver_id = u.id
         LEFT JOIN roles r ON n.role_id = r.id
         WHERE n.workflow_id = ?
         ORDER BY n.node_order ASC`,
        [id]
      )

      return { success: true, data: nodes }
    } catch (error) {
      console.error('获取流程节点失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // ============================================================
  // 配置流程节点（批量更新）
  // ============================================================
  fastify.post('/api/approval-workflow/:id/nodes', async (request, reply) => {
    const { id } = request.params
    const { nodes = [] } = request.body

    try {
      const connection = await pool.getConnection()
      await connection.beginTransaction()

      try {
        // 删除旧节点
        await connection.query(
          'DELETE FROM approval_workflow_nodes WHERE workflow_id = ?',
          [id]
        )

        // 插入新节点
        if (nodes.length > 0) {
          const nodeValues = nodes.map((node, index) => [
            id,
            index + 1,
            node.node_name,
            node.approver_type,
            node.approver_id || null,
            node.role_id || null,
            node.custom_type_name || null,
            node.approval_mode || 'serial',
            node.can_skip ? 1 : 0,
            node.skip_conditions ? JSON.stringify(node.skip_conditions) : null
          ])
          await connection.query(
            `INSERT INTO approval_workflow_nodes
             (workflow_id, node_order, node_name, approver_type, approver_id, role_id, custom_type_name, approval_mode, can_skip, skip_conditions)
             VALUES ?`,
            [nodeValues]
          )
        }

        await connection.commit()
        connection.release()

        return { success: true, message: '节点配置成功' }
      } catch (error) {
        await connection.rollback()
        connection.release()
        throw error
      }
    } catch (error) {
      console.error('配置流程节点失败:', error)
      return reply.code(500).send({ success: false, message: '配置失败' })
    }
  })
}
