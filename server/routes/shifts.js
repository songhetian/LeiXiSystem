// 班次管理 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

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
       (name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['休息', '00:00:00', '00:00:00', 0, 0, 0, 1, null, '休息日班次']
    )

    return {
      id: result.insertId,
      name: '休息',
      start_time: '00:00:00',
      end_time: '00:00:00',
      work_hours: 0,
      is_active: 1
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
    const { name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description } = request.body

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

      const [result] = await pool.query(
        `INSERT INTO work_shifts
        (name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, start_time, end_time, work_hours, late_threshold || 30, early_threshold || 30, is_active !== false ? 1 : 0, department_id || null, description || null]
      )

      return {
        success: true,
        message: '班次创建成功',
        data: { id: result.insertId }
      }
    } catch (error) {
      console.error('创建班次失败:', error)
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // 更新班次
  fastify.put('/api/shifts/:id', async (request, reply) => {
    const { id } = request.params
    const { name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active, department_id, description } = request.body

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

      await pool.query(
        `UPDATE work_shifts SET
          name = ?,
          start_time = ?,
          end_time = ?,
          work_hours = ?,
          late_threshold = ?,
          early_threshold = ?,
          is_active = ?,
          department_id = ?,
          description = ?
        WHERE id = ?`,
        [name, start_time, end_time, work_hours, late_threshold, early_threshold, is_active ? 1 : 0, department_id || null, description || null, id]
      )

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
