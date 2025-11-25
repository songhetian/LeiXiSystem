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

      // 检查是否已有考试记录(无论状态)
      const [existingRows] = await pool.query(
        `SELECT id, start_time, status, attempt_number
        FROM assessment_results
        WHERE plan_id = ? AND user_id = ?
        ORDER BY attempt_number DESC
        LIMIT 1`,
        [plan_id, userId]
      )

      // 如果已有记录,直接返回该记录,不创建新的
      if (existingRows.length > 0) {
        const existingResult = existingRows[0]

        console.log(`用户 ${userId} 已有考试记录 ${existingResult.id}, 状态: ${existingResult.status}, 直接返回`)

        // 如果状态不是 in_progress,更新为 in_progress 并重置开始时间
        if (existingResult.status !== 'in_progress') {
          await pool.query(
            `UPDATE assessment_results
            SET status = 'in_progress', start_time = NOW()
            WHERE id = ?`,
            [existingResult.id]
          )
        }

        // 获取试卷题目
        let questions = []
        try {
          questions = typeof plan.questions === 'string' ? JSON.parse(plan.questions) : (plan.questions || [])
        } catch (e) {
          console.error('解析题目 JSON 失败:', e)
          questions = []
        }

        // 格式化题目数据
        const formattedQuestions = questions.map(q => {
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

        return {
          success: true,
          message: '继续考试',
          data: {
            result_id: existingResult.id,
            plan_id: plan.id,
            plan_title: plan.title,
            exam_id: plan.exam_id,
            exam_title: plan.exam_title,
            attempt_number: existingResult.attempt_number,
            max_attempts: plan.max_attempts,
            start_time: new Date().toISOString(),
            duration: plan.duration,
            questions: formattedQuestions
          }
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

      console.log(`[GET /assessment-results/${resultId}] 查询到 ${answerRows.length} 条答案记录`)

      // 将答案转换为对象格式 {question_id: user_answer}
      answerRows.forEach(row => {
        savedAnswers[row.question_id] = row.user_answer
      })

      if (Object.keys(savedAnswers).length > 0) {
        console.log('[GET /assessment-results] saved_answers:', savedAnswers)
      } else {
        console.log('[GET /assessment-results] ⚠️ 没有找到已保存的答案')
      }

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
        try {
          console.log('=== 开始保存答案 (Atomic) ===');
          console.log('保存单个答案:', { resultId, qId, ans, ansType: typeof ans });

          const questionId = String(qId);
          const answerValue = typeof ans === 'string' ? ans : JSON.stringify(ans);

          console.log('使用题目ID:', questionId);
          console.log('答案值:', answerValue);

          // 使用 INSERT ... ON DUPLICATE KEY UPDATE 实现原子操作
          // 这依赖于 answer_records 表上的唯一索引 (result_id, question_id)
          const [result] = await pool.query(
            `INSERT INTO answer_records (result_id, question_id, user_answer, created_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
             user_answer = VALUES(user_answer)`,
            [resultId, questionId, answerValue]
          );

          console.log('数据库操作结果:', {
            insertId: result.insertId,
            affectedRows: result.affectedRows, // 1 for insert, 2 for update (usually)
            info: result.info
          });

          if (result.affectedRows === 1) {
             console.log('✅ 答案插入成功');
          } else if (result.affectedRows === 2) {
             console.log('✅ 答案更新成功');
          } else {
             console.log('✅ 答案已保存 (无变化)');
          }

          console.log('=== 答案保存完成 ===\n');
        } catch (error) {
          console.error('❌ 保存答案失败:', error);
          console.error('错误详情:', {
            message: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage,
            questionId: qId,
            answer: ans
          });
          throw error;
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
          ar.id, ar.plan_id, ar.exam_id, ar.user_id, ar.start_time, ar.status, ar.attempt_number,
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

      // 从 exams.questions JSON 获取题目
      const [examRows] = await connection.query(
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
          await connection.rollback(); connection.release()
          return reply.code(500).send({ success: false, message: '解析题目失败' })
        }
      }

      if (questions.length === 0) {
        await connection.rollback(); connection.release()
        return reply.code(400).send({ success: false, message: '试卷没有题目' })
      }

      // 获取所有答案记录
      const [answerRows] = await connection.query(
        `SELECT id, question_id, user_answer, score, is_correct FROM answer_records WHERE result_id = ?`,
        [resultId]
      )

      // 创建答案映射(统一使用字符串ID)
      const answerMap = new Map()
      for (const answer of answerRows) {
        answerMap.set(String(answer.question_id), answer)
      }

      // 检查是否所有题目都已回答
      const unansweredQuestions = []
      for (const q of questions) {
        const questionId = String(q.id)
        const answer = answerMap.get(questionId)
        if (!answer || !answer.user_answer) {
          unansweredQuestions.push({
            id: q.id,
            content: q.content,
            type: q.type
          })
        }
      }

      if (unansweredQuestions.length > 0) {
        await connection.rollback()
        connection.release()
        return reply.code(400).send({
          success: false,
          message: `还有 ${unansweredQuestions.length} 道题目未作答，请完成所有题目后再提交`,
          data: {
            unanswered_count: unansweredQuestions.length,
            total_questions: questions.length,
            unanswered_questions: unansweredQuestions.map(q => ({
              id: q.id,
              content: q.content.substring(0, 50) + (q.content.length > 50 ? '...' : '')
            }))
          }
        })
      }

      console.log(`开始评分: 共 ${questions.length} 道题, ${answerRows.length} 条答案记录`)

      // 调试: 打印题目ID列表
      console.log('题目ID列表:', questions.map(q => q.id))

      // 调试: 打印答案记录ID列表
      console.log('答案记录ID列表:', answerRows.map(a => a.question_id))

      // 调试: 打印answerMap的所有键
      console.log('answerMap键列表:', Array.from(answerMap.keys()))

      // 评分
      let totalScore = 0
      let correctCount = 0
      let hasSubjectiveQuestions = false // 是否有主观题
      const detailedQuestions = []

      for (const q of questions) {
        const questionId = String(q.id)
        const existingAnswer = answerMap.get(questionId)
        let userAnsRaw = existingAnswer?.user_answer || null

        // 调试: 打印每道题的匹配情况
        console.log(`题目 ${questionId}: 找到答案=${!!existingAnswer}, 用户答案=${userAnsRaw}`)

        // 尝试解析JSON格式的答案
        if (userAnsRaw && typeof userAnsRaw === 'string') {
          try {
            userAnsRaw = JSON.parse(userAnsRaw)
          } catch (e) {
            // 保持原始字符串
          }
        }

        let isCorrect = null
        let earned = null
        const correctAnswer = q.correct_answer

        // 根据题目类型评分
        if (q.type === 'single_choice') {
          // 单选题: 用户答案和正确答案都是字母(A, B, C, D)
          isCorrect = userAnsRaw === correctAnswer ? 1 : 0
          earned = isCorrect ? parseFloat(q.score) : 0
          console.log(`单选题 ${questionId}: 用户答案=${userAnsRaw}, 正确答案=${correctAnswer}, 得分=${earned}`)

        } else if (q.type === 'multiple_choice') {
          // 多选题: 用户答案是字母数组 ["A", "B"]
          const userLetters = Array.isArray(userAnsRaw) ? userAnsRaw.sort() : []
          const correctLetters = correctAnswer ? correctAnswer.split('').sort() : []
          const fullCorrect = userLetters.length === correctLetters.length &&
                             userLetters.every((v, i) => v === correctLetters[i])

          if (fullCorrect) {
            isCorrect = 1
            earned = parseFloat(q.score)
          } else {
            // 部分正确,按比例给分
            const correctSet = new Set(correctLetters)
            const correctCount = userLetters.filter(v => correctSet.has(v)).length
            const ratio = correctLetters.length > 0 ? (correctCount / correctLetters.length) : 0
            isCorrect = 0
            earned = parseFloat(q.score) * ratio
          }
          console.log(`多选题 ${questionId}: 用户答案=${JSON.stringify(userLetters)}, 正确答案=${JSON.stringify(correctLetters)}, 得分=${earned}`)

        } else if (q.type === 'true_false') {
          // 判断题: A=对, B=错
          isCorrect = userAnsRaw === correctAnswer ? 1 : 0
          earned = isCorrect ? parseFloat(q.score) : 0
          console.log(`判断题 ${questionId}: 用户答案=${userAnsRaw}, 正确答案=${correctAnswer}, 得分=${earned}`)

        } else if (q.type === 'fill_blank' || q.type === 'short_answer') {
          // 填空题和简答题: 需要人工评分
          hasSubjectiveQuestions = true
          isCorrect = null
          earned = null
          console.log(`主观题 ${questionId}: 类型=${q.type}, 需要人工评分`)

        } else {
          // 其他未知类型,标记为待评分
          hasSubjectiveQuestions = true
          isCorrect = null
          earned = null
          console.log(`未知题型 ${questionId}: 类型=${q.type}`)
        }

        // 汇总得分
        if (earned !== null) {
          totalScore += parseFloat(earned || 0)
        }
        if (isCorrect === 1) {
          correctCount += 1
        }

        // 更新或插入答案记录的评分
        if (existingAnswer) {
          await connection.query(
            `UPDATE answer_records SET score = ?, is_correct = ? WHERE id = ?`,
            [earned, isCorrect, existingAnswer.id]
          )
        } else if (userAnsRaw !== null) {
          // 如果有答案但没有记录,插入
          await connection.query(
            `INSERT INTO answer_records (result_id, question_id, user_answer, score, is_correct)
             VALUES (?, ?, ?, ?, ?)`,
            [resultId, questionId, typeof userAnsRaw === 'string' ? userAnsRaw : JSON.stringify(userAnsRaw), earned, isCorrect]
          )
        }

        // 构建详细题目信息
        detailedQuestions.push({
          id: q.id,
          type: q.type,
          content: q.content,
          options: q.options,
          question_max_score: parseFloat(q.score),
          user_answer: userAnsRaw,
          user_score: earned !== null ? parseFloat(earned) : null,
          is_correct: isCorrect
        })
      }

      // 计算用时和状态
      const submitTime = new Date()
      const startTime = new Date(result.start_time)
      const durationSeconds = Math.max(0, Math.floor((submitTime.getTime() - startTime.getTime()) / 1000))
      const isPassed = totalScore >= parseFloat(result.pass_score) ? 1 : 0

      // 如果有主观题,状态为submitted(待评分),否则为graded(已评分)
      const newStatus = hasSubjectiveQuestions ? 'submitted' : 'graded'

      console.log(`评分完成: 总分=${totalScore}, 及格分=${result.pass_score}, 是否通过=${isPassed}, 状态=${newStatus}`)

      // 更新考试结果
      await connection.query(
        `UPDATE assessment_results
         SET submit_time = ?, duration = ?, score = ?, is_passed = ?, status = ?
         WHERE id = ?`,
        [submitTime, durationSeconds, totalScore, isPassed, newStatus, resultId]
      )

      // 提交成功后,为下一次考试创建新的 result_id
      // 这样下次点击"开始考试"时会显示"开始答题"而不是"继续答题"
      let nextResultId = null
      const currentAttemptNumber = result.attempt_number || 1

      // 检查是否还有剩余尝试次数
      if (currentAttemptNumber < result.max_attempts) {
        const nextAttemptNumber = currentAttemptNumber + 1
        console.log(`创建下一次考试记录: attempt_number=${nextAttemptNumber}`)

        const [nextResultInsert] = await connection.query(
          `INSERT INTO assessment_results (
            plan_id,
            exam_id,
            user_id,
            attempt_number,
            start_time,
            status
          ) VALUES (?, ?, ?, ?, NOW(), 'in_progress')`,
          [result.plan_id, result.exam_id, result.user_id, nextAttemptNumber]
        )

        nextResultId = nextResultInsert.insertId
        console.log(`下一次考试记录已创建: result_id=${nextResultId}`)
      } else {
        console.log(`已达到最大尝试次数 ${result.max_attempts}, 不创建新记录`)
      }

      await connection.commit()
      connection.release()

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
            pending_grading_count: hasSubjectiveQuestions ? questions.filter(q => q.type === 'fill_blank' || q.type === 'short_answer').length : 0
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
        // 确保键是字符串
        userAnswersMap.set(String(row.question_id), row)
      })

      console.log(`获取考试结果: resultId=${resultId}, 答案记录数=${userAnswersRows.length}`)
      if (userAnswersRows.length > 0) {
        console.log('第一条答案记录:', userAnswersRows[0])
        console.log('答案Map键:', Array.from(userAnswersMap.keys()))
      }

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

      if (questions.length > 0) {
        console.log('第一道题目ID:', questions[0].id, '类型:', typeof questions[0].id)
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
        // 确保使用字符串ID查找
        const questionId = String(q.id)
        const userAns = userAnswersMap.get(questionId)

        // 调试匹配情况
        console.log(`题目 ${questionId} 匹配结果:`, !!userAns, userAns ? `答案: ${userAns.user_answer}` : '无答案')

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

      if (detailedQuestions.length > 0) {
        console.log('返回给前端的第一道题目详情:', detailedQuestions[0])
      }

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

      // 获取用户已保存的答案和评分结果
      const [answerRecords] = await pool.query(
        `SELECT
          question_id,
          user_answer,
          score as user_score,
          is_correct
        FROM answer_records
        WHERE result_id = ?`,
        [resultId]
      )

      const answerMap = answerRecords.reduce((acc, curr) => {
        acc[String(curr.question_id)] = curr
        return acc
      }, {})

      console.log(`获取答题详情: resultId=${resultId}, 题目数=${questions.length}, 答案数=${answerRecords.length}`)

      const detailedAnswers = questions.map(q => {
        const questionId = String(q.id)
        const userAnswerData = answerMap[questionId] || {}

        let parsedOptions = null
        if (q.options) {
          try {
            parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
          } catch (error) {
            // console.error(`题目 ${q.id} 的 options 字段 JSON 解析失败:`, error.message)
            parsedOptions = q.options
          }
        }

        // 处理正确答案显示
        let parsedCorrectAnswer = q.correct_answer
        // 多选题正确答案通常是 "AB" 这种字符串,不需要特殊处理
        // 如果是JSON字符串才解析

        // 处理用户答案显示
        let parsedUserAnswer = userAnswerData.user_answer
        // 前端期望多选题答案是 JSON 数组字符串 '["A","B"]' 或者 字符串 "AB"
        // 数据库存的是 '["A","B"]' (JSON string) 或 "A" (string)

        return {
          question_id: q.id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          correct_answer: parsedCorrectAnswer,
          explanation: q.explanation,
          question_max_score: parseFloat(q.score),
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
          exam_title: result.exam_title, // 添加试卷标题
          user_id: result.user_id,
          score: result.score,
          total_score: result.exam_total_score,
          is_passed: result.is_passed,
          questions: detailedAnswers
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
