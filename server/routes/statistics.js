// 统计分析 API

const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 考试概览统计
  // GET /api/statistics/exam-overview
  // 总考试次数
  // 平均分
  // 总通过率
  // 参与人数
  // 支持时间范围筛选
  fastify.get('/api/statistics/exam-overview', async (request, reply) => {
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

      const { start_date, end_date } = request.query

      let whereClauses = []
      let queryParams = []

      if (start_date) {
        whereClauses.push(`submit_time >= ?`)
        queryParams.push(start_date)
      }
      if (end_date) {
        whereClauses.push(`submit_time <= ?`)
        queryParams.push(end_date)
      }

      const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const [statsRows] = await pool.query(
        `SELECT
          COUNT(id) as total_exams,
          AVG(score) as average_score,
          SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) / COUNT(id) as pass_rate,
          COUNT(DISTINCT user_id) as total_participants
        FROM assessment_results
        ${whereString}`,
        queryParams
      )

      const stats = statsRows[0]

      return {
        success: true,
        message: '获取考试概览统计成功',
        data: {
          total_exams: parseInt(stats.total_exams || 0),
          average_score: parseFloat(stats.average_score || 0).toFixed(2),
          pass_rate: parseFloat(stats.pass_rate || 0).toFixed(4),
          total_participants: parseInt(stats.total_participants || 0)
        }
      }
    } catch (error) {
      console.error('获取考试概览统计失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取考试概览统计失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 单个试卷统计
  // GET /api/statistics/exam/:examId
  // 参加人数
  // 平均分、最高分、最低分
  // 通过率
  // 题目正确率分析
  // 分数分布（0-60, 60-70, 70-80, 80-90, 90-100）
  fastify.get('/api/statistics/exam/:examId', async (request, reply) => {
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

      const examId = parseInt(request.params.examId)

      if (isNaN(examId) || examId <= 0) {
        return reply.code(400).send({ success: false, message: '试卷ID无效' })
      }

      // 获取试卷信息
      const [examRows] = await pool.query(
        `SELECT id, title, total_score, pass_score FROM exams WHERE id = ?`,
        [examId]
      )
      if (examRows.length === 0) {
        return reply.code(404).send({ success: false, message: '试卷不存在' })
      }
      const exam = examRows[0]

      // 1. 参加人数、平均分、最高分、最低分、通过率
      const [summaryStatsRows] = await pool.query(
        `SELECT
          COUNT(DISTINCT user_id) as total_participants,
          AVG(score) as average_score,
          MAX(score) as max_score,
          MIN(score) as min_score,
          SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_count,
          COUNT(id) as total_attempts
        FROM assessment_results
        WHERE exam_id = ? AND status IN ('graded', 'submitted')`,
        [examId]
      )
      const summaryStats = summaryStatsRows[0]
      const passRate = summaryStats.total_attempts > 0
        ? (summaryStats.passed_count / summaryStats.total_attempts).toFixed(4)
        : 0

      // 2. 题目正确率分析
      const [questionStatsRows] = await pool.query(
        `SELECT
          q.id as question_id,
          q.content,
          q.type,
          q.score as question_max_score,
          COUNT(ar.id) as total_answers,
          SUM(CASE WHEN ar.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
          AVG(ar.score) as average_question_score
        FROM questions q
        LEFT JOIN answer_records ar ON q.id = ar.question_id
        LEFT JOIN assessment_results ars ON ar.assessment_result_id = ars.id
        WHERE q.exam_id = ? AND ars.status IN ('graded', 'submitted')
        GROUP BY q.id, q.content, q.type, q.score
        ORDER BY q.order_num ASC`,
        [examId]
      )

      const questionAnalysis = questionStatsRows.map(qs => ({
        question_id: qs.question_id,
        content: qs.content,
        type: qs.type,
        question_max_score: parseFloat(qs.question_max_score),
        total_answers: parseInt(qs.total_answers || 0),
        correct_answers: parseInt(qs.correct_answers || 0),
        correct_rate: qs.total_answers > 0 ? (qs.correct_answers / qs.total_answers).toFixed(4) : 0,
        average_question_score: parseFloat(qs.average_question_score || 0).toFixed(2)
      }))

      // 3. 分数分布
      const [scoreDistributionRows] = await pool.query(
        `SELECT
          SUM(CASE WHEN score >= 0 AND score < ? THEN 1 ELSE 0 END) as '0-60',
          SUM(CASE WHEN score >= ? AND score < ? THEN 1 ELSE 0 END) as '60-70',
          SUM(CASE WHEN score >= ? AND score < ? THEN 1 ELSE 0 END) as '70-80',
          SUM(CASE WHEN score >= ? AND score < ? THEN 1 ELSE 0 END) as '80-90',
          SUM(CASE WHEN score >= ? AND score <= ? THEN 1 ELSE 0 END) as '90-100'
        FROM assessment_results
        WHERE exam_id = ? AND status IN ('graded', 'submitted')`,
        [
          exam.pass_score, // Assuming pass_score is 60 for the first bin, adjust if needed
          exam.pass_score, exam.total_score * 0.7, // 60-70
          exam.total_score * 0.7, exam.total_score * 0.8, // 70-80
          exam.total_score * 0.8, exam.total_score * 0.9, // 80-90
          exam.total_score * 0.9, exam.total_score, // 90-100
          examId
        ]
      )
      const scoreDistribution = scoreDistributionRows[0]

      return {
        success: true,
        message: '获取单个试卷统计成功',
        data: {
          exam_id: exam.id,
          exam_title: exam.title,
          exam_total_score: parseFloat(exam.total_score),
          exam_pass_score: parseFloat(exam.pass_score),
          summary: {
            total_participants: parseInt(summaryStats.total_participants || 0),
            total_attempts: parseInt(summaryStats.total_attempts || 0),
            average_score: parseFloat(summaryStats.average_score || 0).toFixed(2),
            max_score: parseFloat(summaryStats.max_score || 0).toFixed(2),
            min_score: parseFloat(summaryStats.min_score || 0).toFixed(2),
            pass_rate: passRate
          },
          question_analysis: questionAnalysis,
          score_distribution: {
            '0-60': parseInt(scoreDistribution['0-60'] || 0),
            '60-70': parseInt(scoreDistribution['60-70'] || 0),
            '70-80': parseInt(scoreDistribution['70-80'] || 0),
            '80-90': parseInt(scoreDistribution['80-90'] || 0),
            '90-100': parseInt(scoreDistribution['90-100'] || 0)
          }
        }
      }
    } catch (error) {
      console.error('获取单个试卷统计失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取单个试卷统计失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 用户考试统计
  // GET /api/statistics/user/:userId
  // 参加考试次数
  // 平均分
  // 通过率
  // 考试历史记录
  // 成绩趋势数据
  fastify.get('/api/statistics/user/:userId', async (request, reply) => {
    try {
      // 验证用户身份和权限（管理员或用户本人）
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

      const targetUserId = parseInt(request.params.userId)

      if (isNaN(targetUserId) || targetUserId <= 0) {
        return reply.code(400).send({ success: false, message: '用户ID无效' })
      }

      // 权限检查：管理员可以查看所有用户统计，普通用户只能查看自己的
      // 检查是否是管理员或访问自己的数据
      if (decoded.id !== targetUserId) {
        const [adminUser] = await pool.query(
          'SELECT id FROM users WHERE id = ? AND username = "admin"',
          [decoded.id]
        );

        if (adminUser.length === 0) {
          return reply.code(403).send({ success: false, message: '无权访问此资源' })
        }
      }

      // 获取用户信息
      const [userRows] = await pool.query(
        `SELECT id, username, real_name FROM users WHERE id = ?`,
        [targetUserId]
      )
      if (userRows.length === 0) {
        return reply.code(404).send({ success: false, message: '用户不存在' })
      }
      const user = userRows[0]

      // 1. 参加考试次数、平均分、通过率
      const [summaryStatsRows] = await pool.query(
        `SELECT
          COUNT(id) as total_exams_taken,
          AVG(score) as average_score,
          SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_exams
        FROM assessment_results
        WHERE user_id = ? AND status IN ('graded', 'submitted')`,
        [targetUserId]
      )
      const summaryStats = summaryStatsRows[0]
      const totalExamsTaken = parseInt(summaryStats.total_exams_taken || 0)
      const passRate = totalExamsTaken > 0
        ? (parseInt(summaryStats.passed_exams || 0) / totalExamsTaken).toFixed(4)
        : 0

      // 2. 考试历史记录
      const [examHistoryRows] = await pool.query(
        `SELECT
          ar.id,
          ar.plan_id,
          ar.exam_id,
          ar.submit_time,
          ar.score,
          ar.is_passed,
          ar.status,
          ap.title as plan_title,
          e.title as exam_title,
          e.total_score as exam_total_score
        FROM assessment_results ar
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        WHERE ar.user_id = ? AND ar.status IN ('graded', 'submitted')
        ORDER BY ar.submit_time DESC`,
        [targetUserId]
      )

      const examHistory = examHistoryRows.map(r => ({
        result_id: r.id,
        plan_id: r.plan_id,
        plan_title: r.plan_title,
        exam_id: r.exam_id,
        exam_title: r.exam_title,
        submit_time: r.submit_time,
        user_score: parseFloat(r.score),
        exam_total_score: parseFloat(r.exam_total_score),
        is_passed: r.is_passed === 1,
        status: r.status
      }))

      // TODO: 成绩趋势数据 (需要更复杂的聚合和时间序列处理，暂时省略)

      return {
        success: true,
        message: '获取用户考试统计成功',
        data: {
          user_id: user.id,
          username: user.username,
          real_name: user.real_name,
          summary: {
            total_exams_taken: totalExamsTaken,
            average_score: parseFloat(summaryStats.average_score || 0).toFixed(2),
            pass_rate: passRate
          },
          exam_history: examHistory
        }
      }
    } catch (error) {
      console.error('获取用户考试统计失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取用户考试统计失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 部门成绩对比
  // GET /api/statistics/department
  // 各部门平均分
  // 各部门通过率
  // 各部门参与率
  // 支持时间范围和试卷筛选
  fastify.get('/api/statistics/department', async (request, reply) => {
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

      const { start_date, end_date, exam_id } = request.query

      let whereClauses = [`ar.status IN ('graded', 'submitted')`]
      let queryParams = []

      if (start_date) {
        whereClauses.push(`ar.submit_time >= ?`)
        queryParams.push(start_date)
      }
      if (end_date) {
        whereClauses.push(`ar.submit_time <= ?`)
        queryParams.push(end_date)
      }
      if (exam_id) {
        whereClauses.push(`ar.exam_id = ?`)
        queryParams.push(exam_id)
      }

      const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const [departmentStatsRows] = await pool.query(
        `SELECT
          d.id as department_id,
          d.name as department_name,
          COUNT(DISTINCT ar.user_id) as total_participants,
          COUNT(ar.id) as total_attempts,
          AVG(ar.score) as average_score,
          SUM(CASE WHEN ar.is_passed = 1 THEN 1 ELSE 0 END) as passed_attempts
        FROM assessment_results ar
        INNER JOIN users u ON ar.user_id = u.id
        INNER JOIN departments d ON u.department_id = d.id
        ${whereString}
        GROUP BY d.id, d.name
        ORDER BY d.name ASC`,
        queryParams
      )

      const departmentStats = departmentStatsRows.map(ds => ({
        department_id: ds.department_id,
        department_name: ds.department_name,
        total_participants: parseInt(ds.total_participants || 0),
        total_attempts: parseInt(ds.total_attempts || 0),
        average_score: parseFloat(ds.average_score || 0).toFixed(2),
        pass_rate: ds.total_attempts > 0 ? (ds.passed_attempts / ds.total_attempts).toFixed(4) : 0
        // Participation rate would require total employees in department, which is more complex
      }))

      return {
        success: true,
        message: '获取部门成绩对比统计成功',
        data: departmentStats
      }
    } catch (error) {
      console.error('获取部门成绩对比统计失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取部门成绩对比统计失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 题目分析
  // GET /api/statistics/questions/:examId
  // 每题正确率
  // 每题平均得分
  // 易错题排行（TOP 10）
  // 答题时间分析 (暂时跳过，需要 schema 支持)
  fastify.get('/api/statistics/questions/:examId', async (request, reply) => {
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

      const examId = parseInt(request.params.examId)

      if (isNaN(examId) || examId <= 0) {
        return reply.code(400).send({ success: false, message: '试卷ID无效' })
      }

      // 获取试卷信息
      const [examRows] = await pool.query(
        `SELECT id, title FROM exams WHERE id = ?`,
        [examId]
      )
      if (examRows.length === 0) {
        return reply.code(404).send({ success: false, message: '试卷不存在' })
      }
      const exam = examRows[0]

      // 获取每题的正确率和平均得分
      const [questionStatsRows] = await pool.query(
        `SELECT
          q.id as question_id,
          q.content,
          q.type,
          q.score as question_max_score,
          COUNT(ar.id) as total_answers,
          SUM(CASE WHEN ar.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
          AVG(ar.score) as average_question_score
        FROM questions q
        LEFT JOIN answer_records ar ON q.id = ar.question_id
        LEFT JOIN assessment_results ars ON ar.assessment_result_id = ars.id
        WHERE q.exam_id = ? AND ars.status IN ('graded', 'submitted')
        GROUP BY q.id, q.content, q.type, q.score
        ORDER BY q.order_num ASC`,
        [examId]
      )

      const questionAnalysis = questionStatsRows.map(qs => ({
        question_id: qs.question_id,
        content: qs.content,
        type: qs.type,
        question_max_score: parseFloat(qs.question_max_score),
        total_answers: parseInt(qs.total_answers || 0),
        correct_answers: parseInt(qs.correct_answers || 0),
        correct_rate: qs.total_answers > 0 ? (qs.correct_answers / qs.total_answers).toFixed(4) : 0,
        average_question_score: parseFloat(qs.average_question_score || 0).toFixed(2)
      }))

      // 易错题排行（TOP 10）
      const topIncorrectQuestions = questionAnalysis
        .filter(q => q.total_answers > 0) // Only consider questions with answers
        .sort((a, b) => a.correct_rate - b.correct_rate) // Sort by lowest correct rate
        .slice(0, 10) // Take top 10

      return {
        success: true,
        message: '获取题目分析统计成功',
        data: {
          exam_id: exam.id,
          exam_title: exam.title,
          question_analysis: questionAnalysis,
          top_incorrect_questions: topIncorrectQuestions
        }
      }
    } catch (error) {
      console.error('获取题目分析统计失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取题目分析统计失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 考试排名
  // GET /api/statistics/ranking
  // 支持按试卷或计划筛选
  // 返回成绩排名
  // 支持分页
  // 显示用户信息和成绩
  fastify.get('/api/statistics/ranking', async (request, reply) => {
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

      const { page = 1, pageSize = 10, exam_id, plan_id, sortBy = 'score', sortOrder = 'DESC' } = request.query

      const offset = (page - 1) * pageSize
      const limit = parseInt(pageSize)

      let whereClauses = [`ar.status IN ('graded', 'submitted')`]
      let queryParams = []

      if (exam_id) {
        whereClauses.push(`ar.exam_id = ?`)
        queryParams.push(exam_id)
      }
      if (plan_id) {
        whereClauses.push(`ar.plan_id = ?`)
        queryParams.push(plan_id)
      }

      const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const orderByMapping = {
        score: 'ar.score',
        submit_time: 'ar.submit_time',
        username: 'u.username',
        real_name: 'u.real_name'
      }

      const validSortBy = orderByMapping[sortBy] || orderByMapping.score
      const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      // 获取排名数据
      const [rankingRows] = await pool.query(
        `SELECT
          ar.id as result_id,
          ar.plan_id,
          ar.exam_id,
          ar.user_id,
          ar.score,
          ar.submit_time,
          ar.is_passed,
          u.username,
          u.real_name,
          ap.title as plan_title,
          e.title as exam_title,
          e.total_score as exam_total_score
        FROM assessment_results ar
        INNER JOIN users u ON ar.user_id = u.id
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        ${whereString}
        ORDER BY ${validSortBy} ${validSortOrder}, ar.submit_time ASC
        LIMIT ?, ?`,
        [...queryParams, offset, limit]
      )

      // 计算总数
      const [totalRows] = await pool.query(
        `SELECT COUNT(*) as total
        FROM assessment_results ar
        INNER JOIN users u ON ar.user_id = u.id
        INNER JOIN assessment_plans ap ON ar.plan_id = ap.id
        INNER JOIN exams e ON ar.exam_id = e.id
        ${whereString}`,
        queryParams
      )

      const total = totalRows[0].total

      // 为每个结果计算排名 (简单排名，不处理并列)
      // For more accurate ranking with ties, a window function (ROW_NUMBER, RANK, DENSE_RANK) would be needed,
      // but that's more complex for a simple query.
      // For now, rank is based on the order returned by the query.
      const rankedResults = rankingRows.map((r, index) => ({
        rank: offset + index + 1, // Simple sequential rank
        result_id: r.result_id,
        plan_id: r.plan_id,
        plan_title: r.plan_title,
        exam_id: r.exam_id,
        exam_title: r.exam_title,
        user_id: r.user_id,
        username: r.username,
        real_name: r.real_name,
        score: parseFloat(r.score),
        exam_total_score: parseFloat(r.exam_total_score),
        is_passed: r.is_passed === 1,
        submit_time: r.submit_time
      }))

      return {
        success: true,
        message: '获取考试排名成功',
        data: {
          page: parseInt(page),
          pageSize: limit,
          total,
          results: rankedResults
        }
      }
    } catch (error) {
      console.error('获取考试排名失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取考试排名失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })
}
