const jwt = require('jsonwebtoken')
const ExcelJS = require('exceljs')
const { extractUserPermissions } = require('../middleware/checkPermission')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  async function ensureTables() {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.query(`CREATE TABLE IF NOT EXISTS exam_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_id INT NULL,
        name VARCHAR(200) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        weight DECIMAL(8,2) NOT NULL DEFAULT 0,
        status ENUM('active','inactive','deleted') NOT NULL DEFAULT 'active',
        order_num INT NOT NULL DEFAULT 1,
        path VARCHAR(1024) NOT NULL DEFAULT '/',
        level INT NOT NULL DEFAULT 1,
        description TEXT NULL,
        created_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT NOW(),
        updated_at DATETIME NOT NULL DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await connection.query(`CREATE TABLE IF NOT EXISTS exam_category_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NULL,
        operator_id INT NULL,
        operation VARCHAR(64) NOT NULL,
        detail TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      try { await connection.query('ALTER TABLE exam_categories ADD INDEX idx_parent_id (parent_id)') } catch {}
      try { await connection.query('ALTER TABLE exam_categories ADD INDEX idx_status (status)') } catch {}
      try { await connection.query('ALTER TABLE exam_categories ADD INDEX idx_path (path)') } catch {}
      await connection.commit()
    } catch (e) {
      await connection.rollback()
      throw e
    } finally {
      connection.release()
    }
  }

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

  async function logOperation(categoryId, operatorId, op, detail) {
    try {
      await pool.query(
        'INSERT INTO exam_category_audit_logs (category_id, operator_id, operation, detail) VALUES (?,?,?,?)',
        [categoryId || null, operatorId || null, op, typeof detail === 'string' ? detail : JSON.stringify(detail || {})]
      )
    } catch {}
  }

  await ensureTables()

  function hasAnyRole(permissions, roleNames = []) {
    if (!permissions || !Array.isArray(permissions.roles)) return false
    const names = new Set(roleNames)
    return permissions.roles.some(r => names.has(r.name))
  }

  async function requireRole(request, reply, roles) {
    const permissions = await extractUserPermissions(request, pool)
    if (!permissions) {
      reply.code(401).send({ success: false, message: '未提供认证令牌' })
      return null
    }
    if (!hasAnyRole(permissions, roles)) {
      reply.code(403).send({ success: false, message: '无权限执行该操作' })
      return null
    }
    return permissions
  }

  async function recalcAncestorsWeight(connection, parentId) {
    let currentId = parentId
    while (currentId) {
      const [[{ total }]] = await connection.query('SELECT COALESCE(SUM(weight),0) AS total FROM exam_categories WHERE parent_id = ? AND status != "deleted"', [currentId])
      await connection.query('UPDATE exam_categories SET weight = ? WHERE id = ?', [Number(total || 0), currentId])
      const [rows] = await connection.query('SELECT parent_id FROM exam_categories WHERE id = ?', [currentId])
      currentId = rows.length ? rows[0].parent_id : null
    }
  }

  fastify.get('/api/exam-categories/tree', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      jwt.verify(token, JWT_SECRET)
      const [rows] = await pool.query(
        `SELECT id, parent_id, name, code, weight, status, order_num, path, level
         FROM exam_categories WHERE status != 'deleted' ORDER BY level ASC, order_num ASC`
      )
      const byId = new Map()
      rows.forEach(r => byId.set(r.id, { ...r, children: [] }))
      const roots = []
      rows.forEach(r => {
        const node = byId.get(r.id)
        if (r.parent_id && byId.has(r.parent_id)) {
          byId.get(r.parent_id).children.push(node)
        } else {
          roots.push(node)
        }
      })
      return { success: true, data: roots }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  fastify.get('/api/exam-categories', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      jwt.verify(token, JWT_SECRET)
      const { page = 1, pageSize = 50, keyword = '', status } = request.query
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      let where = `status != 'deleted'`
      const params = []
      if (keyword) { where += ' AND (name LIKE ? OR code LIKE ? )'; params.push(`%${keyword}%`, `%${keyword}%`) }
      if (status) { where += ' AND status = ?'; params.push(status) }
      const [rows] = await pool.query(`SELECT SQL_CALC_FOUND_ROWS * FROM exam_categories WHERE ${where} ORDER BY level, order_num LIMIT ? OFFSET ?`, [...params, parseInt(pageSize), offset])
      const [countRows] = await pool.query('SELECT FOUND_ROWS() as total')
      return { success: true, data: rows, page: parseInt(page), pageSize: parseInt(pageSize), total: countRows[0].total }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  fastify.post('/api/exam-categories', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员','系统管理员','培训师','客服主管','考试管理员'])
    if (!permissions) return
    try {
      const { name, code, weight = 0, status = 'active', parent_id = null, description = '' } = request.body
      if (!name || !code) return reply.code(400).send({ success: false, message: '缺少必填字段：name, code' })
      const [exists] = await pool.query('SELECT id FROM exam_categories WHERE code = ? AND status != "deleted"', [code])
      if (exists.length) return reply.code(400).send({ success: false, message: '分类编码已存在' })
      let level = 1
      let path = '/'
      if (parent_id) {
        const [pRows] = await pool.query('SELECT id, path, level FROM exam_categories WHERE id = ? AND status != "deleted"', [parent_id])
        if (!pRows.length) return reply.code(400).send({ success: false, message: '父级分类不存在' })
        level = pRows[0].level + 1
        path = `${pRows[0].path}${parent_id}/`
      }
      const [[{ maxOrder }]] = await pool.query('SELECT COALESCE(MAX(order_num),0) as maxOrder FROM exam_categories WHERE parent_id <=> ?', [parent_id])
      const order_num = (maxOrder || 0) + 1
      const [[{ sumWeight }]] = await pool.query('SELECT COALESCE(SUM(weight),0) AS sumWeight FROM exam_categories WHERE parent_id <=> ?', [parent_id])
      const newWeight = parseFloat(weight) || 0
      if ((sumWeight || 0) + newWeight > 100) {
        return reply.code(400).send({ success: false, message: '同级分类权重之和不能超过100' })
      }

      const [res] = await pool.query(
        `INSERT INTO exam_categories (parent_id, name, code, weight, status, order_num, path, level, description, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [parent_id || null, name, code, newWeight, status, order_num, path, level, description || null, permissions.userId]
      )
      await logOperation(res.insertId, permissions.userId, 'create', { name, code })
      if (parent_id) {
        const connection = await pool.getConnection()
        try { await recalcAncestorsWeight(connection, parent_id) } finally { connection.release() }
      }
      return { success: true, message: '创建成功', data: { id: res.insertId } }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '创建失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  fastify.put('/api/exam-categories/:id', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员','系统管理员','培训师','客服主管','考试管理员'])
    if (!permissions) return
    try {
      const { id } = request.params
      const { name, code, weight, status, parent_id, description } = request.body
      const [rows] = await pool.query('SELECT * FROM exam_categories WHERE id = ?', [id])
      if (!rows.length) return reply.code(404).send({ success: false, message: '分类不存在' })
      const current = rows[0]
      if (code && code !== current.code) {
        const [exists] = await pool.query('SELECT id FROM exam_categories WHERE code = ? AND id <> ?', [code, id])
        if (exists.length) return reply.code(400).send({ success: false, message: '分类编码已存在' })
      }
      let nextParent = current.parent_id
      let nextLevel = current.level
      let nextPath = current.path
      if (parent_id !== undefined && parent_id !== current.parent_id) {
        if (parent_id) {
          const [pRows] = await pool.query('SELECT id, path, level FROM exam_categories WHERE id = ?', [parent_id])
          if (!pRows.length) return reply.code(400).send({ success: false, message: '父级分类不存在' })
          nextParent = parent_id
          nextLevel = pRows[0].level + 1
          nextPath = `${pRows[0].path}${parent_id}/`
        } else {
          nextParent = null
          nextLevel = 1
          nextPath = '/'
        }
      }
      const fields = []
      const values = []
      if (name !== undefined) { fields.push('name = ?'); values.push(name) }
      if (code !== undefined) { fields.push('code = ?'); values.push(code) }
      if (weight !== undefined) { const w = Number(weight); if (!Number.isFinite(w) || w < 0) return reply.code(400).send({ success: false, message: '权重必须是非负数字' });
        const targetParent = parent_id !== undefined ? parent_id : current.parent_id
        const [[{ sumWeightExcluding }]] = await pool.query('SELECT COALESCE(SUM(weight),0) AS sumWeightExcluding FROM exam_categories WHERE parent_id <=> ? AND id <> ? AND status != "deleted"', [targetParent, id])
        if ((sumWeightExcluding || 0) + w > 100) return reply.code(400).send({ success: false, message: '同级分类权重之和不能超过100' })
        fields.push('weight = ?'); values.push(w) }
      if (status !== undefined) { if (!['active','inactive','deleted'].includes(status)) return reply.code(400).send({ success: false, message: '状态值无效' }); fields.push('status = ?'); values.push(status) }
      if (description !== undefined) { fields.push('description = ?'); values.push(description || null) }
      if (parent_id !== undefined && parent_id !== current.parent_id) { fields.push('parent_id = ?'); values.push(nextParent); fields.push('level = ?'); values.push(nextLevel); fields.push('path = ?'); values.push(nextPath) }
      fields.push('updated_at = NOW()')
      values.push(id)
      await pool.query(`UPDATE exam_categories SET ${fields.join(', ')} WHERE id = ?`, values)
      if (parent_id !== undefined && parent_id !== current.parent_id) {
        const [childRows] = await pool.query('SELECT id FROM exam_categories WHERE path LIKE ?', [`${current.path}${current.id}/%`])
        for (const c of childRows) {
          await pool.query('UPDATE exam_categories SET path = REPLACE(path, ?, ?) WHERE id = ?', [`${current.path}${current.id}/`, `${nextPath}${id}/`, c.id])
        }
      }
      await logOperation(id, permissions.userId, 'update', { name, code, weight, status, parent_id })
      const connection = await pool.getConnection()
      try {
        const parentToUpdate = parent_id !== undefined ? (parent_id || null) : current.parent_id
        if (parentToUpdate) await recalcAncestorsWeight(connection, parentToUpdate)
      } finally { connection.release() }
      return { success: true, message: '更新成功' }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '更新失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  fastify.delete('/api/exam-categories/:id', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员','系统管理员','培训师','客服主管','考试管理员'])
    if (!permissions) return
    try {
      const { id } = request.params
      const { cascade = false } = request.query
      const [rows] = await pool.query('SELECT * FROM exam_categories WHERE id = ?', [id])
      if (!rows.length) return reply.code(404).send({ success: false, message: '分类不存在' })
      const [childCountRows] = await pool.query('SELECT COUNT(*) as cnt FROM exam_categories WHERE parent_id = ?', [id])
      const hasChildren = childCountRows[0].cnt > 0
      if (hasChildren && !['true', true, '1', 1].includes(cascade)) {
        return reply.code(400).send({ success: false, message: '存在子分类，不能删除（请使用级联删除）' })
      }
      if (hasChildren) {
        await pool.query("UPDATE exam_categories SET status = 'deleted', updated_at = NOW() WHERE path LIKE ?", [`%/${id}/%`])
      }
      await pool.query("UPDATE exam_categories SET status = 'deleted', updated_at = NOW() WHERE id = ?", [id])
      await logOperation(id, permissions.userId, 'delete', { cascade: !!cascade })
      const parentId = rows[0].parent_id
      if (parentId) { const connection = await pool.getConnection(); try { await recalcAncestorsWeight(connection, parentId) } finally { connection.release() } }
      return { success: true, message: '删除成功' }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '删除失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  fastify.put('/api/exam-categories/reorder', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员','系统管理员','培训师','客服主管','考试管理员'])
    if (!permissions) return
    try {
      const { moves } = request.body
      if (!Array.isArray(moves) || !moves.length) return reply.code(400).send({ success: false, message: '缺少移动指令' })
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        for (const m of moves) {
          const { id, parent_id, order_num } = m
          const [curRows] = await connection.query('SELECT id, parent_id, path, level FROM exam_categories WHERE id = ?', [id])
          if (!curRows.length) continue
          const oldParent = curRows[0].parent_id
          let nextParent = parent_id
          let nextLevel = 1
          let nextPath = '/'
          if (parent_id) {
            const [pRows] = await connection.query('SELECT id, path, level FROM exam_categories WHERE id = ?', [parent_id])
            if (!pRows.length) throw new Error('父级不存在')
            nextLevel = pRows[0].level + 1
            nextPath = `${pRows[0].path}${parent_id}/`
          }
          await connection.query('UPDATE exam_categories SET parent_id = ?, level = ?, path = ?, order_num = ?, updated_at = NOW() WHERE id = ?', [nextParent || null, nextLevel, nextPath, parseInt(order_num) || 1, id])
          const [childRows] = await connection.query('SELECT id FROM exam_categories WHERE path LIKE ?', [`${curRows[0].path}${curRows[0].id}/%`])
          for (const c of childRows) {
            await connection.query('UPDATE exam_categories SET path = REPLACE(path, ?, ?) WHERE id = ?', [`${curRows[0].path}${curRows[0].id}/`, `${nextPath}${id}/`, c.id])
          }
          if (oldParent) await recalcAncestorsWeight(connection, oldParent)
          if (nextParent) await recalcAncestorsWeight(connection, nextParent)
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
      return reply.code(500).send({ success: false, message: '排序更新失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  fastify.get('/api/exam-categories/usage-stats', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      jwt.verify(token, JWT_SECRET)
      const [rows] = await pool.query(`
        SELECT c.id, c.name, c.code,
               COUNT(e.id) AS exam_count
        FROM exam_categories c
        LEFT JOIN exams e ON e.category = c.name
        WHERE c.status != 'deleted'
        GROUP BY c.id, c.name, c.code
        ORDER BY c.level, c.order_num
      `)
      return { success: true, data: rows }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '统计失败' })
    }
  })

  fastify.post('/api/exam-categories/import.xlsx', async (request, reply) => {
    try {
      const permissions = await requireRole(request, reply, ['超级管理员','系统管理员','培训师','客服主管','考试管理员'])
      if (!permissions) return
      const data = await request.file()
      if (!data) return reply.code(400).send({ success: false, message: '未接收到文件' })
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(await data.toBuffer())
      const sheet = workbook.worksheets[0]
      const rows = []
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const name = row.getCell(1).value?.toString()?.trim()
        const code = row.getCell(2).value?.toString()?.trim()
        const parentCode = row.getCell(3).value?.toString()?.trim()
        const weight = parseFloat(row.getCell(4).value) || 0
        const status = (row.getCell(5).value?.toString()?.trim() || 'active')
        if (name && code) rows.push({ name, code, parentCode, weight, status })
      })
      let successCount = 0
      let failed = []
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        for (const r of rows) {
          const [exists] = await connection.query('SELECT id FROM exam_categories WHERE code = ? AND status != "deleted"', [r.code])
          if (exists.length) { failed.push({ code: r.code, error: '编码已存在' }); continue }
          let parentId = null, level = 1, path = '/'
          if (r.parentCode) {
            const [pRows] = await connection.query('SELECT id, path, level FROM exam_categories WHERE code = ? AND status != "deleted"', [r.parentCode])
            if (pRows.length) { parentId = pRows[0].id; level = pRows[0].level + 1; path = `${pRows[0].path}${parentId}/` }
          }
          const [[{ maxOrder }]] = await connection.query('SELECT COALESCE(MAX(order_num),0) as maxOrder FROM exam_categories WHERE parent_id <=> ?', [parentId])
          const order_num = (maxOrder || 0) + 1
          const [[{ sumWeight }]] = await connection.query('SELECT COALESCE(SUM(weight),0) AS sumWeight FROM exam_categories WHERE parent_id <=> ?', [parentId])
          if ((sumWeight || 0) + r.weight > 100) { failed.push({ code: r.code, error: '同级权重超限' }); continue }
          await connection.query(
            `INSERT INTO exam_categories (parent_id, name, code, weight, status, order_num, path, level, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [parentId, r.name, r.code, r.weight, r.status, order_num, path, level, permissions.userId]
          )
          if (parentId) await recalcAncestorsWeight(connection, parentId)
          successCount++
        }
        await connection.commit()
      } catch (e) {
        await connection.rollback()
        throw e
      } finally { connection.release() }
      await logOperation(null, permissions.userId, 'import', { successCount, failedCount: failed.length })
      return { success: true, message: '导入完成', data: { success_count: successCount, failed } }
    } catch (error) {
      return reply.code(500).send({ success: false, message: '导入失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined })
    }
  })

  fastify.post('/api/exam-categories/recalculate-weights', async (request, reply) => {
    const permissions = await requireRole(request, reply, ['超级管理员','系统管理员','培训师','客服主管','考试管理员'])
    if (!permissions) return
    try {
      const { starting_id = null } = request.body || {}
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        if (starting_id) {
          await recalcAncestorsWeight(connection, starting_id)
        } else {
          const [parents] = await connection.query('SELECT id FROM exam_categories WHERE status != "deleted" AND id IN (SELECT DISTINCT parent_id FROM exam_categories WHERE parent_id IS NOT NULL)')
          for (const p of parents) {
            const [[{ total }]] = await connection.query('SELECT COALESCE(SUM(weight),0) AS total FROM exam_categories WHERE parent_id = ? AND status != "deleted"', [p.id])
            await connection.query('UPDATE exam_categories SET weight = ? WHERE id = ?', [Number(total || 0), p.id])
          }
        }
        await connection.commit()
      } catch (e) {
        await connection.rollback(); throw e
      } finally { connection.release() }
      return { success: true, message: '权重重算完成' }
    } catch (error) { return reply.code(500).send({ success: false, message: '权重重算失败' }) }
  })

  fastify.get('/api/exam-categories/export.xlsx', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      jwt.verify(token, JWT_SECRET)
      const [rows] = await pool.query('SELECT id, parent_id, name, code, weight, status, order_num, path, level FROM exam_categories WHERE status != "deleted" ORDER BY level, order_num')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('分类')
      sheet.columns = [
        { header: '名称', key: 'name', width: 30 },
        { header: '编码', key: 'code', width: 20 },
        { header: '父级编码', key: 'parentCode', width: 20 },
        { header: '权重', key: 'weight', width: 10 },
        { header: '状态', key: 'status', width: 10 },
        { header: '层级', key: 'level', width: 8 },
      ]
      for (const r of rows) {
        let parentCode = null
        if (r.parent_id) {
          const [pRows] = await pool.query('SELECT code FROM exam_categories WHERE id = ?', [r.parent_id])
          parentCode = pRows.length ? pRows[0].code : null
        }
        sheet.addRow({ name: r.name, code: r.code, parentCode, weight: r.weight, status: r.status, level: r.level })
      }
      const buffer = await workbook.xlsx.writeBuffer()
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('考试分类.xlsx'))
      return buffer
    } catch (error) {
      return reply.code(500).send({ success: false, message: '导出失败' })
    }
  })
}