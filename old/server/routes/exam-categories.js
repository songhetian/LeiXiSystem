const jwt = require('jsonwebtoken')
const ExcelJS = require('exceljs')
const { extractUserPermissions } = require('../middleware/checkPermission')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // ========== 辅助函数 ==========

  function requireAuth(request, reply) {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      reply.code(401).send({ success: false, message: '未提供认证令牌' })
      return null
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      return decoded
    } catch (e) {
      reply.code(401).send({ success: false, message: '无效的认证令牌' })
      return null
    }
  }

  async function requireRole(request, reply, roles) {
    const permissions = await extractUserPermissions(request, pool)
    if (!permissions) {
      reply.code(401).send({ success: false, message: '未提供认证令牌' })
      return null
    }
    const hasRole = permissions.roles?.some(r => roles.includes(r.name))
    if (!hasRole) {
      reply.code(403).send({ success: false, message: '无权限执行该操作' })
      return null
    }
    return permissions
  }

  async function logOperation(categoryId, operatorId, op, detail) {
    try {
      await pool.query(
        'INSERT INTO exam_category_audit_logs (category_id, operator_id, operation, detail) VALUES (?,?,?,?)',
        [categoryId || null, operatorId || null, op, typeof detail === 'string' ? detail : JSON.stringify(detail || {})]
      )
    } catch { }
  }

  /**
   * 递归构建分类树
   * @param {Array} flatList - 扁平化的分类列表
   * @param {number|null} parentId - 父级ID
   * @returns {Array} 树形结构
   */
  function buildTree(flatList, parentId = null) {
    return flatList
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        ...item,
        children: buildTree(flatList, item.id)
      }))
      .sort((a, b) => a.order_num - b.order_num)
  }

  // ========== API 路由 ==========

  /**
   * 获取分类树
   * GET /api/exam-categories/tree
   */
  fastify.get('/api/exam-categories/tree', async (request, reply) => {
    try {
      const permissions = await extractUserPermissions(request, pool)
      if (!permissions) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      const { include_deleted = false, parent_id } = request.query

      let where = include_deleted === 'true' || include_deleted === true
        ? '1=1'
        : "status != 'deleted'"

      if (parent_id) {
        where += ` AND parent_id = ${parseInt(parent_id)}`
      }

      const [rows] = await pool.query(
        `SELECT id, parent_id, name, description, path, level, order_num, status, created_by, created_at, updated_at
         FROM exam_categories
         WHERE ${where}
         ORDER BY order_num ASC, id ASC`
      )

      // 构建树形结构
      const tree = parent_id ? rows : buildTree(rows)

      return { success: true, data: tree }
    } catch (error) {
      console.error('获取分类树失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 获取分类列表（扁平）
   * GET /api/exam-categories
   */
  fastify.get('/api/exam-categories', async (request, reply) => {
    try {
      const permissions = await extractUserPermissions(request, pool)
      if (!permissions) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      const { page = 1, pageSize = 50, keyword = '', include_deleted = false } = request.query
      const offset = (parseInt(page) - 1) * parseInt(pageSize)

      let where = include_deleted === 'true' || include_deleted === true ? '1=1' : "status != 'deleted'"
      const params = []

      if (keyword) {
        where += ' AND name LIKE ?'
        params.push(`%${keyword}%`)
      }

      const [rows] = await pool.query(
        `SELECT * FROM exam_categories WHERE ${where} ORDER BY order_num ASC, id ASC LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize), offset]
      )

      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM exam_categories WHERE ${where}`,
        params
      )

      return {
        success: true,
        data: rows,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total
      }
    } catch (error) {
      console.error('获取分类列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 创建分类
   * POST /api/exam-categories
   */
  fastify.post('/api/exam-categories', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员', '系统管理员', '培训师', '客服主管', '考试管理员'])
    if (!permissions) return

    try {
      let { name, parent_id = null, description = '', weight = 0 } = request.body

      if (!name) {
        return reply.code(400).send({ success: false, message: '缺少必填字段：name' })
      }

      // 计算层级和路径
      let level = 1
      let path = '/'
      if (parent_id) {
        const [pRows] = await pool.query('SELECT id, path, level FROM exam_categories WHERE id = ? AND status != "deleted"', [parent_id])
        if (!pRows.length) {
          return reply.code(400).send({ success: false, message: '父级分类不存在或已删除' })
        }
        level = pRows[0].level + 1
        path = `${pRows[0].path}${parent_id}/`
      }

      // 获取同级最大排序号
      const [[{ maxOrder }]] = await pool.query(
        'SELECT COALESCE(MAX(order_num),0) as maxOrder FROM exam_categories WHERE parent_id <=> ? AND status != "deleted"',
        [parent_id]
      )
      const order_num = (maxOrder || 0) + 1

      // 插入新分类
      const [res] = await pool.query(
        `INSERT INTO exam_categories
         (parent_id, name, description, path, level, order_num, weight, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [parent_id || null, name, description || null, path, level, order_num, parseFloat(weight) || 0, 'active', permissions.userId]
      )

      await logOperation(res.insertId, permissions.userId, 'create', { name })

      return { success: true, message: '创建成功', data: { id: res.insertId } }
    } catch (error) {
      console.error('创建分类失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 更新分类
   * PUT /api/exam-categories/:id
   */
  fastify.put('/api/exam-categories/:id', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员', '系统管理员', '培训师', '客服主管', '考试管理员'])
    if (!permissions) return

    try {
      const { id } = request.params
      const { name, description, weight } = request.body

      const [rows] = await pool.query('SELECT * FROM exam_categories WHERE id = ? AND status != "deleted"', [id])
      if (!rows.length) {
        return reply.code(404).send({ success: false, message: '分类不存在或已删除' })
      }

      const fields = []
      const values = []

      if (name !== undefined) { fields.push('name = ?'); values.push(name) }
      if (description !== undefined) { fields.push('description = ?'); values.push(description || null) }
      if (weight !== undefined) { fields.push('weight = ?'); values.push(parseFloat(weight) || 0) }

      if (fields.length === 0) {
        return reply.code(400).send({ success: false, message: '没有要更新的字段' })
      }

      fields.push('updated_at = NOW()')
      values.push(id)

      await pool.query(`UPDATE exam_categories SET ${fields.join(', ')} WHERE id = ?`, values)
      await logOperation(id, permissions.userId, 'update', { name })

      return { success: true, message: '更新成功' }
    } catch (error) {
      console.error('更新分类失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 拖拽排序
   * PUT /api/exam-categories/reorder
   */
  fastify.put('/api/exam-categories/reorder', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员', '系统管理员', '培训师', '客服主管', '考试管理员'])
    if (!permissions) return

    try {
      const { moves } = request.body
      if (!Array.isArray(moves) || !moves.length) {
        return reply.code(400).send({ success: false, message: '缺少移动指令' })
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        for (const m of moves) {
          const { id, parent_id, order_num } = m

          const [curRows] = await connection.query('SELECT id, parent_id, path, level FROM exam_categories WHERE id = ? AND status != "deleted"', [id])
          if (!curRows.length) continue

          const oldParent = curRows[0].parent_id
          let nextParent = parent_id
          let nextLevel = 1
          let nextPath = '/'

          if (parent_id) {
            const [pRows] = await connection.query('SELECT id, path, level FROM exam_categories WHERE id = ? AND status != "deleted"', [parent_id])
            if (!pRows.length) throw new Error('父级不存在')
            nextLevel = pRows[0].level + 1
            nextPath = `${pRows[0].path}${parent_id}/`
          }

          // 更新当前节点
          await connection.query(
            'UPDATE exam_categories SET parent_id = ?, level = ?, path = ?, order_num = ?, updated_at = NOW() WHERE id = ?',
            [nextParent || null, nextLevel, nextPath, parseInt(order_num) || 1, id]
          )

          // 更新所有子节点的 path 和 level
          const [childRows] = await connection.query('SELECT id, path FROM exam_categories WHERE path LIKE ?', [`${curRows[0].path}${curRows[0].id}/%`])
          for (const c of childRows) {
            const newChildPath = c.path.replace(`${curRows[0].path}${curRows[0].id}/`, `${nextPath}${id}/`)
            const newChildLevel = (newChildPath.match(/\//g) || []).length
            await connection.query('UPDATE exam_categories SET path = ?, level = ? WHERE id = ?', [newChildPath, newChildLevel, c.id])
          }
        }

        await connection.commit()
      } catch (e) {
        await connection.rollback()
        throw e
      } finally {
        connection.release()
      }

      await logOperation(null, permissions.userId, 'reorder', { movesCount: moves.length })
      return { success: true, message: '排序更新成功' }
    } catch (error) {
      console.error('排序更新失败:', error)
      return reply.code(500).send({ success: false, message: '排序更新失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 软删除分类
   * DELETE /api/exam-categories/:id
   */
  fastify.delete('/api/exam-categories/:id', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员', '系统管理员', '培训师', '客服主管', '考试管理员'])
    if (!permissions) return

    try {
      const { id } = request.params
      const { cascade = false } = request.query

      const [rows] = await pool.query('SELECT * FROM exam_categories WHERE id = ? AND status != "deleted"', [id])
      if (!rows.length) {
        return reply.code(404).send({ success: false, message: '分类不存在或已被删除' })
      }

      const [childCountRows] = await pool.query('SELECT COUNT(*) as cnt FROM exam_categories WHERE parent_id = ? AND status != "deleted"', [id])
      const hasChildren = childCountRows[0].cnt > 0

      if (hasChildren && !['true', true, '1', 1].includes(cascade)) {
        return reply.code(400).send({ success: false, message: '存在子分类，不能删除（请使用级联删除）' })
      }

      const now = new Date()
      if (hasChildren) {
        await pool.query(
          "UPDATE exam_categories SET status = 'deleted', deleted_at = ?, deleted_by = ? WHERE path LIKE ?",
          [now, permissions.userId, `%/${id}/%`]
        )
      }

      await pool.query(
        "UPDATE exam_categories SET status = 'deleted', deleted_at = ?, deleted_by = ? WHERE id = ?",
        [now, permissions.userId, id]
      )

      await logOperation(id, permissions.userId, 'soft_delete', { cascade: !!cascade })
      return { success: true, message: '删除成功' }
    } catch (error) {
      console.error('删除分类失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 回收站列表
   * GET /api/exam-categories/recycle-bin
   */
  fastify.get('/api/exam-categories/recycle-bin', async (request, reply) => {
    try {
      const permissions = await extractUserPermissions(request, pool)
      if (!permissions) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      const { page = 1, pageSize = 50, keyword = '' } = request.query
      const offset = (parseInt(page) - 1) * parseInt(pageSize)

      let where = "c.status = 'deleted'"
      const params = []

      if (keyword) {
        where += ' AND c.name LIKE ?'
        params.push(`%${keyword}%`)
      }

      const [rows] = await pool.query(
        `SELECT c.*, u.real_name as deleted_by_name
         FROM exam_categories c
         LEFT JOIN users u ON c.deleted_by = u.id
         WHERE ${where}
         ORDER BY c.deleted_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize), offset]
      )

      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM exam_categories c WHERE ${where}`,
        params
      )

      return {
        success: true,
        data: rows,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total
      }
    } catch (error) {
      console.error('获取回收站列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 恢复分类
   * PUT /api/exam-categories/:id/restore
   */
  fastify.put('/api/exam-categories/:id/restore', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员', '系统管理员', '培训师', '客服主管', '考试管理员'])
    if (!permissions) return

    try {
      const { id } = request.params
      const { cascade = false } = request.body

      const [rows] = await pool.query('SELECT * FROM exam_categories WHERE id = ? AND status = "deleted"', [id])
      if (!rows.length) {
        return reply.code(404).send({ success: false, message: '分类不存在或未被删除' })
      }

      if (cascade) {
        await pool.query(
          "UPDATE exam_categories SET status = 'active', deleted_at = NULL, deleted_by = NULL WHERE path LIKE ?",
          [`%/${id}/%`]
        )
      }

      await pool.query(
        "UPDATE exam_categories SET status = 'active', deleted_at = NULL, deleted_by = NULL WHERE id = ?",
        [id]
      )

      await logOperation(id, permissions.userId, 'restore', { cascade: !!cascade })
      return { success: true, message: '恢复成功' }
    } catch (error) {
      console.error('恢复分类失败:', error)
      return reply.code(500).send({ success: false, message: '恢复失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 永久删除
   * DELETE /api/exam-categories/:id/permanent
   */
  fastify.delete('/api/exam-categories/:id/permanent', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员'])
    if (!permissions) return

    try {
      const { id } = request.params
      const { cascade = false } = request.query

      const [rows] = await pool.query('SELECT * FROM exam_categories WHERE id = ?', [id])
      if (!rows.length) {
        return reply.code(404).send({ success: false, message: '分类不存在' })
      }

      const [childCountRows] = await pool.query('SELECT COUNT(*) as cnt FROM exam_categories WHERE parent_id = ?', [id])
      const hasChildren = childCountRows[0].cnt > 0

      if (hasChildren && !['true', true, '1', 1].includes(cascade)) {
        return reply.code(400).send({ success: false, message: '存在子分类，不能永久删除（请使用级联删除）' })
      }

      if (hasChildren) {
        await pool.query("DELETE FROM exam_categories WHERE path LIKE ?", [`%/${id}/%`])
      }
      await pool.query("DELETE FROM exam_categories WHERE id = ?", [id])

      await logOperation(id, permissions.userId, 'permanent_delete', { cascade: !!cascade })
      return { success: true, message: '永久删除成功' }
    } catch (error) {
      console.error('永久删除失败:', error)
      return reply.code(500).send({ success: false, message: '永久删除失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  /**
   * 批量操作
   * POST /api/exam-categories/batch
   */
  fastify.post('/api/exam-categories/batch', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员', '系统管理员', '培训师', '客服主管', '考试管理员'])
    if (!permissions) return

    try {
      const { action, ids } = request.body

      if (!action || !Array.isArray(ids) || ids.length === 0) {
        return reply.code(400).send({ success: false, message: '缺少必要参数' })
      }

      const validActions = ['delete', 'restore', 'permanent_delete']
      if (!validActions.includes(action)) {
        return reply.code(400).send({ success: false, message: '无效的操作类型' })
      }

      // 永久删除需要超级管理员权限
      if (action === 'permanent_delete') {
        const isSuperAdmin = permissions.roles?.some(r => r.name === '超级管理员')
        if (!isSuperAdmin) {
          return reply.code(403).send({ success: false, message: '仅超级管理员可执行永久删除' })
        }
      }

      let successCount = 0
      const errors = []

      for (const id of ids) {
        try {
          if (action === 'delete') {
            const now = new Date()
            await pool.query(
              "UPDATE exam_categories SET status = 'deleted', deleted_at = ?, deleted_by = ? WHERE id = ?",
              [now, permissions.userId, id]
            )
          } else if (action === 'restore') {
            await pool.query(
              "UPDATE exam_categories SET status = 'active', deleted_at = NULL, deleted_by = NULL WHERE id = ?",
              [id]
            )
          } else if (action === 'permanent_delete') {
            await pool.query("DELETE FROM exam_categories WHERE id = ?", [id])
          }
          successCount++
        } catch (err) {
          errors.push({ id, error: err.message })
        }
      }

      await logOperation(null, permissions.userId, `batch_${action}`, { count: successCount, errors })

      return {
        success: true,
        message: `批量操作完成，成功 ${successCount} 个`,
        data: { successCount, errors }
      }
    } catch (error) {
      console.error('批量操作失败:', error)
      return reply.code(500).send({ success: false, message: '批量操作失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })


}
