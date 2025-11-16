// 考核结果管理 API
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 开始考试
  // POST /api/assessment-results/start
  // 参数：plan_id
  // 验证考核计划状态和时间
  // 验证用户在 target_users 中
  // 验证尝试次数限制
  // 创建 assessment_results 记录
  // 设置 status 为 'in_progress'
  // 记录 start_time
  // 返回试卷题目（不含 correct_answer）
  // 返回 result_id 用于后续操作
  fastify.post('/api/assessment-results/start', async (request, reply) => {
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
      const { plan_id } = request.body

      // 验证必填字段
      if (!plan_id) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：plan_id'
        })
      }

      // 验证 plan_id 格式
      if (typeof plan_id !== 'number' || plan_id <= 0) {
        return reply.code(400).send({
          success: false,
          message: '考核计划ID必须是大于0的数字'
        })
      }

      // 获取考核计划信息
      const [planRows] = await pool.query(
        `SELECT
          ap.id,
          ap.title,
          ap.exam_id,
          ap.target_users,
          ap.start_time,
          ap.end_time,
          ap.max_attempts,
          ap.status,
          e.id as exam_id,
          e.title as exam_title,
          e.duration,
          e.total_score,
          e.pass_score,
          e.question_count,
          e.status as exam_status
        FROM assessment_plans ap
        INNER JOIN exams e ON ap.exam_id = e.id
        WHERE ap.id = ?`,
        [plan_id]
      )

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '考核计划不存在'
        })
      }

      const plan = planRows[0]

      // 验证考核计划状态（必须是 published 或 ongoing）
      if (plan.status !== 'published' && plan.status !== 'ongoing') {
        return reply.code(400).send({
          success: false,
          message: `考核计划状态为 ${plan.status}，无法开始考试`,
          data: {
            plan_id: plan.id,
            plan_title: plan.title,
            plan_status: plan.status,
            allowed_statuses: ['published', 'ongoing']
          }
        })
      }

      // 验证考核时间范围
      const now = new Date()
      const startTime = new Date(plan.start_time)
      const endTime = new Date(plan.end_time)

      if (now < startTime) {
        return reply.code(400).send({
          success: false,
          message: '考核尚未开始',
          data: {
            start_time: plan.start_time,
            current_time: now.toISOString(),
            time_until_start: Math.ceil((startTime - now) / 1000 / 60) + ' 分钟'
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

      // 验证用户在 target_users 中
      let targetUserIds = []
      if (plan.target_users) {
        try {
          targetUserIds = typeof plan.target_users === 'string'
            ? JSON.parse(plan.target_users)
            : plan.target_users
        } catch (error) {
          console.error('解析 target_users 失败:', error)
          return reply.code(500).send({
            success: false,
            message: '考核计划配置错误'
          })
        }
      }

      if (!Array.isArray(targetUserIds) || !targetUserIds.includes(userId)) {
        return reply.code(403).send({
          success: false,
          message: '您不在此考核计划的目标用户列表中',
          data: {
            user_id: userId,
            plan_id: plan.id,
            plan_title: plan.title
          }
        })
      }

      // 验证尝试次数限制
      const [attemptRows] = await pool.query(
        `SELECT COUNT(*) as attempt_count
        FROM assessment_results
        WHERE plan_id = ? AND user_id = ?`,
        [plan_id, userId]
      )

      const currentAttemptCount = attemptRows[0].attempt_count

      if (currentAttemptCount >= plan.max_attempts) {
        return reply.code(400).send({
          success: false,
          message: '已达到最大尝试次数限制',
          data: {
            max_attempts: plan.max_attempts,
            current_attempts: currentAttemptCount
          }
        })
      }

      // 检查是否有进行中的考试
      const [inProgressRows] = await pool.query(
        `SELECT id, start_time
        FROM assessment_results
        WHERE plan_id = ? AND user_id = ? AND status = 'in_progress'
        ORDER BY start_time DESC
        LIMIT 1`,
        [plan_id, userId]
      )

      if (inProgressRows.length > 0) {
        const inProgressResult = inProgressRows[0]

        // 检查是否超时
        const examStartTime = new Date(inProgressResult.start_time)
        const examDuration = plan.duration * 60 * 1000 // 转换为毫秒
        const examEndTime = new Date(examStartTime.getTime() + examDuration)

        if (now < examEndTime) {
          // 考试还在进行中，返回现有的考试
          return reply.code(400).send({
            success: false,
            message: '您有一场正在进行的考试',
            data: {
              result_id: inProgressResult.id,
              start_time: inProgressResult.start_time,
              remaining_time: Math.ceil((examEndTime - now) / 1000 / 60) + ' 分钟'
            }
          })
        } else {
          // 考试已超时，自动标记为过期
          await pool.query(
            `UPDATE assessment_results
            SET status = 'expired', updated_at = NOW()
            WHERE id = ?`,
            [inProgressResult.id]
          )
        }
      }

      // 开始事务
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 计算下一次尝试编号
        const nextAttemptNumber = currentAttemptCount + 1

        // 创建 assessment_results 记录
        const [resultInsert] = await connection.query(
          `INSERT INTO assessment_results (
            plan_id,
            exam_id,
            user_id,
            attempt_number,
            start_time,
            status
          ) VALUES (?, ?, ?, ?, NOW(), 'in_progress')`,
          [plan_id, plan.exam_id, userId, nextAttemptNumber]
        )

        const resultId = resultInsert.insertId

        // 如果计划状态是 published，自动更新为 ongoing
        if (plan.status === 'published') {
          await connection.query(
            `UPDATE assessment_plans
            SET status = 'ongoing', updated_at = NOW()
            WHERE id = ?`,
            [plan_id]
          )
        }

        await connection.commit()

        // 获取试卷题目（不含 correct_answer 和 explanation）
        const [questions] = await pool.query(
          `SELECT
            id,
            exam_id,
            type,
            content,
            options,
            score,
            order_num
          FROM questions
          WHERE exam_id = ?
          ORDER BY order_num ASC`,
          [plan.exam_id]
        )

        // 格式化题目数据
        const formattedQuestions = questions.map(q => {
          // 安全解析 options JSON
          let parsedOptions = null
          if (q.options) {
            try {
              parsedOptions = JSON.parse(q.options)
            } catch (error) {
              console.error(`题目 ${q.id} 的 options 字段 JSON 解析失败:`, error.message)
              parsedOptions = q.options
            }
          }

          return {
            id: q.id,
            exam_id: q.exam_id,
            type: q.type,
            content: q.content,
            options: parsedOptions,
            score: parseFloat(q.score),
            order_num: q.order_num
          }
        })

        // 计算考试结束时间
        const examStartTime = new Date()
        const examEndTime = new Date(examStartTime.getTime() + plan.duration * 60 * 1000)

        return {
          success: true,
          message: '考试开始成功',
          data: {
            result_id: resultId,
            plan_id: plan.id,
            plan_title: plan.title,
            exam_id: plan.exam_id,
            exam_title: plan.exam_title,
            attempt_number: nextAttemptNumber,
            max_attempts: plan.max_attempts,
            start_time: examStartTime.toISOString(),
            end_time: examEndTime.toISOString(),
            duration: plan.duration, // 分钟
            total_score: parseFloat(plan.total_score),
            pass_score: parseFloat(plan.pass_score),
            question_count: plan.question_count,
            questions: formattedQuestions
          }
        }
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('开始考试失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '开始考试失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })
}
