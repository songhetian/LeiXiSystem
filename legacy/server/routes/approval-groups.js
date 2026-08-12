
module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 1. 获取审批组列表
  fastify.get('/api/approval-groups', async (request, reply) => {
    try {
      const [rows] = await pool.query(`
        SELECT g.*, 
               (SELECT COUNT(*) FROM special_approval_group_members WHERE group_id = g.id) as member_count
        FROM special_approval_groups g
      `)
      return { success: true, data: rows }
    } catch (err) {
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // 2. 获取审批组详情（含成员）
  fastify.get('/api/approval-groups/:id', async (request, reply) => {
    const { id } = request.params
    try {
      const [groups] = await pool.query('SELECT * FROM special_approval_groups WHERE id = ?', [id])
      if (groups.length === 0) return reply.code(404).send({ success: false, message: '组不存在' })
      
      const [members] = await pool.query(`
        SELECT m.member_type, m.member_id, 
               CASE 
                 WHEN m.member_type = 'role' THEN r.name 
                 WHEN m.member_type = 'user' THEN u.real_name 
               END as name
        FROM special_approval_group_members m
        LEFT JOIN roles r ON m.member_type = 'role' AND m.member_id = r.id
        LEFT JOIN users u ON m.member_type = 'user' AND m.member_id = u.id
        WHERE m.group_id = ?
      `, [id])
      
      return { success: true, data: { ...groups[0], members } }
    } catch (err) {
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // 3. 创建/更新审批组
  fastify.post('/api/approval-groups', async (request, reply) => {
    const { id, name, description, members = [] } = request.body
    const conn = await pool.getConnection()
    await conn.beginTransaction()
    try {
      let groupId = id
      if (id) {
        await conn.query('UPDATE special_approval_groups SET name = ?, description = ? WHERE id = ?', [name, description, id])
        await conn.query('DELETE FROM special_approval_group_members WHERE group_id = ?', [id])
      } else {
        const [res] = await conn.query('INSERT INTO special_approval_groups (name, description) VALUES (?, ?)', [name, description])
        groupId = res.insertId
      }

      if (members.length > 0) {
        const values = members.map(m => [groupId, m.member_type, m.member_id])
        await conn.query('INSERT INTO special_approval_group_members (group_id, member_type, member_id) VALUES ?', [values])
      }

      await conn.commit()
      return { success: true, id: groupId }
    } catch (err) {
      await conn.rollback()
      return reply.code(500).send({ success: false, message: err.message })
    } finally {
      conn.release()
    }
  })

  // 4. 删除审批组
  fastify.delete('/api/approval-groups/:id', async (request, reply) => {
    try {
      await pool.query('DELETE FROM special_approval_groups WHERE id = ?', [request.params.id])
      return { success: true }
    } catch (err) {
      return reply.code(500).send({ success: false, message: err.message })
    }
  })
}
