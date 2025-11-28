// 部门管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取部门列表
  fastify.get('/api/departments/list', async (request, reply) => {
    try {
      // 获取用户权限
      const permissions = await extractUserPermissions(request, pool)

      let query = 'SELECT * FROM departments WHERE 1=1'
      const params = []

      // 权限控制
      if (permissions) {
        // 根据用户权限过滤部门
        // 优先使用 viewableDepartmentIds（配置的部门权限）
        if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
          query += ` AND id IN (${permissions.viewableDepartmentIds.map(() => '?').join(',')})`
          params.push(...permissions.viewableDepartmentIds)
        } else if (permissions.departmentId) {
          // 如果没有配置部门权限，则只能看到自己所在的部门
          query += ' AND id = ?'
          params.push(permissions.departmentId)
        } else {
          // 没有任何部门权限
          return { success: true, data: [] }
        }
      } else {
        // 未登录用户可以查看所有启用的部门
        query += ' AND status = "active"'
      }

      query += ' ORDER BY sort_order, id'

      const [rows] = await pool.query(query, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取所有部门列表（用于管理场景，绕过权限检查）
  // 获取所有部门列表（用于管理场景，绕过权限检查）
  fastify.get('/api/departments/all', async (request, reply) => {
    try {
      // 获取用户权限（用于日志记录，但不用于权限检查）
      const permissions = await extractUserPermissions(request, pool)

      // 记录访问日志
      if (permissions) {
        // 访问日志省略标准输出
      }

      // 直接返回所有部门，不进行权限过滤（这是管理端点的特殊处理）
      let query = 'SELECT * FROM departments WHERE status = "active" ORDER BY sort_order, id'
      const [rows] = await pool.query(query)
      return { success: true, data: rows }
    } catch (error) {
      console.error('获取所有部门列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取单个部门详情
  fastify.get('/api/departments/detail/:id', async (request, reply) => {
    const { id } = request.params
    try {
      const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id])
      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '部门不存在' })
      }
      return { success: true, data: rows[0] }
    } catch (error) {
      console.error('获取部门详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 创建部门
  fastify.post('/api/departments/create', async (request, reply) => {
    const { name, parent_id, description, manager_id, status, sort_order } = request.body

    try {
      // 验证必填字段
      if (!name) {
        return reply.code(400).send({ success: false, message: '请填写部门名称' })
      }

      // 检查部门名称是否已存在
      const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [name])
      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '部门名称已存在' })
      }

      const [result] = await pool.query(
        `INSERT INTO departments
        (name, parent_id, description, manager_id, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          parent_id || null,
          description || null,
          manager_id || null,
          status || 'active',
          sort_order || 0
        ]
      )

      return {
        success: true,
        message: '部门创建成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('创建部门失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // 更新部门
  fastify.put('/api/departments/update/:id', async (request, reply) => {
    const { id } = request.params
    const { name, parent_id, description, manager_id, status, sort_order } = request.body

    try {
      // 检查部门是否存在
      const [existing] = await pool.query('SELECT id FROM departments WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '部门不存在' })
      }

      // 检查名称是否与其他部门重复
      const [nameCheck] = await pool.query('SELECT id FROM departments WHERE name = ? AND id != ?', [name, id])
      if (nameCheck.length > 0) {
        return reply.code(400).send({ success: false, message: '部门名称已存在' })
      }

      await pool.query(
        `UPDATE departments SET
        name = ?, parent_id = ?, description = ?, manager_id = ?, status = ?, sort_order = ?
        WHERE id = ?`,
        [
          name,
          parent_id || null,
          description || null,
          manager_id || null,
          status || 'active',
          sort_order || 0,
          id
        ]
      )

      return { success: true, message: '部门更新成功' }
    } catch (error) {
      console.error('更新部门失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除部门
  fastify.delete('/api/departments/delete/:id', async (request, reply) => {
    const { id } = request.params

    try {
      // 检查部门是否存在
      const [existing] = await pool.query('SELECT id FROM departments WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '部门不存在' })
      }

      // 检查是否有员工属于该部门
      const [employeeCheck] = await pool.query('SELECT id FROM users WHERE department_id = ?', [id])
      if (employeeCheck.length > 0) {
        return reply.code(400).send({ success: false, message: '该部门下有员工，无法删除' })
      }

      // 检查是否有职位属于该部门
      const [positionCheck] = await pool.query('SELECT id FROM positions WHERE department_id = ?', [id])
      if (positionCheck.length > 0) {
        return reply.code(400).send({ success: false, message: '该部门下有职位，无法删除' })
      }

      await pool.query('DELETE FROM departments WHERE id = ?', [id])

      return { success: true, message: '部门删除成功' }
    } catch (error) {
      console.error('删除部门失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // 获取部门员工列表
  fastify.get('/api/departments/employees/:departmentId', async (request, reply) => {
    const { departmentId } = request.params

    try {

      // 查询该部门的所有员工（通过employees表关联users表）
      const [employees] = await pool.query(
        `SELECT
          e.id,
          e.employee_no,
          e.user_id,
          u.real_name,
          u.username,
          u.email,
          u.phone,
          u.department_id,
          e.position,
          e.hire_date,
          e.status,
          e.rating
        FROM employees e
        INNER JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ? AND u.status = 'active' AND e.status = 'active'
        ORDER BY e.employee_no`,
        [departmentId]
      )

      return {
        success: true,
        data: employees
      }
    } catch (error) {
      console.error('获取部门员工失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取部门员工失败: ' + error.message
      })
    }
  })
}
