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
          ap.target_departments,
          ap.start_time,
          ap.end_time,
          ap.max_attempts,
          e.duration,
          e.questions,
          e.title as exam_title
        FROM assessment_plans ap
        LEFT JOIN exams e ON ap.exam_id = e.id
        WHERE ap.id = ?`,
        [plan_id]
      );

      if (planRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '考核计划不存在'
        });
      }

      const plan = planRows[0];

      // 当前时间，用于后续时间范围校验
      const now = new Date();

      // 验证考核时间范围（只要在 start_time 与 end_time 之间即可）
      const startTime = new Date(plan.start_time);
      const endTime = new Date(plan.end_time);
      if (now < startTime) {
        return reply.code(400).send({
          success: false,
          message: '考核尚未开始',
          data: {
            start_time: plan.start_time,
            current_time: now.toISOString(),
            time_until_start: Math.ceil((startTime - now) / 1000 / 60) + ' 分钟'
          }
        });
      }
      if (now > endTime) {
        return reply.code(400).send({
          success: false,
          message: '考核已结束',
          data: {
            end_time: plan.end_time,
            current_time: now.toISOString()
          }
        });
      }

      // 验证用户是否在目标部门列表中
      let targetDeptIds = [];
      if (plan.target_departments) {
        try {
          targetDeptIds = typeof plan.target_departments === 'string'
            ? JSON.parse(plan.target_departments)
            : plan.target_departments;
        } catch (error) {
          console.error('解析 target_departments 失败:', error);
          return reply.code(500).send({
            success: false,
            message: '考核计划配置错误（部门数据）'
          });
        }
      }
      const [userRows] = await pool.query(
        'SELECT department_id FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '用户不存在'
        });
      }
      const userDeptId = userRows[0].department_id;

      // Debug logging for department validation
      console.log('Checking department validation:', {
        userId,
        userDeptId,
        planTargetDeptsRaw: plan.target_departments,
        targetDeptIdsParsed: targetDeptIds
      });

      if (!Array.isArray(targetDeptIds) || !targetDeptIds.includes(userDeptId)) {
        console.warn(`User ${userId} (Dept ${userDeptId}) not in target departments: ${JSON.stringify(targetDeptIds)}`);
        return reply.code(403).send({
          success: false,
          message: '您不在此考核计划的目标部门列表中',
          data: {
            user_id: userId,
            user_department_id: userDeptId,
            plan_id: plan.id,
            plan_title: plan.title,
            target_departments: targetDeptIds
          }
        });
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

        // 移除自动更新计划状态的逻辑 (status 字段已废弃，由时间自动控制)
        // if (plan.status === 'published') { ... }

        await connection.commit()

        // 获取试卷题目 (从 JSON 字段解析)
        let questions = []
        try {
          questions = typeof plan.questions === 'string' ? JSON.parse(plan.questions) : (plan.questions || [])
        } catch (e) {
          console.error('解析题目 JSON 失败:', e)
          questions = []
        }

        // 格式化题目数据
        const formattedQuestions = questions.map(q => {
          // 确保 options 是数组
          let parsedOptions = q.options
          if (typeof parsedOptions === 'string') {
            try {
              parsedOptions = JSON.parse(parsedOptions)
            } catch (e) {
              parsedOptions = parsedOptions.split(/,|，/).map(opt => opt.trim()).filter(Boolean)
            }
          }

          return {
            id: q.id,
            exam_id: plan.exam_id,
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
            exam_title: plan.title, // plan.title 实际上是 assessment_plans.title，这里可能需要 exam title，但 SQL 只查了 plan title
            attempt_number: nextAttemptNumber,
            max_attempts: plan.max_attempts,
            start_time: examStartTime.toISOString(),
            end_time: examEndTime.toISOString(),
            duration: plan.duration, // 分钟
            total_score: parseFloat(plan.total_score), // 注意：这里使用的是 plan 表里的 total_score，可能需要确认是否一致
            pass_score: parseFloat(plan.pass_score), // 同上
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

  // 获取考试进度
  // GET /api/assessment-results/:id
  // 参数：id (assessment_result_id)
  // 验证用户权限（只能查看自己的）
  // 返回考试基本信息
  // 返回已保存的答案
  // 计算剩余时间
  // 返回答题进度
  fastify.get('/api/assessment-results/:id', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const userId = decoded.id
      const resultId = parseInt(request.params.id)

      // 验证 resultId 格式
      if (isNaN(resultId) || resultId <= 0) {
        return reply.code(400).send({ success: false, message: '考核结果ID无效' })
      }

      // 获取考核结果信息
      const [resultRows] = await pool.query(
        `SELECT
          ar.id,
          ar.plan_id,
          ar.exam_id,
          ar.user_id,
          ar.attempt_number,
          ar.start_time,
          ar.submit_time,
          ar.status,
          ap.title as plan_title,
          ap.max_attempts,
          e.title as exam_title,
          e.duration as exam_duration,
          e.total_score,
          e.pass_score,
          e.question_count
        FROM assessment_results ar
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        WHERE ar.id = ?`,
        [resultId]
      )

      if (resultRows.length === 0) {
        return reply.code(404).send({ success: false, message: '考核结果不存在' })
      }

      const result = resultRows[0]

      // 权限验证：只能查看自己的或管理员可以查看
      // 首先检查是否是自己的记录
      if (result.user_id === userId) {
        // 是自己的记录，允许访问
      } else {
        // 不是自己的记录，检查是否是管理员
        // 从数据库查询用户角色
        const [userRows] = await pool.query(
          'SELECT id FROM users WHERE id = ? AND username = "admin"',
          [userId]
        );

        if (userRows.length === 0) {
          // 不是管理员，拒绝访问
          return reply.code(403).send({ success: false, message: '无权查看此考核结果' });
        }
      }

      // 获取已保存的答案 (从 answer_records 表中获取)
      let savedAnswers = {}
      const [answerRows] = await pool.query(
        `SELECT question_id, user_answer FROM answer_records WHERE result_id = ?`,
        [resultId]
      )
      
      // 将答案转换为对象格式 {question_id: user_answer}
      answerRows.forEach(row => {
        savedAnswers[row.question_id] = row.user_answer
      })

      // 计算剩余时间
      let remainingTime = 0 // seconds
      const now = new Date()
      const startTime = new Date(result.start_time)
      const examDurationSeconds = result.exam_duration * 60 // 使用试卷的时长(分钟转秒)

      if (result.status === 'in_progress') {
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        remainingTime = Math.max(0, examDurationSeconds - elapsedSeconds)
      }

      // 获取试卷题目(从 exams.questions JSON 字段)
      const [examRows] = await pool.query(
        `SELECT questions FROM exams WHERE id = ?`,
        [result.exam_id]
      )

      let questions = []
      if (examRows.length > 0 && examRows[0].questions) {
        try {
          questions = typeof examRows[0].questions === 'string'
            ? JSON.parse(examRows[0].questions)
            : examRows[0].questions
        } catch (e) {
          console.error('解析题目JSON失败:', e)
          questions = []
        }
      }

      // 格式化题目数据(不含 correct_answer 和 explanation)
      const formattedQuestions = questions.map(q => {
        let parsedOptions = q.options
        if (typeof parsedOptions === 'string') {
          try {
            parsedOptions = JSON.parse(parsedOptions)
          } catch (error) {
            console.error(`题目 ${q.id} 的 options 字段 JSON 解析失败:`, error.message)
            parsedOptions = parsedOptions.split(/,|，/).map(opt => opt.trim()).filter(Boolean)
          }
        }

        return {
          id: q.id,
          exam_id: result.exam_id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          score: q.score,
          order_num: q.order_num
        }
      })

      // 计算答题进度
      const answeredCount = Object.keys(savedAnswers).length
      const totalQuestions = formattedQuestions.length

      return {
        success: true,
        data: {
          id: result.id,
          plan_id: result.plan_id,
          exam_id: result.exam_id,
          user_id: result.user_id,
          attempt_number: result.attempt_number,
          start_time: result.start_time,
          submit_time: result.submit_time,
          status: result.status,
          plan_title: result.plan_title,
          exam_title: result.exam_title,
          duration: result.exam_duration, // 使用试卷时长
          total_score: result.total_score,
          pass_score: result.pass_score,
          question_count: result.question_count,
          questions: formattedQuestions,
          saved_answers: savedAnswers,
          remaining_time: remainingTime,
          answered_count: answeredCount,
          total_questions: totalQuestions,
          progress: totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
        }
      }
    } catch (error) {
      console.error('获取考核结果详情失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取考核结果详情失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 保存答案
  // PUT /api/assessment-results/:id/answer
  // 参数：question_id, user_answer OR answers (object)
  // 验证考试状态（in_progress）
  // 验证考试时间（未超时）
  // 创建或更新 answer_records
  // 自动保存，不评分
  // 返回保存状态
  fastify.put('/api/assessment-results/:id/answer', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const userId = decoded.id
      const resultId = parseInt(request.params.id)
      const { question_id, user_answer, answers } = request.body

      console.log('保存答案请求参数:', { resultId, question_id, user_answer, answers });

      // 验证必填字段
      if ((!question_id || user_answer === undefined) && !answers) {
        return reply.code(400).send({ success: false, message: '缺少必填字段：question_id/user_answer 或 answers' })
      }

      // 验证 resultId 格式
      if (isNaN(resultId) || resultId <= 0) {
        return reply.code(400).send({ success: false, message: '考核结果ID无效' })
      }

      // 获取考核结果信息
      const [resultRows] = await pool.query(
        `SELECT
          ar.id,
          ar.plan_id,
          ar.exam_id,
          ar.user_id,
          ar.start_time,
          ar.status,
          e.duration as exam_duration
        FROM assessment_results ar
        INNER JOIN exams e ON ar.exam_id = e.id
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        WHERE ar.id = ?`,
        [resultId]
      )

      if (resultRows.length === 0) {
        return reply.code(404).send({ success: false, message: '考核结果不存在' })
      }

      const result = resultRows[0]

      console.log('考核结果信息:', result);

      // 权限验证：只能保存自己的答案
      if (result.user_id !== userId) {
        return reply.code(403).send({ success: false, message: '无权保存此考核结果的答案' })
      }

      // 验证考试状态（必须是 in_progress）
      if (result.status !== 'in_progress') {
        // 特殊处理：如果状态是 graded 但这是第一次保存答案，可能需要重置状态
        if (result.status === 'graded') {
          // 检查是否真的有答案记录
          const [answerCountRows] = await pool.query(
            `SELECT COUNT(*) as count FROM answer_records WHERE result_id = ?`,
            [resultId]
          )
          
          // 如果没有答案记录，说明是误标记为 graded，可以重置状态
          if (answerCountRows[0].count === 0) {
            await pool.query(
              `UPDATE assessment_results SET status = 'in_progress' WHERE id = ?`,
              [resultId]
            )
            // 重新获取更新后的状态
            const [updatedResultRows] = await pool.query(
              `SELECT status FROM assessment_results WHERE id = ?`,
              [resultId]
            )
            // 更新本地的 result.status 值
            if (updatedResultRows.length > 0) {
              result.status = updatedResultRows[0].status;
            }
          } else {
            return reply.code(400).send({ success: false, message: `考试状态为 ${result.status}，无法保存答案` })
          }
        } else {
          return reply.code(400).send({ success: false, message: `考试状态为 ${result.status}，无法保存答案` })
        }
      }

      // 验证考试时间（未超时）
      const now = new Date()
      const startTime = new Date(result.start_time)
      const examDurationSeconds = (result.exam_duration || result.plan_duration) * 60 // Use exam duration if available, else plan duration
      const examEndTime = new Date(startTime.getTime() + examDurationSeconds * 1000)

      if (now > examEndTime) {
        // 考试已超时，自动更新状态
        await pool.query(
          `UPDATE assessment_results
          SET status = 'expired', updated_at = NOW()
          WHERE id = ?`,
          [resultId]
        )
        return reply.code(400).send({ success: false, message: '考试已超时，无法保存答案' })
      }

      // Helper function to save a single answer
      const saveSingleAnswer = async (qId, ans) => {
        console.log('保存单个答案:', { resultId, qId, ans });
        
        // 验证 question_id 是否为有效的整数ID
        let questionIdInt = parseInt(qId);
        // 如果原始ID是字符串且以temp_开头，尝试提取数字部分
        if (typeof qId === 'string' && qId.startsWith('temp_')) {
          const numericPart = qId.replace('temp_', '');
          const parsedId = parseInt(numericPart);
          if (!isNaN(parsedId) && parsedId > 0) {
            questionIdInt = parsedId;
          }
        }
        
        // 如果转换后的ID无效，直接返回不处理
        if (isNaN(questionIdInt) || questionIdInt <= 0) {
          console.log('无效的题目ID:', qId);
          return;
        }
        
        // 验证 question_id 是否属于该试卷
        const [questionRows] = await pool.query(
          `SELECT id FROM questions WHERE id = ? AND exam_id = ?`,
          [questionIdInt, result.exam_id]
        )

        // 如果题目不存在于数据库中，也允许保存（可能是前端临时ID）
        // 但在提交时会过滤掉这些无效的答案

        // 检查是否已存在答案记录
        const [existingAnswerRows] = await pool.query(
          `SELECT id FROM answer_records WHERE result_id = ? AND question_id = ?`,
          [resultId, questionIdInt]
        )

        if (existingAnswerRows.length > 0) {
          // 更新答案
          console.log('更新已存在的答案记录:', existingAnswerRows[0].id);
          await pool.query(
            `UPDATE answer_records
            SET user_answer = ?, updated_at = NOW()
            WHERE result_id = ? AND question_id = ?`,
            [ans, resultId, questionIdInt]
          )
        } else {
          // 插入新答案
          console.log('插入新的答案记录');
          await pool.query(
            `INSERT INTO answer_records (result_id, question_id, user_answer)
            VALUES (?, ?, ?)`,
            [resultId, questionIdInt, ans]
          )
        }
      }

      if (answers) {
        console.log('批量保存答案:', answers);
        // Batch update - 处理所有题目ID，包括临时ID
        const promises = Object.entries(answers).map(([qId, ans]) => saveSingleAnswer(qId, ans));
        await Promise.all(promises);
      } else {
        console.log('单个保存答案:', { question_id, user_answer });
        // Single update
        await saveSingleAnswer(question_id, user_answer);
      }

      return { success: true, message: '答案保存成功' }
    } catch (error) {
      console.error('保存答案失败:', error)
      return reply.code(500).send({
        success: false,
        message: '保存答案失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 提交考试
  // POST /api/assessment-results/:id/submit
  // 验证考试状态（in_progress）
  // 更新 submit_time
  // 计算 duration（秒）
  // 自动评分客观题（single_choice, multiple_choice, true_false）
  // 填空题关键词匹配评分
  // 主观题标记待评分（is_correct = NULL）
  // 计算总分 score
  // 判断是否通过 is_passed
  // 更新状态为 'submitted' 或 'graded'
  // 返回考试结果
  fastify.post('/api/assessment-results/:id/submit', async (request, reply) => {
    const connection = await pool.getConnection()
    try {
      // 鉴权
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        connection.release()
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }
      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        connection.release()
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const resultId = parseInt(request.params.id)
      if (isNaN(resultId) || resultId <= 0) {
        connection.release()
        return reply.code(400).send({ success: false, message: '考核结果ID无效' })
      }

      await connection.beginTransaction()

      // 获取考试结果与配置
      const [resultRows] = await connection.query(
        `SELECT
          ar.id, ar.plan_id, ar.exam_id, ar.user_id, ar.start_time, ar.status,
          ap.max_attempts,
          e.title as exam_title, e.duration as exam_duration, e.total_score, e.pass_score
        FROM assessment_results ar
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        WHERE ar.id = ? FOR UPDATE`,
        [resultId]
      )
      if (resultRows.length === 0) {
        await connection.rollback(); connection.release()
        return reply.code(404).send({ success: false, message: '考核结果不存在' })
      }
      const result = resultRows[0]

      // 权限校验：只能提交自己的考试
      if (result.user_id !== decoded.id) {
        await connection.rollback(); connection.release()
        return reply.code(403).send({ success: false, message: '无权提交此考试' })
      }

      if (result.status !== 'in_progress') {
        await connection.rollback(); connection.release()
        return reply.code(400).send({ success: false, message: `考试状态为 ${result.status}，无法提交` })
      }

      // 取题目与已有答案
      const [questions] = await connection.query(
        `SELECT id, type, content, options, correct_answer, score, order_num FROM questions WHERE exam_id = ? ORDER BY order_num ASC`,
        [result.exam_id]
      )
      
      // 获取所有答案记录
      const [answerRows] = await connection.query(
        `SELECT id, question_id, user_answer, score, is_correct FROM answer_records WHERE result_id = ?`,
        [resultId]
      )
      
      // 创建有效答案的映射，过滤掉临时ID
      const validQuestionIds = new Set(questions.map(q => q.id));
      const answerMap = new Map();
      
      for (const answer of answerRows) {
        // 只保留有效的题目ID（在试卷中的题目）
        if (validQuestionIds.has(answer.question_id)) {
          answerMap.set(answer.question_id, answer);
        } else {
          // 删除无效的答案记录（临时ID）
          await connection.query(
            `DELETE FROM answer_records WHERE id = ?`,
            [answer.id]
          );
          console.log('删除无效答案记录:', answer.question_id);
        }
      }

      // 工具：解析 options、映射答案
      const parseOptions = (raw) => {
        if (!raw) return null
        try { return JSON.parse(raw) } catch { return raw }
      }
      const toLetter = (idx) => String.fromCharCode('A'.charCodeAt(0) + idx)
      const normalizeUserAnswerSingle = (q, userAnswer) => {
        if (!userAnswer) return null
        const options = parseOptions(q.options) || []
        // 如果 correct_answer 是字母，用户答案可能是选项文本或字母
        if (options && Array.isArray(options)) {
          const byTextIndex = options.findIndex(opt => opt === userAnswer)
          if (byTextIndex >= 0) return toLetter(byTextIndex)
        }
        return userAnswer
      }
      const normalizeUserAnswerMultiple = (q, userAnswer) => {
        if (!userAnswer) return []
        let arr
        try { arr = Array.isArray(userAnswer) ? userAnswer : JSON.parse(userAnswer) } catch { arr = [] }
        const options = parseOptions(q.options) || []
        const letters = arr.map(v => {
          const idx = options.findIndex(opt => opt === v)
          return idx >= 0 ? toLetter(idx) : v
        })
        // 去重排序
        return Array.from(new Set(letters)).sort()
      }

      // 评分
      let totalScore = 0
      let correctCount = 0
      let pendingManualCount = 0
      const detailedQuestions = []

      for (const q of questions) {
        const options = parseOptions(q.options)
        const correctRaw = q.correct_answer
        let userAnsRaw = answerMap.get(q.id)?.user_answer || null
        let isCorrect = null
        let earned = null

        if (q.type === 'single_choice') {
          const userLetter = normalizeUserAnswerSingle(q, userAnsRaw)
          isCorrect = userLetter && correctRaw ? (userLetter === correctRaw) : 0
          earned = isCorrect ? parseFloat(q.score) : 0
        } else if (q.type === 'multiple_choice') {
          const userLetters = normalizeUserAnswerMultiple(q, userAnsRaw)
          const correctLetters = correctRaw ? correctRaw.split('').sort() : []
          const fullCorrect = userLetters.length === correctLetters.length && userLetters.every((v, i) => v === correctLetters[i])
          const intersect = new Set(userLetters.filter(v => correctLetters.includes(v)))
          const ratio = correctLetters.length > 0 ? (intersect.size / correctLetters.length) : 0
          if (fullCorrect) {
            isCorrect = 1; earned = parseFloat(q.score)
          } else {
            isCorrect = intersect.size > 0 ? 0 : 0
            earned = parseFloat(q.score) * ratio
          }
        } else if (q.type === 'true_false') {
          const normalized = (userAnsRaw === 'true') ? 'A' : (userAnsRaw === 'false') ? 'B' : userAnsRaw
          isCorrect = normalized && correctRaw ? (normalized === correctRaw) : 0
          earned = isCorrect ? parseFloat(q.score) : 0
        } else if (q.type === 'fill_blank') {
          let keywords
          try { keywords = JSON.parse(correctRaw) } catch { keywords = (correctRaw || '').split(',').map(s => s.trim()).filter(Boolean) }
          let blanks
          try { blanks = Array.isArray(userAnsRaw) ? userAnsRaw : JSON.parse(userAnsRaw) } catch { blanks = userAnsRaw ? [userAnsRaw] : [] }
          const matchOne = (kw, ans) => ans && kw && ans.toLowerCase().includes(kw.toLowerCase())
          const matched = blanks.filter(ans => keywords.some(kw => matchOne(kw, ans))).length
          const ratio = blanks.length > 0 ? (matched / blanks.length) : 0
          isCorrect = matched === blanks.length ? 1 : 0
          earned = parseFloat(q.score) * ratio
        } else {
          // 主观题待评分
          pendingManualCount += 1
          isCorrect = null
          earned = null
        }

        // 汇总
        if (earned !== null) totalScore += parseFloat(earned || 0)
        if (isCorrect === 1) correctCount += 1

        // 更新/插入答题记录评分
        const existing = answerMap.get(q.id)
        if (existing) {
          await connection.query(
            `UPDATE answer_records SET score = ?, is_correct = ?, updated_at = NOW() WHERE id = ?`,
            [earned, isCorrect, existing.id]
          )
        } else {
          await connection.query(
            `INSERT INTO answer_records (result_id, question_id, user_answer, score, is_correct) VALUES (?, ?, ?, ?, ?)`,
            [resultId, q.id, userAnsRaw, earned, isCorrect]
          )
        }

        detailedQuestions.push({
          id: q.id,
          type: q.type,
          content: q.content,
          options,
          question_max_score: parseFloat(q.score),
          user_answer: userAnsRaw,
          user_score: earned !== null ? parseFloat(earned) : null,
          is_correct: isCorrect
        })
      }

      // 用时/状态
      const submitTime = new Date()
      const startTime = new Date(result.start_time)
      const durationSeconds = Math.max(0, Math.floor((submitTime.getTime() - startTime.getTime()) / 1000))
      const isPassed = totalScore >= parseFloat(result.pass_score) ? 1 : 0
      const newStatus = pendingManualCount === 0 ? 'graded' : 'submitted'

      await connection.query(
        `UPDATE assessment_results SET submit_time = ?, duration = ?, score = ?, is_passed = ?, status = ?, updated_at = NOW() WHERE id = ?`,
        [submitTime, durationSeconds, totalScore, isPassed, newStatus, resultId]
      )

      await connection.commit(); connection.release()

      // 构建返回
      return {
        success: true,
        message: '考试提交成功',
        data: {
          result_summary: {
            result_id: resultId,
            plan_id: result.plan_id,
            exam_id: result.exam_id,
            exam_title: result.exam_title,
            submit_time: submitTime,
            duration: durationSeconds,
            user_score: parseFloat(totalScore),
            exam_total_score: parseFloat(result.total_score),
            pass_score: parseFloat(result.pass_score),
            is_passed: isPassed === 1,
            question_count: questions.length,
            correct_count: correctCount,
            pending_grading_count: pendingManualCount
          },
          detailed_questions: detailedQuestions
        }
      }
    } catch (error) {
      try { await connection.rollback() } catch { }
      connection.release()
      console.error('提交考试失败:', error)
      return reply.code(500).send({ success: false, message: '提交考试失败' })
    }
  })


  // 查看考试结果
  // GET /api/assessment-results/:id/result
  // 验证用户权限
  // 返回考试成绩
  // 返回答题详情
  // 返回正确答案和解析
  // 返回错题列表
  // 返回排名信息
  fastify.get('/api/assessment-results/:id/result', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const userId = decoded.id
      const resultId = parseInt(request.params.id)

      // 获取考试结果
      const [resultRows] = await pool.query(
        `SELECT
          ar.id,
          ar.plan_id,
          ar.exam_id,
          ar.user_id,
          ar.attempt_number,
          ar.start_time,
          ar.submit_time,
          ar.duration,
          ar.score,
          ar.is_passed,
          ar.status,
          ap.title as plan_title,
          e.title as exam_title,
          e.total_score as exam_total_score,
          e.pass_score,
          e.question_count
        FROM assessment_results ar
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        WHERE ar.id = ? AND ar.user_id = ?`,
        [resultId, userId]
      )

      if (resultRows.length === 0) {
        return reply.code(404).send({ success: false, message: '考试结果不存在或无权访问' })
      }

      const result = resultRows[0]

      // 获取用户答案
      const [userAnswersRows] = await pool.query(
        `SELECT question_id, user_answer, score as user_score, is_correct
        FROM answer_records
        WHERE result_id = ?`,
        [resultId]
      )

      // 将用户答案转换为 Map 便于查找
      const userAnswersMap = new Map()
      userAnswersRows.forEach(row => {
        userAnswersMap.set(row.question_id, row)
      })

      // 获取试卷题目（从 exams 表 JSON 字段）
      const [examRows] = await pool.query(
        `SELECT questions FROM exams WHERE id = ?`,
        [result.exam_id]
      )

      let questions = []
      if (examRows.length > 0 && examRows[0].questions) {
        try {
          questions = typeof examRows[0].questions === 'string'
            ? JSON.parse(examRows[0].questions)
            : examRows[0].questions
        } catch (e) {
          console.error('解析题目JSON失败:', e)
          questions = []
        }
      }

      // 格式化题目并附加用户答案
      const detailedQuestions = questions.map(q => {
        let parsedOptions = q.options
        if (typeof parsedOptions === 'string') {
          try {
            parsedOptions = JSON.parse(parsedOptions)
          } catch (error) {
            parsedOptions = parsedOptions.split(/,|，/).map(opt => opt.trim()).filter(Boolean)
          }
        }

        // 获取用户答案
        const userAns = userAnswersMap.get(q.id)

        return {
          id: q.id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          question_max_score: parseFloat(q.score),
          user_answer: userAns ? userAns.user_answer : null,
          user_score: userAns ? parseFloat(userAns.user_score) : null,
          is_correct: userAns ? userAns.is_correct : null
        }
      })

      const incorrectQuestions = detailedQuestions.filter(q => q.is_correct === 0)
      const pendingGradingQuestions = detailedQuestions.filter(q => q.is_correct === null)

      return {
        success: true,
        message: '获取考试结果成功',
        data: {
          result_summary: {
            result_id: result.id,
            plan_id: result.plan_id,
            plan_title: result.plan_title,
            exam_id: result.exam_id,
            exam_title: result.exam_title,
            user_id: result.user_id,
            attempt_number: result.attempt_number,
            start_time: result.start_time,
            submit_time: result.submit_time,
            duration: result.duration, // seconds
            user_score: parseFloat(result.score),
            exam_total_score: parseFloat(result.exam_total_score),
            pass_score: parseFloat(result.pass_score),
            is_passed: result.is_passed === 1,
            status: result.status,
            question_count: result.question_count,
            correct_count: detailedQuestions.filter(q => q.is_correct === 1).length,
            incorrect_count: incorrectQuestions.length,
            pending_grading_count: pendingGradingQuestions.length
          },
          detailed_questions: detailedQuestions,
          incorrect_questions: incorrectQuestions.map(q => ({ id: q.id, content: q.content })),
          pending_grading_questions: pendingGradingQuestions.map(q => ({ id: q.id, content: q.content }))
        }
      }
    } catch (error) {
      console.error('获取考试结果失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取考试结果失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取我的考试记录
  // GET /api/my-results
  // 返回当前用户的所有考试记录
  // 支持分页和排序
  // 支持状态筛选
  // 显示成绩、通过状态、考试时间
  fastify.get('/api/my-results', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const userId = decoded.id
      const { page = 1, pageSize = 10, status, sortBy = 'submit_time', sortOrder = 'DESC' } = request.query

      const offset = (page - 1) * pageSize
      const limit = parseInt(pageSize)

      let whereClauses = [`ar.user_id = ?`]
      let queryParams = [userId]

      if (status) {
        whereClauses.push(`ar.status = ?`)
        queryParams.push(status)
      }

      const orderByMapping = {
        submit_time: 'ar.submit_time',
        score: 'ar.score',
        status: 'ar.status',
        exam_title: 'e.title',
        plan_title: 'ap.title'
      }

      const validSortBy = orderByMapping[sortBy] || orderByMapping.submit_time
      const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      const [results] = await pool.query(
        `SELECT
          ar.id,
          ar.plan_id,
          ar.exam_id,
          ar.user_id,
          ar.attempt_number,
          ar.start_time,
          ar.submit_time,
          ar.duration,
          ar.score,
          ar.is_passed,
          ar.status,
          ap.title as plan_title,
          e.title as exam_title,
          e.total_score as exam_total_score,
          e.pass_score
        FROM assessment_results ar
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ?, ?`,
        [...queryParams, offset, limit]
      )

      const [totalRows] = await pool.query(
        `SELECT COUNT(*) as total
        FROM assessment_results ar
        WHERE ${whereClauses.join(' AND ')}`,
        queryParams
      )

      const total = totalRows[0].total

      return {
        success: true,
        message: '获取我的考试记录成功',
        data: {
          page: parseInt(page),
          pageSize: limit,
          total,
          results: results.map(r => ({
            id: r.id,
            plan_id: r.plan_id,
            plan_title: r.plan_title,
            exam_id: r.exam_id,
            exam_title: r.exam_title,
            attempt_number: r.attempt_number,
            start_time: r.start_time,
            submit_time: r.submit_time,
            duration: r.duration,
            user_score: parseFloat(r.score),
            exam_total_score: parseFloat(r.exam_total_score),
            pass_score: parseFloat(r.pass_score),
            is_passed: r.is_passed === 1,
            status: r.status
          }))
        }
      }
    } catch (error) {
      console.error('获取我的考试记录失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取我的考试记录失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取所有考试记录（管理员）
  // GET /api/assessment-results
  // 支持多条件筛选：user_id, exam_id, plan_id, 时间范围
  // 支持分页和排序
  // 返回详细成绩信息
  // 包含用户和试卷信息
  fastify.get('/api/assessment-results', async (request, reply) => {
    try {
      // 验证用户身份和权限（管理员）
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      // 检查是否是管理员
      const [adminUser] = await pool.query(
        'SELECT id FROM users WHERE id = ? AND username = "admin"',
        [decoded.id]
      );

      if (adminUser.length === 0) {
        return reply.code(403).send({ success: false, message: '无权访问此资源' })
      }

      const {
        page = 1,
        pageSize = 10,
        user_id,
        exam_id,
        plan_id,
        status,
        start_date,
        end_date,
        sortBy = 'submit_time',
        sortOrder = 'DESC'
      } = request.query

      const offset = (page - 1) * pageSize
      const limit = parseInt(pageSize)

      let whereClauses = []
      let queryParams = []

      if (user_id) {
        whereClauses.push(`ar.user_id = ?`)
        queryParams.push(user_id)
      }
      if (exam_id) {
        whereClauses.push(`ar.exam_id = ?`)
        queryParams.push(exam_id)
      }
      if (plan_id) {
        whereClauses.push(`ar.plan_id = ?`)
        queryParams.push(plan_id)
      }
      if (status) {
        whereClauses.push(`ar.status = ?`)
        queryParams.push(status)
      }
      if (start_date) {
        whereClauses.push(`ar.submit_time >= ?`)
        queryParams.push(start_date)
      }
      if (end_date) {
        whereClauses.push(`ar.submit_time <= ?`)
        queryParams.push(end_date)
      }

      const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const orderByMapping = {
        submit_time: 'ar.submit_time',
        score: 'ar.score',
        status: 'ar.status',
        exam_title: 'e.title',
        plan_title: 'ap.title',
        user_id: 'ar.user_id'
      }

      const validSortBy = orderByMapping[sortBy] || orderByMapping.submit_time
      const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      const [results] = await pool.query(
        `SELECT
          ar.id,
          ar.plan_id,
          ar.exam_id,
          ar.user_id,
          ar.attempt_number,
          ar.start_time,
          ar.submit_time,
          ar.duration,
          ar.score,
          ar.is_passed,
          ar.status,
          ap.title as plan_title,
          e.title as exam_title,
          e.total_score as exam_total_score,
          e.pass_score,
          u.username as user_username,
          u.email as user_email
        FROM assessment_results ar
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        LEFT JOIN users u ON ar.user_id = u.id
        ${whereString}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ?, ?`,
        [...queryParams, offset, limit]
      )

      const [totalRows] = await pool.query(
        `SELECT COUNT(*) as total
        FROM assessment_results ar
        LEFT JOIN users u ON ar.user_id = u.id
        ${whereString}`,
        queryParams
      )

      const total = totalRows[0].total

      return {
        success: true,
        message: '获取所有考试记录成功',
        data: {
          page: parseInt(page),
          pageSize: limit,
          total,
          results: results.map(r => ({
            id: r.id,
            plan_id: r.plan_id,
            plan_title: r.plan_title,
            exam_id: r.exam_id,
            exam_title: r.exam_title,
            user_id: r.user_id,
            user_username: r.user_username,
            user_email: r.user_email,
            attempt_number: r.attempt_number,
            start_time: r.start_time,
            submit_time: r.submit_time,
            duration: r.duration,
            user_score: parseFloat(r.score),
            exam_total_score: parseFloat(r.exam_total_score),
            pass_score: parseFloat(r.pass_score),
            is_passed: r.is_passed === 1,
            status: r.status
          }))
        }
      }
    } catch (error) {
      console.error('获取所有考试记录失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取所有考试记录失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 人工评分（主观题）
  // PUT /api/assessment-results/:id/grade
  // 验证管理员权限
  // 参数：question_id, score, is_correct
  // 更新 answer_records 的分数
  // 重新计算总分
  // 更新 is_passed 状态
  // 更新考试状态为 'graded'
  fastify.put('/api/assessment-results/:id/grade', async (request, reply) => {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 验证用户身份和权限（管理员）
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        await connection.rollback()
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        await connection.rollback()
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      // 检查是否是管理员
      const [adminUser] = await pool.query(
        'SELECT id FROM users WHERE id = ? AND username = "admin"',
        [decoded.id]
      );

      if (adminUser.length === 0) {
        await connection.rollback()
        return reply.code(403).send({ success: false, message: '无权访问此资源' })
      }

      const resultId = parseInt(request.params.id)
      const { question_id, score, is_correct } = request.body

      // 验证必填字段和格式
      if (isNaN(resultId) || resultId <= 0) {
        await connection.rollback()
        return reply.code(400).send({ success: false, message: '考核结果ID无效' })
      }
      if (isNaN(question_id) || question_id <= 0) {
        await connection.rollback()
        return reply.code(400).send({ success: false, message: '题目ID无效' })
      }
      if (typeof score !== 'number' || score < 0) {
        await connection.rollback()
        return reply.code(400).send({ success: false, message: '分数必须是非负数字' })
      }
      if (is_correct === undefined || (is_correct !== 0 && is_correct !== 1 && is_correct !== null)) {
        await connection.rollback()
        return reply.code(400).send({ success: false, message: 'is_correct 必须是 0, 1 或 null' })
      }

      // 获取考核结果信息
      const [resultRows] = await connection.query(
        `SELECT
          ar.id,
          ar.exam_id,
          ar.pass_score,
          ar.status
        FROM assessment_results ar
        WHERE ar.id = ? FOR UPDATE`, // Lock row for update
        [resultId]
      )

      if (resultRows.length === 0) {
        await connection.rollback()
        return reply.code(404).send({ success: false, message: '考核结果不存在' })
      }
      const result = resultRows[0]

      // 获取题目信息
      const [questionRows] = await connection.query(
        `SELECT id, type, score as max_score FROM questions WHERE id = ? AND exam_id = ?`,
        [question_id, result.exam_id]
      )
      if (questionRows.length === 0) {
        await connection.rollback()
        return reply.code(404).send({ success: false, message: '题目不存在或不属于该试卷' })
      }
      const question = questionRows[0]

      // 验证评分的分数不超过题目最大分数
      if (score > parseFloat(question.max_score)) {
        await connection.rollback()
        return reply.code(400).send({ success: false, message: `评分不能超过题目最大分数 ${question.max_score}` })
      }

      // 更新 answer_records
      const [updateAnswerResult] = await connection.query(
        `UPDATE answer_records
        SET score = ?, is_correct = ?, updated_at = NOW()
        WHERE assessment_result_id = ? AND question_id = ?`,
        [score, is_correct, resultId, question_id]
      )

      if (updateAnswerResult.affectedRows === 0) {
        await connection.rollback()
        return reply.code(404).send({ success: false, message: '未找到对应的答题记录' })
      }

      // 重新计算总分和通过状态
      const [allAnswers] = await connection.query(
        `SELECT score, is_correct FROM answer_records WHERE assessment_result_id = ?`,
        [resultId]
      )

      let newTotalScore = 0
      let allGraded = true
      for (const ans of allAnswers) {
        if (ans.score !== null) {
          newTotalScore += parseFloat(ans.score)
        }
        if (ans.is_correct === null) { // Still has questions pending manual grading
          allGraded = false
        }
      }

      const newIsPassed = newTotalScore >= parseFloat(result.pass_score) ? 1 : 0
      const newStatus = allGraded ? 'graded' : 'submitted' // If all are graded, status becomes 'graded'

      // 更新 assessment_results
      await connection.query(
        `UPDATE assessment_results
        SET
          score = ?,
          is_passed = ?,
          status = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [newTotalScore, newIsPassed, newStatus, resultId]
      )

      await connection.commit()

      return {
        success: true,
        message: '评分成功',
        data: {
          result_id: resultId,
          question_id: question_id,
          new_question_score: score,
          new_is_correct: is_correct,
          new_total_score: newTotalScore,
          new_is_passed: newIsPassed === 1,
          new_status: newStatus
        }
      }
    } catch (error) {
      await connection.rollback()
      console.error('人工评分失败:', error)
      return reply.code(500).send({
        success: false,
        message: '人工评分失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    } finally {
      connection.release()
    }
  })

  // 获取答题详情
  // GET /api/assessment-results/:id/answers
  // 返回所有题目和用户答案
  // 显示正确答案和解析
  // 显示每题得分和正确性
  // 验证用户权限
  fastify.get('/api/assessment-results/:id/answers', async (request, reply) => {
    try {
      // 验证用户身份
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const userId = decoded.id
      const resultId = parseInt(request.params.id)

      // 验证 resultId 格式
      if (isNaN(resultId) || resultId <= 0) {
        return reply.code(400).send({ success: false, message: '考核结果ID无效' })
      }

      // 获取考核结果信息
      const [resultRows] = await pool.query(
        `SELECT
          ar.id,
          ar.exam_id,
          ar.user_id
        FROM assessment_results ar
        WHERE ar.id = ?`,
        [resultId]
      )

      if (resultRows.length === 0) {
        return reply.code(404).send({ success: false, message: '考核结果不存在' })
      }

      const result = resultRows[0]

      // 权限验证：只能查看自己的或管理员可以查看
      // 权限验证：只能查看自己的或管理员可以查看
      if (result.user_id !== userId) {
        // 不是自己的记录，检查是否是管理员
        const [adminUser] = await pool.query(
          'SELECT id FROM users WHERE id = ? AND username = "admin"',
          [userId]
        );

        if (adminUser.length === 0) {
          return reply.code(403).send({ success: false, message: '无权查看此答题详情' });
        }
      }

      // 获取所有题目（包含正确答案和解析）
      const [questions] = await pool.query(
        `SELECT
          id,
          type,
          content,
          options,
          correct_answer,
          explanation,
          score as question_max_score
        FROM questions
        WHERE exam_id = ?
        ORDER BY order_num ASC`,
        [result.exam_id]
      )

      // 获取用户已保存的答案和评分结果
      const [answerRecords] = await pool.query(
        `SELECT
          question_id,
          user_answer,
          score as user_score,
          is_correct
        FROM answer_records
        WHERE assessment_result_id = ?`,
        [resultId]
      )

      const answerMap = answerRecords.reduce((acc, curr) => {
        acc[curr.question_id] = curr
        return acc
      }, {})

      const detailedAnswers = questions.map(q => {
        const userAnswerData = answerMap[q.id] || {}
        let parsedOptions = null
        if (q.options) {
          try {
            parsedOptions = JSON.parse(q.options)
          } catch (error) {
            console.error(`题目 ${q.id} 的 options 字段 JSON 解析失败:`, error.message)
            parsedOptions = q.options
          }
        }

        let parsedCorrectAnswer = null
        if (q.correct_answer) {
          try {
            parsedCorrectAnswer = JSON.parse(q.correct_answer)
          } catch (error) {
            parsedCorrectAnswer = q.correct_answer
          }
        }

        let parsedUserAnswer = null
        if (userAnswerData.user_answer) {
          try {
            parsedUserAnswer = JSON.parse(userAnswerData.user_answer)
          } catch (error) {
            parsedUserAnswer = userAnswerData.user_answer
          }
          // Handle cases where user_answer might be a string for fill_blank or essay
          if (typeof parsedUserAnswer === 'string' && (q.type === 'fill_blank' || q.type === 'essay')) {
            parsedUserAnswer = userAnswerData.user_answer;
          }
        }

        return {
          question_id: q.id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          correct_answer: parsedCorrectAnswer,
          explanation: q.explanation,
          question_max_score: parseFloat(q.question_max_score),
          user_answer: parsedUserAnswer,
          user_score: userAnswerData.user_score !== undefined ? parseFloat(userAnswerData.user_score) : null,
          is_correct: userAnswerData.is_correct
        }
      })

      return {
        success: true,
        message: '获取答题详情成功',
        data: {
          result_id: resultId,
          exam_id: result.exam_id,
          user_id: result.user_id,
          answers: detailedAnswers
        }
      }
    } catch (error) {
      console.error('获取答题详情失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取答题详情失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })
}
