/**
 * 报销设置 API 路由
 * 管理报销类型和费用类型
 */

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // ============================================================
  // 报销类型 API (Reimbursement Types)
  // ============================================================

  // 获取报销类型列表
  fastify.get('/api/reimbursement/types', async (request, reply) => {
    const { activeOnly } = request.query
    try {
      let query = 'SELECT * FROM reimbursement_types'
      const params = []
      
      if (activeOnly === 'true' || activeOnly === '1') {
        query += ' WHERE is_active = 1'
      }
      
      query += ' ORDER BY sort_order ASC, id ASC'
      
      const [rows] = await pool.query(query, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('获取报销类型失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 添加报销类型
  fastify.post('/api/reimbursement/types', async (request, reply) => {
    const { name, code, description, sort_order } = request.body
    try {
      const [result] = await pool.query(
        'INSERT INTO reimbursement_types (name, code, description, sort_order) VALUES (?, ?, ?, ?)',
        [name, code || null, description || null, sort_order || 0]
      )
      return { success: true, id: result.insertId }
    } catch (error) {
      console.error('添加报销类型失败:', error)
      return reply.code(500).send({ success: false, message: '添加失败' })
    }
  })

  // 更新报销类型
  fastify.put('/api/reimbursement/types/:id', async (request, reply) => {
    const { id } = request.params
    const { name, code, description, sort_order, is_active } = request.body
    try {
      await pool.query(
        'UPDATE reimbursement_types SET name=?, code=?, description=?, sort_order=?, is_active=? WHERE id=?',
        [name, code, description, sort_order, is_active, id]
      )
      return { success: true }
    } catch (error) {
      console.error('更新报销类型失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除报销类型
  fastify.delete('/api/reimbursement/types/:id', async (request, reply) => {
    const { id } = request.params
    try {
      await pool.query('DELETE FROM reimbursement_types WHERE id=?', [id])
      return { success: true }
    } catch (error) {
      console.error('删除报销类型失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // ============================================================
  // 费用类型 API (Expense Types)
  // ============================================================

  // 获取费用类型列表
  fastify.get('/api/reimbursement/expense-types', async (request, reply) => {
    const { activeOnly } = request.query
    try {
      let query = 'SELECT * FROM expense_types'
      if (activeOnly === 'true' || activeOnly === '1') {
        query += ' WHERE is_active = 1'
      }
      query += ' ORDER BY sort_order ASC, id ASC'
      
      const [rows] = await pool.query(query, params = [])
      return { success: true, data: rows }
    } catch (error) {
      console.error('获取费用类型失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 添加费用类型
  fastify.post('/api/reimbursement/expense-types', async (request, reply) => {
    const { name, unit, sort_order } = request.body
    try {
      const [result] = await pool.query(
        'INSERT INTO expense_types (name, unit, sort_order) VALUES (?, ?, ?)',
        [name, unit || null, sort_order || 0]
      )
      return { success: true, id: result.insertId }
    } catch (error) {
      console.error('添加费用类型失败:', error)
      return reply.code(500).send({ success: false, message: '添加失败' })
    }
  })

  // 更新费用类型
  fastify.put('/api/reimbursement/expense-types/:id', async (request, reply) => {
    const { id } = request.params
    const { name, unit, sort_order, is_active } = request.body
    try {
      await pool.query(
        'UPDATE expense_types SET name=?, unit=?, sort_order=?, is_active=? WHERE id=?',
        [name, unit, sort_order, is_active, id]
      )
      return { success: true }
    } catch (error) {
      console.error('更新费用类型失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除费用类型
  fastify.delete('/api/reimbursement/expense-types/:id', async (request, reply) => {
    const { id } = request.params
    try {
      await pool.query('DELETE FROM expense_types WHERE id=?', [id])
      return { success: true }
    } catch (error) {
      console.error('删除费用类型失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
