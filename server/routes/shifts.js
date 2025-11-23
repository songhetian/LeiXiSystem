// 班次管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 生成随机颜色的辅助函数
  const generateRandomColor = () => {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#8B5CF6', // purple
      '#F59E0B', // orange
      '#EC4899', // pink
      '#6366F1', // indigo
      '#14B8A6', // teal
      '#06B6D4', // cyan
      '#EF4444', // red
      '#F97316', // orange-600
      '#84CC16', // lime
      '#22C55E', // green-500
      '#0EA5E9', // sky
      '#A855F7', // purple-500
      '#D946EF', // fuchsia
      '#F43F5E'  // rose
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // 检查颜色是否已被使用的辅助函数
  const isColorUsed = async (color, excludeId = null) => {
    let query = 'SELECT COUNT(*) as count FROM work_shifts WHERE color = ? AND is_active = 1'
    const params = [color]

    if (excludeId) {
      query += ' AND id != ?'
      params.push(excludeId)
    }

    const [rows] = await pool.query(query, params)
    return rows[0].count > 0
  }

  // 生成唯一颜色的辅助函数
  const generateUniqueColor = async (excludeId = null) => {
    let color
    let attempts = 0
    const maxAttempts = 50

    do {
      color = generateRandomColor()
      attempts++
    } while (await isColorUsed(color, excludeId) && attempts < maxAttempts)

    // 如果所有预定义颜色都被使用，生成一个随机HEX颜色
    if (attempts >= maxAttempts) {
      color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
    }

    return color
  }

  // 获取或创建"休息"班次的辅助函数
  fastify.decorate('getRestShift', async function() {
    const [shifts] = await pool.query(
      'SELECT * FROM work_shifts WHERE name = ? AND department_id IS NULL',
      ['休息']
    )

    if (shifts.length > 0) {
      return shifts[0]
    }

    // 如果不存在，创建一个
    const [result] = await pool.query(
      `INSERT INTO work_shifts
       (name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['休息', '00:00:00', '00:00:00', 0, 0, 0, 1, null, '休息日班次', '#9CA3AF'] // 灰色
    )

    return {
      id: result.insertId,
      name: '休息',
      start_time: '00:00:00',
      end_time: '00:00:00',
      work_hours: 0,
      is_active: 1,
      color: '#9CA3AF'
    }
  })

  // 获取休息班次的API端点
  fastify.get('/api/shifts/rest', async (request, reply) => {
    try {
      const restShift = await fastify.getRestShift();
      return { success: true, data: restShift };
    } catch (error) {
      console.error('获取休息班次失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  })

  // 获取班次列表（支持分页和筛选）
  fastify.get('/api/shifts', async (request, reply) => {
    const { page = 1, limit = 10, department_id, is_active, keyword } = request.query

    try {
      const { extractUserPermissions } = require('../middleware/checkPermission')

      // 获取用户权限
      const permissions = await extractUserPermissions(request, pool)

      const offset = (page - 1) * limit
      let query = 'SELECT s.*, d.name as department_name FROM work_shifts s LEFT JOIN departments d ON s.department_id = d.id WHERE 1=1'
      const params = []

      // 权限控制：非全部门权限用户只能查看全公司通用班次和自己部门的班次
      if (!permissions) {
        // 没有权限信息（未登录或无角色），只能看全公司通用班次
        query += ' AND s.department_id IS NULL'
      } else if (!permissions.canViewAllDepartments) {
        // 没有查看所有部门权限的用户
        if (permissions.departmentId) {
          query += ' AND (s.department_id IS NULL OR s.department_id = ?)'
          params.push(permissions.departmentId)
        } else {
          // 没有部门的用户只能看全公司通用班次
          query += ' AND s.department_id IS NULL'
        }
      } else {
      }

      // 部门筛选（仅对有全部门权限的用户生效）
      if (department_id && permissions && permissions.canViewAllDepartments) {
        if (department_id === 'null') {
          query += ' AND s.department_id IS NULL'
        } else {
          query += ' AND s.department_id = ?'
          params.push(department_id)
        }
      }

      // 状态筛选
      if (is_active !== undefined && is_active !== '') {
        query += ' AND s.is_active = ?'
        params.push(parseInt(is_active))
      }

      // 关键词搜索
      if (keyword) {
        query += ' AND s.name LIKE ?'
        params.push(`%${keyword}%`)
      }

      // 获取总数
      const countQuery = query.replace('SELECT s.*, d.name as department_name', 'SELECT COUNT(*) as total')
      const [countResult] = await pool.query(countQuery, params)
      const total = countResult[0].total

      // 分页查询
      query += ' ORDER BY s.id DESC LIMIT ? OFFSET ?'
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
      console.error('获取班次列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取单个班次详情
  fastify.get('/api/shifts/:id', async (request, reply) => {
    const { id } = request.params
    try {
      const [rows] = await pool.query('SELECT * FROM work_shifts WHERE id = ?', [id])
      if (rows.length === 0) {
        return reply.code(404).send({ success: false, message: '班次不存在' })
      }
      return { success: true, data: rows[0] }
    } catch (error) {
      console.error('获取班次详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 创建班次
  fastify.post('/api/shifts', async (request, reply) => {
    const { name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description, color } = request.body

    try {
      // 验证必填字段
      if (!name || !start_time || !end_time || !work_hours) {
        return reply.code(400).send({ success: false, message: '请填写完整信息' })
      }

      // 检查班次名称是否已存在（同一部门内）
      let checkQuery = 'SELECT id FROM work_shifts WHERE name = ?'
      const checkParams = [name]

      if (department_id) {
        checkQuery += ' AND department_id = ?'
        checkParams.push(department_id)
      } else {
        checkQuery += ' AND department_id IS NULL'
      }

      const [existing] = await pool.query(checkQuery, checkParams)
      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '班次名称已存在' })
      }

      // 生成或使用提供的颜色
      let shiftColor = color
      if (!shiftColor) {
        shiftColor = await generateUniqueColor()
      } else {
        // 如果提供了颜色，检查是否重复
        if (await isColorUsed(shiftColor)) {
           // 如果重复，生成新的
           shiftColor = await generateUniqueColor()
        }
      }

      const [result] = await pool.query(
        `INSERT INTO work_shifts
        (name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, start_time, end_time, work_hours, late_threshold || 30, early_threshold || 30, is_active !== false ? 1 : 0, department_id || null, description || null, shiftColor]
      )

      return {
        success: true,
        message: '班次创建成功',
        data: { id: result.insertId, color: shiftColor }
      }
    } catch (error) {
      console.error('创建班次失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // 更新班次
  fastify.put('/api/shifts/:id', async (request, reply) => {
    const { id } = request.params
    const { name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description, color } = request.body

    try {
      // 检查班次是否存在
      const [existing] = await pool.query('SELECT id FROM work_shifts WHERE id = ?', [id])
      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '班次不存在' })
      }

      // 检查名称是否与其他班次重复（同一部门内）
      let checkQuery = 'SELECT id FROM work_shifts WHERE name = ? AND id != ?'
      const checkParams = [name, id]

      if (department_id) {
        checkQuery += ' AND department_id = ?'
        checkParams.push(department_id)
      } else {
        checkQuery += ' AND department_id IS NULL'
      }

      const [duplicate] = await pool.query(checkQuery, checkParams)
      if (duplicate.length > 0) {
        return reply.code(400).send({ success: false, message: '班次名称已存在' })
      }

      // 构建更新查询
      let updateQuery = `UPDATE work_shifts SET
          name = ?,
          start_time = ?,
          end_time = ?,
          work_hours = ?,
          late_threshold = ?,
          early_threshold = ?,
          is_active = ?,
          department_id = ?,
          description = ?`

      const updateParams = [name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active ? 1 : 0, department_id || null, description || null]

      // 如果提供了颜色，更新颜色
      if (color) {
        updateQuery += `, color = ?`
        updateParams.push(color)
      }

      updateQuery += ` WHERE id = ?`
      updateParams.push(id)

      await pool.query(updateQuery, updateParams)

      return {
        success: true,
        message: '班次更新成功'
      }
    } catch (error) {
      console.error('更新班次失败:', error)
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // 删除班次
  fastify.delete('/api/shifts/:id', async (request, reply) => {
    const { id } = request.params

    try {
      // 检查是否有排班使用此班次
      const [schedules] = await pool.query(
        'SELECT COUNT(*) as count FROM shift_schedules WHERE shift_id = ?',
        [id]
      )

      if (schedules[0].count > 0) {
        return reply.code(400).send({
          success: false,
          message: '该班次已被使用，无法删除。请先删除相关排班。'
        })
      }

      await pool.query('DELETE FROM work_shifts WHERE id = ?', [id])

      return {
        success: true,
        message: '班次删除成功'
      }
    } catch (error) {
      console.error('删除班次失败:', error)
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // 切换班次状态
  fastify.post('/api/shifts/:id/toggle', async (request, reply) => {
    const { id } = request.params

    try {
      const [shifts] = await pool.query('SELECT is_active FROM work_shifts WHERE id = ?', [id])
      if (shifts.length === 0) {
        return reply.code(404).send({ success: false, message: '班次不存在' })
      }

      const newStatus = shifts[0].is_active ? 0 : 1
      await pool.query('UPDATE work_shifts SET is_active = ? WHERE id = ?', [newStatus, id])

      return {
        success: true,
        message: newStatus ? '班次已启用' : '班次已禁用',
        data: { is_active: newStatus }
      }
    } catch (error) {
      console.error('切换班次状态失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })
}
