// 考核计划管理 API
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

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
        target_users,
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

      // 验证 target_users（JSON 数组格式）
      let targetUsersJson = null
      let targetUserIds = []

      if (target_users !== undefined && target_users !== null) {
        // 验证是否为数组
        if (!Array.isArray(target_users)) {
          return reply.code(400).send({
            success: false,
            message: 'target_users 必须是数组格式'
          })
        }

        // 验证数组元素都是数字
        for (let i = 0; i < target_users.length; i++) {
          if (typeof target_users[i] !== 'number' || target_users[i] <= 0) {
            return reply.code(400).send({
              success: false,
              message: `target_users 中的用户ID必须是大于0的数字，位置 ${i} 的值无效`
            })
          }
        }

        // 去重
        targetUserIds = [...new Set(target_users)]

        // 验证用户是否存在
        if (targetUserIds.length > 0) {
          const placeholders = targetUserIds.map(() => '?').join(',')
          const [userRows] = await pool.query(
            `SELECT id FROM users WHERE id IN (${placeholders})`,
            targetUserIds
          )

          if (userRows.length !== targetUserIds.length) {
            const foundIds = userRows.map(u => u.id)
            const missingIds = targetUserIds.filter(id => !foundIds.includes(id))
            return reply.code(404).send({
              success: false,
              message: '部分用户不存在',
              data: {
                missing_user_ids: missingIds
              }
            })
          }
        }

        targetUsersJson = JSON.stringify(targetUserIds)
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
          target_users,
          start_time,
          end_time,
          max_attempts,
          status,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title.trim(),
          description || null,
          exam_id,
          targetUsersJson,
          mysqlStartTime,
          mysqlEndTime,
          maxAttempts,
          'draft', // 默认 status 为 'draft'
          decoded.id // 设置 created_by 为当前用户
        ]
      )

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
          target_user_count: targetUserIds.length,
          status: 'draft',
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

  // 获取考核计划详情
  // GET /api/assessment-plans/:id
  // 返回计划完整信息
  // 包含试卷详细信息
  // 解析 target_users JSON 返回用户列表
  // 统计完成情况（已完成/总人数）
  // 统计通过率
  fastify.get('/api/assessment-plans/:id', async (request, reply) => {
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
   // 获取考核计划基本信息
      const [planRows] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.description,
          ap.exam_id,
          ap.target_users,
          ap.start_time,
          ap.end_time,
          ap.max_attempts,
          ap.status,
          ap.created_by,
          ap.created_at,
          ap.updated_at,
          u.username as creator_username,
          u.real_name as creator_name
        FROM assessment_plans ap
        LEFT JOIN users u ON ap.created_by = u.id
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

      // 获取试卷详细信息
      const [examRows] = await pool.query(
        `SELECT
          e.id,
          e.title,
          e.description,
          e.category,
          e.difficulty,
          e.duration,
          e.total_score,
          e.pass_score,
          e.question_count,
          e.status
        FROM exams e
        WHERE e.id = ?`,
        [plan.exam_id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '关联的试卷不存在'
        })
      }

      const exam = examRows[0]

      // 解析 target_users JSON 返回用户列表
      let targetUsers = []
      let targetUserIds = []

      if (plan.target_users) {
        try {
          // MySQL 可能已经自动解析了 JSON，所以先检查类型
          targetUserIds = typeof plan.target_users === 'string'
            ? JSON.parse(plan.target_users)
            : plan.target_users

          if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
            // 获取目标用户的详细信息
            const placeholders = targetUserIds.map(() => '?').join(',')
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
              WHERE u.id IN (${placeholders})`,
              targetUserIds
            )
            targetUsers = userRows
          }
        } catch (error) {
          console.error('解析 target_users JSON 失败:', error)
          // 如果解析失败，继续执行，但 targetUsers 为空数组
        }
      }

      // 统计完成情况（已完成/总人数）
      const totalUsers = targetUserIds.length
      let completedCount = 0
      let passedCount = 0

      if (totalUsers > 0) {
        // 统计已完成的用户数（status 为 'submitted' 或 'graded'）
        const placeholders = targetUserIds.map(() => '?').join(',')
        const [completedRows] = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as completed_count
          FROM assessment_results
          WHERE plan_id = ?
            AND user_id IN (${placeholders})
            AND status IN ('submitted', 'graded')`,
          [id, ...targetUserIds]
        )
        completedCount = completedRows[0].completed_count

        // 统计通过的用户数
        const [passedRows] = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as passed_count
          FROM assessment_results
          WHERE plan_id = ?
            AND user_id IN (${placeholders})
            AND is_passed = 1
            AND status IN ('submitted', 'graded')`,
          [id, ...targetUserIds]
        )
        passedCount = passedRows[0].passed_count
      }

      // 计算通过率
      const passRate = completedCount > 0 ? (passedCount / completedCount * 100).toFixed(2) : 0

      // 获取每个用户的考试情况
      const participantDetails = []
      for (const user of targetUsers) {
        // 获取该用户的考试记录
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

        const hasCompleted = resultRows.some(r => r.status === 'submitted' || r.status === 'graded')
        const bestResult = resultRows.find(r => r.status === 'submitted' || r.status === 'graded')
        const attemptCount = resultRows.length

        participantDetails.push({
          user_id: user.id,
          username: user.username,
          real_name: user.real_name,
          email: user.email,
          phone: user.phone,
          department_id: user.department_id,
          department_name: user.department_name,
          has_completed: hasCompleted,
          attempt_count: attemptCount,
          best_score: bestResult ? parseFloat(bestResult.score) : null,
          is_passed: bestResult ? bestResult.is_passed === 1 : false,
          last_submit_time: bestResult ? bestResult.submit_time : null
        })
      }

      // 构建返回数据
      const result = {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        exam_id: plan.exam_id,
        start_time: plan.start_time,
        end_time: plan.end_time,
        max_attempts: plan.max_attempts,
        status: plan.status,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        creator: plan.created_by ? {
          id: plan.created_by,
          username: plan.creator_username,
          name: plan.creator_name
        } : null,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          category: exam.category,
          difficulty: exam.difficulty,
          duration: exam.duration,
          total_score: parseFloat(exam.total_score),
          pass_score: parseFloat(exam.pass_score),
          question_count: exam.question_count,
          status: exam.status
        },
        target_users: targetUsers,
        participants: participantDetails,
        statistics: {
          total_users: totalUsers,
          completed_count: completedCount,
          passed_count: passedCount,
          pass_rate: parseFloat(passRate),
          completion_rate: totalUsers > 0 ? ((completedCount / totalUsers) * 100).toFixed(2) : 0
        }
      }

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('获取考核计划详情失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

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
        'SELECT id, title, exam_id, status FROM assessment_plans WHERE id = ?',
        [id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '考核计划不存在'
        })
      }

      const existingPlan = planRows[0]

      // 验证计划状态（ongoing/completed 限制修改）
      if (existingPlan.status === 'ongoing' || existingPlan.status === 'completed') {
        return reply.code(400).send({
          success: false,
          message: `无法修改${existingPlan.status === 'ongoing' ? '进行中' : '已完成'}的考核计划`,
          data: {
            plan_id: existingPlan.id,
            current_status: existingPlan.status
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
      if (target_users !== undefined) {
        let targetUsersJson = null
        let targetUserIds = []

        if (target_users !== null) {
          // 验证是否为数组
          if (!Array.isArray(target_users)) {
            return reply.code(400).send({
              success: false,
              message: 'target_users 必须是数组格式'
            })
          }

          // 验证数组元素都是数字
          for (let i = 0; i < target_users.length; i++) {
            if (typeof target_users[i] !== 'number' || target_users[i] <= 0) {
              return reply.code(400).send({
                success: false,
                message: `target_users 中的用户ID必须是大于0的数字，位置 ${i} 的值无效`
              })
            }
          }

          // 去重
          targetUserIds = [...new Set(target_users)]

          // 验证用户是否存在
          if (targetUserIds.length > 0) {
            const placeholders = targetUserIds.map(() => '?').join(',')
            const [userRows] = await pool.query(
              `SELECT id FROM users WHERE id IN (${placeholders})`,
              targetUserIds
            )

            if (userRows.length !== targetUserIds.length) {
              const foundIds = userRows.map(u => u.id)
              const missingIds = targetUserIds.filter(id => !foundIds.includes(id))
              return reply.code(404).send({
                success: false,
                message: '部分用户不存在',
                data: {
                  missing_user_ids: missingIds
                }
              })
            }
          }

          targetUsersJson = JSON.stringify(targetUserIds)
        }

        updateFields.push('target_users = ?')
        updateValues.push(targetUsersJson)
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
          ap.target_users,
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

      // 解析 target_users
      let targetUserCount = 0
      if (updatedPlan.target_users) {
        try {
          const userIds = typeof updatedPlan.target_users === 'string'
            ? JSON.parse(updatedPlan.target_users)
            : updatedPlan.target_users
          targetUserCount = Array.isArray(userIds) ? userIds.length : 0
        } catch (error) {
          console.error('解析 target_users 失败:', error)
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
          target_user_count: targetUserCount,
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

  // 更新计划状态
  // PUT /api/assessment-plans/:id/status
  // 支持状态转换
  // draft -> published（发布）
  // published -> ongoing（自动或手动开始）
  // ongoing -> completed（自动或手动完成）
  // * -> cancelled（取消）
  fastify.put('/api/assessment-plans/:id/status', async (request, reply) => {
    try {
      const { id } = request.params
      const { status } = request.body

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

      // 验证状态参数
      const validStatuses = ['draft', 'published', 'ongoing', 'completed', 'cancelled']
      if (!status || !validStatuses.includes(status)) {
        return reply.code(400).send({
          success: false,
          message: '无效的状态值',
          data: {
            valid_statuses: validStatuses,
            provided_status: status
          }
        })
      }

      // 获取当前计划信息
      const [planRows] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.status,
          ap.exam_id,
          ap.start_time,
          ap.end_time,
          e.question_count,
          e.total_score
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
      const currentStatus = plan.status

      // 如果状态相同，不需要更新
      if (currentStatus === status) {
        return reply.code(400).send({
          success: false,
          message: '计划状态已经是目标状态',
          data: {
            current_status: currentStatus,
            target_status: status
          }
        })
      }

      // 验证状态转换规则
      const allowedTransitions = {
        'draft': ['published', 'cancelled'],
        'published': ['ongoing', 'cancelled'],
        'ongoing': ['completed', 'cancelled'],
        'completed': ['cancelled'],
        'cancelled': []
      }

      const allowedNextStatuses = allowedTransitions[currentStatus] || []

      if (!allowedNextStatuses.includes(status)) {
        return reply.code(400).send({
          success: false,
          message: `不允许从 ${currentStatus} 状态转换到 ${status} 状态`,
          data: {
            current_status: currentStatus,
            target_status: status,
            allowed_transitions: allowedNextStatuses
          }
        })
      }

      // 发布前的验证
      if (status === 'published' && currentStatus === 'draft') {
        // 验证试卷是否有题目
        if (!plan.question_count || plan.question_count === 0) {
          return reply.code(400).send({
            success: false,
            message: '试卷没有题目，无法发布考核计划',
            data: {
              exam_id: plan.exam_id,
              question_count: plan.question_count
            }
          })
        }

        // 验证时间范围
        const now = new Date()
        const endTime = new Date(plan.end_time)

        if (endTime <= now) {
          return reply.code(400).send({
            success: false,
            message: '考核结束时间已过，无法发布',
            data: {
              end_time: plan.end_time,
              current_time: now.toISOString()
            }
          })
        }
      }

      // 开始考核的验证
      if (status === 'ongoing' && currentStatus === 'published') {
        const now = new Date()
        const startTime = new Date(plan.start_time)
        const endTime = new Date(plan.end_time)

        // 检查是否在考核时间范围内
        if (now < startTime) {
          return reply.code(400).send({
            success: false,
            message: '考核尚未开始',
            data: {
              start_time: plan.start_time,
              current_time: now.toISOString()
            }
          })
        }

        if (now > endTime) {
          return reply.code(400).send({
            success: false,
            message: '考核已结束',
            data: {
              end_time: plan.end_time,
              current_time: now.toISOString()
            }
          })
        }
      }

      // 完成考核的验证
      if (status === 'completed' && currentStatus === 'ongoing') {
        // 可以手动完成，不需要额外验证
        // 或者可以检查是否所有人都已完成考试
      }

      // 更新状态
      await pool.query(
        'UPDATE assessment_plans SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, id]
      )

      // 记录状态变更日志（可选）
      // 这里可以添加日志记录逻辑

      return {
        success: true,
        message: `考核计划状态已更新为 ${status}`,
        data: {
          id: plan.id,
          title: plan.title,
          previous_status: currentStatus,
          current_status: status,
          updated_at: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('更新考核计划状态失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '状态更新失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
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
          ap.target_users,
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

      // 解析 target_users JSON
      let targetUserIds = []
      if (plan.target_users) {
        try {
          targetUserIds = typeof plan.target_users === 'string'
            ? JSON.parse(plan.target_users)
            : plan.target_users

          if (!Array.isArray(targetUserIds)) {
            targetUserIds = []
          }
        } catch (error) {
          console.error('解析 target_users JSON 失败:', error)
          targetUserIds = []
        }
      }

      if (targetUserIds.length === 0) {
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

      // 获取目标用户的详细信息
      const placeholders = targetUserIds.map(() => '?').join(',')
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
        WHERE u.id IN (${placeholders})`,
        targetUserIds
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

      // 获取所有考核计划
      const [allPlans] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.description,
          ap.exam_id,
          ap.target_users,
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
        WHERE ap.status IN ('published', 'ongoing', 'completed')
        ORDER BY ap.start_time DESC`
      )

      // 筛选当前用户可参加的考试
      const myExams = []

      for (const plan of allPlans) {
        // 解析 target_users JSON
        let targetUserIds = []
        if (plan.target_users) {
          try {
            targetUserIds = typeof plan.target_users === 'string'
              ? JSON.parse(plan.target_users)
              : plan.target_users

            if (!Array.isArray(targetUserIds)) {
              targetUserIds = []
            }
          } catch (error) {
            console.error(`计划 ${plan.id} 的 target_users 解析失败:`, error)
            continue
          }
        }

        // 检查当前用户是否在目标用户列表中
        if (!targetUserIds.includes(userId)) {
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

        // 构建考试信息
        myExams.push({
          plan_id: plan.id,
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
          has_in_progress: !!inProgressResult,
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
  // 检查计划状态（ongoing/completed 不可删除）
  // 检查是否有考试记录
  // 级联删除相关 assessment_results 和 answer_records
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

      const plan = planRows[0]

      // 检查计划状态（ongoing/completed 不可删除）
      if (plan.status === 'ongoing' || plan.status === 'completed') {
        return reply.code(400).send({
          success: false,
          message: `无法删除${plan.status === 'ongoing' ? '进行中' : '已完成'}的考核计划`,
          data: {
            plan_id: plan.id,
            plan_title: plan.title,
            current_status: plan.status
          }
        })
      }

      // 检查是否有考试记录
      const [resultRows] = await pool.query(
        'SELECT COUNT(*) as count FROM assessment_results WHERE plan_id = ?',
        [id]
      )

      const hasResults = resultRows[0].count > 0

      if (hasResults) {
        // 如果有考试记录，级联删除相关 assessment_results 和 answer_records
        // 首先获取所有相关的 result_id
        const [resultIds] = await pool.query(
          'SELECT id FROM assessment_results WHERE plan_id = ?',
          [id]
        )

        if (resultIds.length > 0) {
          const resultIdList = resultIds.map(r => r.id)
          const placeholders = resultIdList.map(() => '?').join(',')

          // 删除 answer_records（由于外键约束，这会自动级联删除）
          // 但为了明确性，我们显式删除
          await pool.query(
            `DELETE FROM answer_records WHERE result_id IN (${placeholders})`,
            resultIdList
          )

          // 删除 assessment_results
          await pool.query(
            'DELETE FROM assessment_results WHERE plan_id = ?',
            [id]
          )
        }
      }

      // 删除考核计划
      await pool.query(
        'DELETE FROM assessment_plans WHERE id = ?',
        [id]
      )

      return {
        success: true,
        message: '考核计划删除成功',
        data: {
          id: plan.id,
          title: plan.title,
          deleted_results: hasResults ? resultRows[0].count : 0
        }
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
  })
}
