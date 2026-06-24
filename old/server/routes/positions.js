// 职位管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  if (!pool) {
    console.error('❌ 职位路由：数据库连接池未初始化！')
  }

  // 获取职位列表（支持分页和筛选）
  fastify.get('/api/positions', async (request, reply) => {
    const { page = 1, limit = 10, department_id, status, keyword } = request.query

    try {

      if (!pool) {
        console.error('❌ 数据库连接池不可用')
        return reply.code(500).send({
          success: false,
          message: '数据库连接失败',
          error: 'Database pool not available'
        })
      }

      // 获取用户权限
      const permissions = await extractUserPermissions(request, pool)

      const offset = (page - 1) * limit
      let query = `
        SELECT p.*, d.name as department_name
        FROM positions p
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE 1=1
      `
      const params = []

      // 权限控制：根据用户可查看的部门过滤职位
      if (permissions) {
        if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
          // 用户可以查看多个部门的职位
          const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',')
          query += ` AND (p.department_id IS NULL OR p.department_id IN (${placeholders}))`
          params.push(...permissions.viewableDepartmentIds)
        } else if (permissions.departmentId) {
          // 只能查看自己部门和全公司通用职位
          query += ' AND (p.department_id IS NULL OR p.department_id = ?)'
          params.push(permissions.departmentId)
        } else {
          // 没有任何部门权限，只能查看全公司通用职位
          query += ' AND p.department_id IS NULL'
        }
      } else {
        // 未登录或无权限信息的用户可以查看所有启用的职位（用于选择等场景）
        query += ' AND p.status = "active"'
      }

      // 部门筛选（如果有指定部门ID）
      if (department_id) {
        if (department_id === 'null') {
          query += ' AND p.department_id IS NULL'
        } else {
          query += ' AND p.department_id = ?'
          params.push(department_id)
        }
      }

      // 状态筛选
      if (status) {
        query += ' AND p.status = ?'
        params.push(status)
      }

      // 关键词搜索
      if (keyword) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)'
        params.push(`%${keyword}%`, `%${keyword}%`)
      }

      // 获取总数
      const countQuery = query.replace(
        'SELECT p.*, d.name as department_name',
        'SELECT COUNT(*) as total'
      )
      const [countResult] = await pool.query(countQuery, params)
      const total = countResult[0].total

      // 分页查询
      query += ' ORDER BY p.sort_order ASC, p.id DESC LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)

      const [rows] = await pool.query(query, params)

      return {
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      console.error('❌ 获取职位列表失败:', error)
      console.error('错误详情:', {
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage
      })
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: error.message
      })
    }
  })

  // 获取单个职位详情
  fastify.get('/api/positions/:id', async (request, reply) => {
    const { id } = request.params
    const redis = fastify.redis
    const cacheKey = `metadata:position:detail:${id}`

    try {
      if (redis) {
        const cached = await redis.get(cacheKey)
        if (cached) return { success: true, data: JSON.parse(cached) }
      }

      const [rows] = await pool.query(
        'SELECT p.*, d.name as department_name FROM positions p LEFT JOIN departments d ON p.department_id = d.id WHERE p.id = ?',
        [id]
      )
      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '职位不存在' })
      }

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(rows[0]), 'EX', 3600)
      }

      return { success: true, data: rows[0] }
    } catch (error) {
      console.error('获取职位详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 创建职位
  fastify.post('/api/positions', async (request, reply) => {
    const {
      name,
      level,
      salary_min,
      salary_max,
      department_id,
      description,
      requirements,
      status,
      sort_order
    } = request.body
    const redis = fastify.redis

    try {
      // 验证必填字段
      if (!name) {
        return reply.code(400).send({ success: false, message: '请填写职位名称' })
      }

      // 检查职位名称是否已存在（同一部门内）
      let checkQuery = 'SELECT id FROM positions WHERE name = ?'
      const checkParams = [name]

      if (department_id) {
        checkQuery += ' AND department_id = ?'
        checkParams.push(department_id)
      } else {
        checkQuery += ' AND department_id IS NULL'
      }

      const [existing] = await pool.query(checkQuery, checkParams)
      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '职位名称已存在' })
      }

      const [result] = await pool.query(
        `INSERT INTO positions
        (name, level, salary_min, salary_max, department_id, description, requirements, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          level || null,
          salary_min || null,
          salary_max || null,
          department_id || null,
          description || null,
          requirements || null,
          status || 'active',
          sort_order || 0
        ]
      )

      // 清理可能的职位列表相关缓存前缀 (如果有的话)
      // if (redis) await redis.del(...)

      return {
        success: true,
        message: '职位创建成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('创建职位失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // 更新职位
  fastify.put('/api/positions/:id', async (request, reply) => {
    const { id } = request.params
    const {
      name,
      level,
      salary_min,
      salary_max,
      department_id,
      description,
      requirements,
      status,
      sort_order
    } = request.body
    const redis = fastify.redis

    try {
      // 检查职位是否存在
      const [existing] = await pool.query('SELECT id FROM positions WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '职位不存在' })
      }

      // 检查名称是否与其他职位重复（同一部门内）
      let checkQuery = 'SELECT id FROM positions WHERE name = ? AND id != ?'
      const checkParams = [name, id]

      if (department_id) {
        checkQuery += ' AND department_id = ?'
        checkParams.push(department_id)
      } else {
        checkQuery += ' AND department_id IS NULL'
      }

      const [duplicate] = await pool.query(checkQuery, checkParams)
      if (duplicate.length > 0) {
        return reply.code(400).send({ success: false, message: '职位名称已存在' })
      }

      // 获取更新前的职位信息，用于比较是否需要更新员工记录
      const [existingPositions] = await pool.query('SELECT name FROM positions WHERE id = ?', [id]);
      if (existingPositions.length === 0) {
        return reply.code(404).send({ success: false, message: '职位不存在' });
      }
      const oldName = existingPositions[0].name;

      await pool.query(
        `UPDATE positions SET
          name = ?,
          level = ?,
          salary_min = ?,
          salary_max = ?,
          department_id = ?,
          description = ?,
          requirements = ?,
          status = ?,
          sort_order = ?
        WHERE id = ?`,
        [
          name,
          level || null,
          salary_min || null,
          salary_max || null,
          department_id || null,
          description || null,
          requirements || null,
          status || 'active',
          sort_order || 0,
          id
        ]
      )

      // 如果职位名称发生变化，同时更新所有关联的员工记录
      if (oldName !== name) {
        await pool.query(
          `UPDATE employees
           SET position = ?
           WHERE position_id = ?`,
          [name, id]
        );
      }

      // 清理缓存
      if (redis) {
        await redis.del(`metadata:position:detail:${id}`)
      }

      return { success: true, message: '职位更新成功' }
    } catch (error) {
      console.error('更新职位失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除职位
  fastify.delete('/api/positions/:id', async (request, reply) => {
    const { id } = request.params
    const redis = fastify.redis

    try {
      // 检查职位是否存在
      const [existing] = await pool.query('SELECT id FROM positions WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '职位不存在' })
      }

      // 在删除职位前，将关联的员工的position_id设为NULL，但保留position名称
      await pool.query(
        `UPDATE employees
         SET position_id = NULL
         WHERE position_id = ?`,
        [id]
      )

      await pool.query('DELETE FROM positions WHERE id = ?', [id])

      // 清理缓存
      if (redis) {
        await redis.del(`metadata:position:detail:${id}`)
      }

      return { success: true, message: '职位删除成功' }
    } catch (error) {
      console.error('删除职位失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })
}
