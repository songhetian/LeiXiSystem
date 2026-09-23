// 考核计划管理 API
const jwt = require('jsonwebtoken')
const { toBeijingTime } = require('../utils/time')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

console.log('✅ assessment-plans.js 路由文件已加载')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql
  console.log('✅ assessment-plans 路由已注册')

  // 创建考核计划
  // POST /api/assessment-plans
  // 必填字段：title, exam_id, start_time, end_time
  // 验证试卷状态（必须是 published）
  // 验证时间范围（start_time < end_time）
  // 验证 target_users（JSON 数组格式）
  // 默认 max_attempts 为 1
  // 默认 status 为 'draft'
  // 设置 created_by
  fastify.post('/api/assessment-plans', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const {
        title,
        description,
        exam_id,
        target_departments,
        start_time,
        end_time,
        max_attempts
      } = request.body

      // 必填字段验证
      if (!title || !exam_id || !start_time || !end_time) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：title, exam_id, start_time, end_time'
        })
      }

      // 验证标题
      if (typeof title !== 'string' || title.trim() === '') {
        return reply.code(400).send({
          success: false,
          message: '计划标题不能为空'
        })
      }

      if (title.length > 200) {
        return reply.code(400).send({
          success: false,
          message: '计划标题不能超过200个字符'
        })
      }

      // 验证 exam_id
      if (typeof exam_id !== 'number' || exam_id <= 0) {
        return reply.code(400).send({
          success: false,
          message: '试卷ID必须是大于0的数字'
        })
      }

      // 验证试卷是否存在且状态为 published
      const [examRows] = await pool.query(
        'SELECT id, title, status FROM exams WHERE id = ?',
        [exam_id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 验证试卷状态（必须是 published）
      if (exam.status !== 'published') {
        return reply.code(400).send({
          success: false,
          message: '只能使用已发布的试卷创建考核计划',
          data: {
            exam_id: exam.id,
            exam_title: exam.title,
            exam_status: exam.status
          }
        })
      }

      // 验证时间格式和范围
      const startTime = new Date(start_time)
      const endTime = new Date(end_time)

      if (isNaN(startTime.getTime())) {
        return reply.code(400).send({
          success: false,
          message: '开始时间格式无效'
        })
      }

      if (isNaN(endTime.getTime())) {
        return reply.code(400).send({
          success: false,
          message: '结束时间格式无效'
        })
      }

      // 验证时间范围（start_time < end_time）
      if (startTime >= endTime) {
        return reply.code(400).send({
          success: false,
          message: '开始时间必须早于结束时间',
          data: {
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString()
          }
        })
      }

      // 转换为 MySQL datetime 格式 (YYYY-MM-DD HH:MM:SS)
      const formatDateForMySQL = (date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ')
      }

      const mysqlStartTime = formatDateForMySQL(startTime)
      const mysqlEndTime = formatDateForMySQL(endTime)

      // 验证 target_departments（JSON 数组格式）
      let targetDepartmentsJson = null
      let targetDepartmentIds = []

      if (target_departments !== undefined && target_departments !== null) {
        // 验证是否为数组
        if (!Array.isArray(target_departments)) {
          return reply.code(400).send({
            success: false,
            message: 'target_departments 必须是数组格式'
          })
        }

        // 检查是否为空数组
        if (target_departments.length === 0) {
          return reply.code(400).send({
            success: false,
            message: '请至少选择一个目标部门'
          })
        }

        // 验证数组元素都是数字
        for (let i = 0; i < target_departments.length; i++) {
          if (typeof target_departments[i] !== 'number' || target_departments[i] <= 0) {
            return reply.code(400).send({
              success: false,
              message: `target_departments 中的部门ID必须是大于0的数字，位置 ${i} 的值无效`
            })
          }
        }

        // 去重
        targetDepartmentIds = [...new Set(target_departments)]

        // 验证部门是否存在
        if (targetDepartmentIds.length > 0) {
          const placeholders = targetDepartmentIds.map(() => '?').join(',')
          const [deptRows] = await pool.query(
            `SELECT id FROM departments WHERE id IN (${placeholders})`,
            targetDepartmentIds
          )

          if (deptRows.length !== targetDepartmentIds.length) {
            const foundIds = deptRows.map(d => d.id)
            const missingIds = targetDepartmentIds.filter(id => !foundIds.includes(id))
            return reply.code(404).send({
              success: false,
              message: '部分部门不存在',
              data: {
                missing_department_ids: missingIds
              }
            })
          }
        }

        targetDepartmentsJson = JSON.stringify(targetDepartmentIds)
      }

      // 验证 max_attempts（默认为 1）
      let maxAttempts = 1
      if (max_attempts !== undefined && max_attempts !== null) {
        if (typeof max_attempts !== 'number' || max_attempts < 1) {
          return reply.code(400).send({
            success: false,
            message: '最大尝试次数必须是大于等于1的数字'
          })
        }
        maxAttempts = max_attempts
      }

      // 插入考核计划数据
      const [result] = await pool.query(
        `INSERT INTO assessment_plans (
          title,
          description,
          exam_id,
          target_departments,
          start_time,
          end_time,
          max_attempts,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title.trim(),
          description || null,
          exam_id,
          targetDepartmentsJson,
          mysqlStartTime,
          mysqlEndTime,
          maxAttempts,
          decoded.id // 设置 created_by 为当前用户
        ]
      )

      // 为目标部门的所有用户创建考试通知
      if (targetDepartmentIds.length > 0) {
        const placeholders = targetDepartmentIds.map(() => '?').join(',')
        const [targetUsers] = await pool.query(
          `SELECT id FROM users WHERE department_id IN (${placeholders}) AND status = 'active'`,
          targetDepartmentIds
        )

        // 批量创建通知
        const startTimeStr = toBeijingTime(startTime)
        const endTimeStr = toBeijingTime(endTime)

        for (const user of targetUsers) {
          try {
            await pool.query(
              `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                user.id,
                'exam_notification',
                '新考试通知',
                `考试《${exam.title}》已发布，考试时间：${startTimeStr} 至 ${endTimeStr}`,
                result.insertId,
                'assessment_plan'
              ]
            )

            // 🔔 实时推送通知（WebSocket）
            if (fastify.io) {
              const { sendNotificationToUser } = require('../websocket')
              sendNotificationToUser(fastify.io, user.id, {
                type: 'exam_notification',
                title: '新考试通知',
                content: `考试《${exam.title}》已发布，考试时间：${startTimeStr} 至 ${endTimeStr}`,
                related_id: result.insertId,
                related_type: 'assessment_plan',
                created_at: new Date()
              })
            }
          } catch (notificationError) {
            console.error(`❌ 创建考试通知失败（用户ID: ${user.id}）:`, notificationError)
          }
        }
        console.log(`✅ 考试通知创建完成，共${targetUsers.length}个用户`)
      }

      return {
        success: true,
        message: '考核计划创建成功',
        data: {
          id: result.insertId,
          title: title.trim(),
          exam_id: exam_id,
          exam_title: exam.title,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_attempts: maxAttempts,
          target_department_count: targetDepartmentIds.length,
          status: 'published',
          created_by: decoded.id
        }
      }
    } catch (error) {
      console.error('创建考核计划失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '创建失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取考核计划列表
  // GET /api/assessment-plans
  fastify.get('/api/assessment-plans', async (request, reply) => {
    try {
      const { page = 1, limit = 10, keyword, department_id, status } = request.query
      const offset = (page - 1) * limit

      // 构建查询条件
      let whereClause = 'ap.is_deleted = 0'
      const params = []

      if (keyword) {
        whereClause += ' AND (ap.title LIKE ? OR ap.description LIKE ?)'
        params.push(`%${keyword}%`, `%${keyword}%`)
      }

      if (status) {
        whereClause += ' AND ap.status = ?'
        params.push(status)
      }

      // 获取总数
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM assessment_plans ap WHERE ${whereClause}`,
        params
      )
      const total = countRows[0].total

      // 获取列表
      const [rows] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.description,
          ap.exam_id,
          ap.target_departments,
          ap.start_time,
          ap.end_time,
          ap.max_attempts,
          ap.status,
          ap.created_at,
          e.title as exam_title
        FROM assessment_plans ap
        LEFT JOIN exams e ON ap.exam_id = e.id
        WHERE ${whereClause}
        ORDER BY ap.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
      )

      // 处理 target_departments
      const plans = []
      for (const row of rows) {
        let targetDepartments = []
        let targetDepartmentIds = []

        if (row.target_departments) {
          try {
            targetDepartmentIds = typeof row.target_departments === 'string'
              ? JSON.parse(row.target_departments)
              : row.target_departments

            if (Array.isArray(targetDepartmentIds) && targetDepartmentIds.length > 0) {
              // 获取部门名称
              const placeholders = targetDepartmentIds.map(() => '?').join(',')
              const [deptRows] = await pool.query(
                `SELECT id, name FROM departments WHERE id IN (${placeholders})`,
                targetDepartmentIds
              )
              targetDepartments = deptRows
            }
          } catch (e) {
            console.error('解析 target_departments 失败', e)
          }
        }

        // Calculate status based on time
        const now = new Date()
        const startTime = new Date(row.start_time)
        const endTime = new Date(row.end_time)
        let calculatedStatus = 'not_started'

        if (now >= startTime && now <= endTime) {
          calculatedStatus = 'ongoing'
        } else if (now > endTime) {
          calculatedStatus = 'ended'
        }

        plans.push({
          ...row,
          status: calculatedStatus, // Override status
          original_status: row.status,
          target_departments: targetDepartments,
          target_department_ids: targetDepartmentIds,
          target_departments_names: targetDepartments.map(d => d.name).join(', ')
        })
      }

      return {
        success: true,
        data: plans,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }

    } catch (error) {
      console.error('获取考核计划列表失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取列表失败'
      })
    }
  });



  // 更新考核计划
  // PUT /api/assessment-plans/:id
  // 验证计划状态（ongoing/completed 限制修改）
  // 可更新字段：title, description, start_time, end_time, target_users, max_attempts
  // 不可更新：exam_id
  fastify.put('/api/assessment-plans/:id', async (request, reply) => {
    try {
      const { id } = request.params

      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      // 获取现有的考核计划
      const [planRows] = await pool.query(
        'SELECT id, title, exam_id, start_time, end_time FROM assessment_plans WHERE id = ?',
        [id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '考核计划不存在'
        })
      }

      const existingPlan = planRows[0]

      // 验证计划时间（进行中或已结束限制修改）
      const now = new Date()
      const startTime = new Date(existingPlan.start_time)
      const endTime = new Date(existingPlan.end_time)

      if (now >= startTime && now <= endTime) {
        return reply.code(400).send({
          success: false,
          message: '考核计划正在进行中，无法修改',
          data: {
            plan_id: existingPlan.id,
            start_time: existingPlan.start_time,
            end_time: existingPlan.end_time
          }
        })
      }

      if (now > endTime) {
        const endedDuration = Math.floor((now - endTime) / 1000 / 60 / 60 / 24)
        return reply.code(400).send({
          success: false,
          message: `考核计划已于 ${endedDuration} 天前结束,无法修改。如需调整,请联系管理员创建新的考核计划。`,
          data: {
            plan_id: existingPlan.id,
            plan_title: existingPlan.title,
            end_time: existingPlan.end_time,
            ended_days_ago: endedDuration
          }
        })
      }

      const {
        title,
        description,
        start_time,
        end_time,
        target_users,
        max_attempts
      } = request.body

      // 构建更新字段
      const updateFields = []
      const updateValues = []

      // 更新标题
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '计划标题不能为空'
          })
        }

        if (title.length > 200) {
          return reply.code(400).send({
            success: false,
            message: '计划标题不能超过200个字符'
          })
        }

        updateFields.push('title = ?')
        updateValues.push(title.trim())
      }

      // 更新描述
      if (description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(description || null)
      }

      // 辅助函数：转换为 MySQL datetime 格式
      const formatDateForMySQL = (date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ')
      }

      // 更新开始时间
      if (start_time !== undefined) {
        const startTime = new Date(start_time)

        if (isNaN(startTime.getTime())) {
          return reply.code(400).send({
            success: false,
            message: '开始时间格式无效'
          })
        }

        updateFields.push('start_time = ?')
        updateValues.push(formatDateForMySQL(startTime))
      }

      // 更新结束时间
      if (end_time !== undefined) {
        const endTime = new Date(end_time)

        if (isNaN(endTime.getTime())) {
          return reply.code(400).send({
            success: false,
            message: '结束时间格式无效'
          })
        }

        updateFields.push('end_time = ?')
        updateValues.push(formatDateForMySQL(endTime))
      }

      // 验证时间范围（如果两个时间都提供了）
      if (start_time !== undefined && end_time !== undefined) {
        const startTime = new Date(start_time)
        const endTime = new Date(end_time)

        if (startTime >= endTime) {
          return reply.code(400).send({
            success: false,
            message: '开始时间必须早于结束时间',
            data: {
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString()
            }
          })
        }
      }

      // 更新目标用户
      if (target_departments !== undefined) {
        let targetDepartmentsJson = null
        let targetDepartmentIds = []

        if (target_departments !== null) {
          // 验证是否为数组
          if (!Array.isArray(target_departments)) {
            return reply.code(400).send({
              success: false,
              message: 'target_departments 必须是数组格式'
            })
          }

          // 验证数组元素都是数字
          for (let i = 0; i < target_departments.length; i++) {
            if (typeof target_departments[i] !== 'number' || target_departments[i] <= 0) {
              return reply.code(400).send({
                success: false,
                message: `target_departments 中的部门ID必须是大于0的数字，位置 ${i} 的值无效`
              })
            }
          }

          // 去重
          targetDepartmentIds = [...new Set(target_departments)]

          // 验证部门是否存在
          if (targetDepartmentIds.length > 0) {
            const placeholders = targetDepartmentIds.map(() => '?').join(',')
            const [deptRows] = await pool.query(
              `SELECT id FROM departments WHERE id IN (${placeholders})`,
              targetDepartmentIds
            )

            if (deptRows.length !== targetDepartmentIds.length) {
              const foundIds = deptRows.map(d => d.id)
              const missingIds = targetDepartmentIds.filter(id => !foundIds.includes(id))
              return reply.code(404).send({
                success: false,
                message: '部分部门不存在',
                data: {
                  missing_department_ids: missingIds
                }
              })
            }
          }

          targetDepartmentsJson = JSON.stringify(targetDepartmentIds)
        }

        updateFields.push('target_departments = ?')
        updateValues.push(targetDepartmentsJson)
      }

      // 更新最大尝试次数
      if (max_attempts !== undefined) {
        if (typeof max_attempts !== 'number' || max_attempts < 1) {
          return reply.code(400).send({
            success: false,
            message: '最大尝试次数必须是大于等于1的数字'
          })
        }

        updateFields.push('max_attempts = ?')
        updateValues.push(max_attempts)
      }

      // 如果没有任何字段需要更新
      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供需要更新的字段'
        })
      }

      // 执行更新
      updateValues.push(id)
      const updateQuery = `UPDATE assessment_plans SET ${updateFields.join(', ')} WHERE id = ?`

      await pool.query(updateQuery, updateValues)

      // 获取更新后的计划信息
      const [updatedPlanRows] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.description,
          ap.exam_id,
          ap.target_departments,
          ap.start_time,
          ap.end_time,
          ap.max_attempts,
          ap.status,
          ap.updated_at,
          e.title as exam_title
        FROM assessment_plans ap
        LEFT JOIN exams e ON ap.exam_id = e.id
        WHERE ap.id = ?`,
        [id]
      )

      const updatedPlan = updatedPlanRows[0]

      // 解析 target_departments
      let targetDepartmentCount = 0
      if (updatedPlan.target_departments) {
        try {
          const departmentIds = typeof updatedPlan.target_departments === 'string'
            ? JSON.parse(updatedPlan.target_departments)
            : updatedPlan.target_departments
          targetDepartmentCount = Array.isArray(departmentIds) ? departmentIds.length : 0
        } catch (error) {
          console.error('解析 target_departments 失败:', error)
        }
      }

      return {
        success: true,
        message: '考核计划更新成功',
        data: {
          id: updatedPlan.id,
          title: updatedPlan.title,
          description: updatedPlan.description,
          exam_id: updatedPlan.exam_id,
          exam_title: updatedPlan.exam_title,
          start_time: updatedPlan.start_time,
          end_time: updatedPlan.end_time,
          max_attempts: updatedPlan.max_attempts,
          target_department_count: targetDepartmentCount,
          status: updatedPlan.status,
          updated_at: updatedPlan.updated_at
        }
      }
    } catch (error) {
      console.error('更新考核计划失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '更新失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 更新计划状态 (已废弃)
  // PUT /api/assessment-plans/:id/status
  // 状态现由时间自动控制，此接口不再执行任何操作
  fastify.put('/api/assessment-plans/:id/status', async (request, reply) => {
    return {
      success: true,
      message: '状态由时间自动控制，无需手动更新'
    }
  })



  // 获取参与者列表
  // GET /api/assessment-plans/:id/participants
  // 返回 target_users 中的用户信息
  // 返回每个用户的完成状态
  // 返回考试成绩和尝试次数
  // 支持筛选（已完成/未完成）
  fastify.get('/api/assessment-plans/:id/participants', async (request, reply) => {
    try {
      const { id } = request.params
      const { status: filterStatus } = request.query // 筛选参数：completed, incomplete

      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      // 获取考核计划基本信息
      const [planRows] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.exam_id,
          ap.target_departments,
          ap.max_attempts,
          ap.status,
          e.title as exam_title,
          e.total_score,
          e.pass_score
        FROM assessment_plans ap
        LEFT JOIN exams e ON ap.exam_id = e.id
        WHERE ap.id = ?`,
        [id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '考核计划不存在'
        })
      }

      const plan = planRows[0]

      // 解析 target_departments JSON
      let targetDepartmentIds = []
      if (plan.target_departments) {
        try {
          targetDepartmentIds = typeof plan.target_departments === 'string'
            ? JSON.parse(plan.target_departments)
            : plan.target_departments

          if (!Array.isArray(targetDepartmentIds)) {
            targetDepartmentIds = []
          }
        } catch (error) {
          console.error('解析 target_departments JSON 失败:', error)
          targetDepartmentIds = []
        }
      }

      if (targetDepartmentIds.length === 0) {
        return {
          success: true,
          data: {
            plan_id: plan.id,
            plan_title: plan.title,
            exam_id: plan.exam_id,
            exam_title: plan.exam_title,
            max_attempts: plan.max_attempts,
            participants: [],
            statistics: {
              total_users: 0,
              completed_count: 0,
              incomplete_count: 0,
              passed_count: 0,
              failed_count: 0,
              average_score: 0,
              pass_rate: 0
            }
          }
        }
      }

      // 获取目标部门中的所有用户
      const deptPlaceholders = targetDepartmentIds.map(() => '?').join(',')
      const [userRows] = await pool.query(
        `SELECT
          u.id,
          u.username,
          u.real_name,
          u.email,
          u.phone,
          u.department_id,
          d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.department_id IN (${deptPlaceholders})`,
        targetDepartmentIds
      )

      // 构建参与者列表
      const participants = []
      let completedCount = 0
      let passedCount = 0
      let failedCount = 0
      let totalScore = 0
      let scoredCount = 0

      for (const user of userRows) {
        // 获取该用户的所有考试记录
        const [resultRows] = await pool.query(
          `SELECT
            id,
            attempt_number,
            start_time,
            submit_time,
            duration,
            score,
            is_passed,
            status
          FROM assessment_results
          WHERE plan_id = ? AND user_id = ?
          ORDER BY attempt_number DESC`,
          [id, user.id]
        )

        // 计算完成状态
        const completedResults = resultRows.filter(r => r.status === 'submitted' || r.status === 'graded')
        const hasCompleted = completedResults.length > 0
        const attemptCount = resultRows.length

        // 获取最佳成绩
        let bestResult = null
        let bestScore = null
        let isPassed = false
        let lastSubmitTime = null

        if (completedResults.length > 0) {
          // 找到分数最高的记录
          bestResult = completedResults.reduce((best, current) => {
            const currentScore = parseFloat(current.score) || 0
            const bestScore = parseFloat(best.score) || 0
            return currentScore > bestScore ? current : best
          }, completedResults[0])

          bestScore = bestResult ? parseFloat(bestResult.score) : null
          isPassed = bestResult ? bestResult.is_passed === 1 : false
          lastSubmitTime = bestResult ? bestResult.submit_time : null

          // 统计数据
          if (bestScore !== null) {
            totalScore += bestScore
            scoredCount++
          }
        }

        // 构建参与者信息
        const participant = {
          user_id: user.id,
          username: user.username,
          real_name: user.real_name,
          email: user.email,
          phone: user.phone,
          department_id: user.department_id,
          department_name: user.department_name,
          has_completed: hasCompleted,
          attempt_count: attemptCount,
          remaining_attempts: plan.max_attempts - attemptCount,
          best_score: bestScore,
          is_passed: isPassed,
          last_submit_time: lastSubmitTime,
          all_attempts: resultRows.map(r => ({
            attempt_number: r.attempt_number,
            start_time: r.start_time,
            submit_time: r.submit_time,
            duration: r.duration,
            score: r.score ? parseFloat(r.score) : null,
            is_passed: r.is_passed === 1,
            status: r.status
          }))
        }

        // 应用筛选
        if (filterStatus === 'completed' && !hasCompleted) {
          continue
        }
        if (filterStatus === 'incomplete' && hasCompleted) {
          continue
        }

        participants.push(participant)

        // 更新统计
        if (hasCompleted) {
          completedCount++
          if (isPassed) {
            passedCount++
          } else {
            failedCount++
          }
        }
      }

      // 计算统计数据
      const totalUsers = filterStatus ? participants.length : userRows.length
      const incompleteCount = totalUsers - completedCount
      const averageScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(2) : 0
      const passRate = completedCount > 0 ? ((passedCount / completedCount) * 100).toFixed(2) : 0

      return {
        success: true,
        data: {
          plan_id: plan.id,
          plan_title: plan.title,
          exam_id: plan.exam_id,
          exam_title: plan.exam_title,
          total_score: parseFloat(plan.total_score),
          pass_score: parseFloat(plan.pass_score),
          max_attempts: plan.max_attempts,
          plan_status: plan.status,
          participants: participants,
          statistics: {
            total_users: totalUsers,
            completed_count: completedCount,
            incomplete_count: incompleteCount,
            passed_count: passedCount,
            failed_count: failedCount,
            average_score: parseFloat(averageScore),
            pass_rate: parseFloat(passRate),
            completion_rate: totalUsers > 0 ? ((completedCount / totalUsers) * 100).toFixed(2) : 0
          }
        }
      }
    } catch (error) {
      console.error('获取参与者列表失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取我的考试列表
  // GET /api/my-exams
  // 根据 assessment_plans.target_users 筛选
  // 返回当前用户可参加的考试
  // 显示考试状态（未开始、进行中、已结束）
  // 显示剩余尝试次数
  // 显示最佳成绩
  fastify.get('/api/my-exams', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const userId = decoded.id
      const currentTime = new Date()

      // 首先获取用户的部门ID（移到循环外，避免重复查询）
      const [userRows] = await pool.query(
        'SELECT department_id FROM users WHERE id = ?',
        [userId]
      )

      if (userRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '用户不存在'
        })
      }

      const userDepartmentId = userRows[0].department_id

      // 获取所有考核计划
      const [allPlans] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.description,
          ap.exam_id,
          ap.target_departments,
          ap.start_time,
          ap.end_time,
          ap.max_attempts,
          ap.status as plan_status,
          ap.created_at,
          e.title as exam_title,
          e.description as exam_description,
          e.category as exam_category,
          e.difficulty as exam_difficulty,
          e.duration as exam_duration,
          e.total_score as exam_total_score,
          e.pass_score as exam_pass_score,
          e.question_count as exam_question_count
        FROM assessment_plans ap
        INNER JOIN exams e ON ap.exam_id = e.id
        WHERE ap.is_deleted = 0
        ORDER BY ap.start_time DESC`
      )

      // 筛选当前用户可参加的考试
      const myExams = []

      for (const plan of allPlans) {
        // 解析 target_departments JSON
        let targetDepartmentIds = []
        if (plan.target_departments) {
          try {
            targetDepartmentIds = typeof plan.target_departments === 'string'
              ? JSON.parse(plan.target_departments)
              : plan.target_departments

            if (!Array.isArray(targetDepartmentIds)) {
              targetDepartmentIds = []
            }
          } catch (error) {
            continue
          }
        } else {
          continue
        }

        // 检查用户部门是否在目标部门列表中
        if (!targetDepartmentIds.includes(userDepartmentId)) {
          continue
        }

        // 获取用户的考试记录
        const [resultRows] = await pool.query(
          `SELECT
            id,
            attempt_number,
            start_time,
            submit_time,
            duration,
            score,
            is_passed,
            status
          FROM assessment_results
          WHERE plan_id = ? AND user_id = ?
          ORDER BY score DESC, attempt_number DESC`,
          [plan.id, userId]
        )

        // 计算剩余尝试次数
        const attemptCount = resultRows.length
        const remainingAttempts = plan.max_attempts - attemptCount

        // 获取最佳成绩
        const completedResults = resultRows.filter(r => r.status === 'submitted' || r.status === 'graded')
        const bestResult = completedResults.length > 0 ? completedResults[0] : null
        const bestScore = bestResult ? parseFloat(bestResult.score) : null
        const isPassed = bestResult ? bestResult.is_passed === 1 : false

        // 判断考试状态（未开始、进行中、已结束）
        const startTime = new Date(plan.start_time)
        const endTime = new Date(plan.end_time)

        let examStatus = 'not_started' // 未开始
        let examStatusText = '未开始'

        if (currentTime >= startTime && currentTime <= endTime) {
          examStatus = 'ongoing' // 进行中
          examStatusText = '进行中'
        } else if (currentTime > endTime) {
          examStatus = 'ended' // 已结束
          examStatusText = '已结束'
        }

        // 检查是否有进行中的考试
        const inProgressResult = resultRows.find(r => r.status === 'in_progress')

        // 如果有 in_progress 的记录,检查是否有答案记录来区分"开始答题"和"继续答题"
        let hasAnswers = false
        if (inProgressResult) {
          const [answerCount] = await pool.query(
            'SELECT COUNT(*) as count FROM answer_records WHERE result_id = ?',
            [inProgressResult.id]
          )
          hasAnswers = answerCount[0].count > 0
        }

        // 构建考试信息
        myExams.push({
          plan_id: plan.id,
          source_type: 'assessment_plan',
          plan_title: plan.title,
          plan_description: plan.description,
          plan_status: plan.plan_status,
          exam_id: plan.exam_id,
          exam_title: plan.exam_title,
          exam_description: plan.exam_description,
          exam_category: plan.exam_category,
          exam_difficulty: plan.exam_difficulty,
          exam_duration: plan.exam_duration,
          exam_total_score: parseFloat(plan.exam_total_score),
          exam_pass_score: parseFloat(plan.exam_pass_score),
          exam_question_count: plan.exam_question_count,
          start_time: plan.start_time,
          end_time: plan.end_time,
          exam_status: examStatus,
          exam_status_text: examStatusText,
          max_attempts: plan.max_attempts,
          attempt_count: attemptCount,
          remaining_attempts: remainingAttempts,
          best_score: bestScore,
          is_passed: isPassed,
          has_in_progress: !!inProgressResult && hasAnswers,  // 有答案才算"继续答题"
          has_not_started: !!inProgressResult && !hasAnswers,  // 没答案算"开始答题"
          in_progress_result_id: inProgressResult ? inProgressResult.id : null,
          can_start: examStatus === 'ongoing' && remainingAttempts > 0 && !inProgressResult,
          all_attempts: resultRows.map(r => ({
            result_id: r.id,
            attempt_number: r.attempt_number,
            start_time: r.start_time,
          submit_time: r.submit_time,
            duration: r.duration,
            score: r.score ? parseFloat(r.score) : null,
            is_passed: r.is_passed === 1,
            status: r.status
          }))
        })
      }

      // 按考试状态和开始时间排序
      // 优先级：进行中 > 未开始 > 已结束
      try {
        myExams.sort((a, b) => {
          const statusPriority = { 'ongoing': 1, 'not_started': 2, 'ended': 3 }
          const aPriority = statusPriority[a.exam_status] || 4
          const bPriority = statusPriority[b.exam_status] || 4

          if (aPriority !== bPriority) {
            return aPriority - bPriority
          }

          // 相同状态按开始时间排序（最近的在前）
          return new Date(b.start_time) - new Date(a.start_time)
        })
      } catch (sortError) {
        console.error('排序失败:', sortError)
      }

      // 统计信息
      const statistics = {
        total_exams: myExams.length,
        ongoing_exams: myExams.filter(e => e.exam_status === 'ongoing').length,
        not_started_exams: myExams.filter(e => e.exam_status === 'not_started').length,
        ended_exams: myExams.filter(e => e.exam_status === 'ended').length,
        passed_exams: myExams.filter(e => e.is_passed).length,
        failed_exams: myExams.filter(e => e.best_score !== null && !e.is_passed).length,
        not_attempted_exams: myExams.filter(e => e.attempt_count === 0).length
      }

      return {
        success: true,
        data: {
          exams: myExams,
          statistics: statistics,
          current_time: currentTime.toISOString()
        }
      }
    } catch (error) {
      console.error('获取我的考试列表失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 删除考核计划
  // DELETE /api/assessment-plans/:id
  // 软删除：设置 is_deleted = 1
  fastify.delete('/api/assessment-plans/:id', async (request, reply) => {
    try {
      const { id } = request.params

      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      // 获取考核计划信息
      const [planRows] = await pool.query(
        'SELECT id, title, status FROM assessment_plans WHERE id = ?',
        [id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '考核计划不存在'
        })
      }

      // 软删除
      await pool.query(
        'UPDATE assessment_plans SET is_deleted = 1 WHERE id = ?',
        [id]
      )

      return {
        success: true,
        message: '考核计划已删除'
      }
    } catch (error) {
      console.error('删除考核计划失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '删除失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  });
};
