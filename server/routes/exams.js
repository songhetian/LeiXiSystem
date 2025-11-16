// 试卷管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 创建试卷
  // POST /api/exams
  // 必填字段验证：title, duration, total_score, pass_score
  // 可选字段：description, category, difficulty
  // 设置 created_by 为当前用户
  // 默认 status 为 'draft'
  // 默认 question_count 为 0
  // 返回创建的试卷 ID
  fastify.post('/api/exams', async (request, reply) => {
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

      const { title, description, category, difficulty, duration, total_score, pass_score } = request.body

      // 必填字段验证
      if (!title || !duration || !total_score || !pass_score) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：title, duration, total_score, pass_score'
        })
      }

      // 数据类型验证
      if (typeof duration !== 'number' || duration <= 0) {
        return reply.code(400).send({
          success: false,
          message: '考试时长必须是大于0的数字'
        })
      }

      if (typeof total_score !== 'number' || total_score <= 0) {
        return reply.code(400).send({
          success: false,
          message: '总分必须是大于0的数字'
        })
      }

      if (typeof pass_score !== 'number' || pass_score < 0) {
        return reply.code(400).send({
          success: false,
          message: '及格分必须是大于等于0的数字'
        })
      }

      if (pass_score > total_score) {
        return reply.code(400).send({
          success: false,
          message: '及格分不能大于总分'
        })
      }

      // 难度验证（如果提供）
      if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
        return reply.code(400).send({
          success: false,
          message: '难度必须是 easy, medium 或 hard'
        })
      }

      // 插入试卷数据
      const [result] = await pool.query(
        `INSERT INTO exams (
          title,
          description,
          category,
          difficulty,
          duration,
          total_score,
          pass_score,
          question_count,
          status,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          category || null,
          difficulty || 'medium',
          duration,
          total_score,
          pass_score,
          0, // 默认 question_count 为 0
          'draft', // 默认 status 为 'draft'
          decoded.id // 设置 created_by 为当前用户
        ]
      )

      return {
        success: true,
        message: '试卷创建成功',
        data: {
          id: result.insertId
        }
      }
    } catch (error) {
      console.error('创建试卷失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '创建失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 更新试卷
  // PUT /api/exams/:id
  // 验证试卷状态（published 状态限制修改）
  // 可更新字段：title, description, category, difficulty, duration, total_score, pass_score
  // 不可更新：question_count（自动计算）
  // 更新 updated_at 时间戳
  fastify.put('/api/exams/:id', async (request, reply) => {
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

      const { id } = request.params
      const { title, description, category, difficulty, duration, total_score, pass_score } = request.body

      // 检查试卷是否存在
      const [examRows] = await pool.query(
        'SELECT id, status, total_score FROM exams WHERE id = ?',
        [id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 验证试卷状态（published 状态限制修改）
      if (exam.status === 'published') {
        return reply.code(403).send({
          success: false,
          message: '已发布的试卷不允许修改，请先将试卷状态改为草稿'
        })
      }

      // 构建更新字段
      const updateFields = []
      const updateValues = []

      if (title !== undefined) {
        if (!title || title.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '试卷标题不能为空'
          })
        }
        updateFields.push('title = ?')
        updateValues.push(title)
      }

      if (description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(description || null)
      }

      if (category !== undefined) {
        updateFields.push('category = ?')
        updateValues.push(category || null)
      }

      if (difficulty !== undefined) {
        if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
          return reply.code(400).send({
            success: false,
            message: '难度必须是 easy, medium 或 hard'
          })
        }
        updateFields.push('difficulty = ?')
        updateValues.push(difficulty || 'medium')
      }

      if (duration !== undefined) {
        if (typeof duration !== 'number' || duration <= 0) {
          return reply.code(400).send({
            success: false,
            message: '考试时长必须是大于0的数字'
          })
        }
        updateFields.push('duration = ?')
        updateValues.push(duration)
      }

      if (total_score !== undefined) {
        if (typeof total_score !== 'number' || total_score <= 0) {
          return reply.code(400).send({
            success: false,
            message: '总分必须是大于0的数字'
          })
        }
        updateFields.push('total_score = ?')
        updateValues.push(total_score)
      }

      if (pass_score !== undefined) {
        if (typeof pass_score !== 'number' || pass_score < 0) {
          return reply.code(400).send({
            success: false,
            message: '及格分必须是大于等于0的数字'
          })
        }

        // 如果同时更新 total_score 和 pass_score，需要验证关系
        const finalTotalScore = total_score !== undefined ? total_score : exam.total_score
        if (pass_score > finalTotalScore) {
          return reply.code(400).send({
            success: false,
            message: '及格分不能大于总分'
          })
        }

        updateFields.push('pass_score = ?')
        updateValues.push(pass_score)
      }

      // 如果没有任何字段需要更新
      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供需要更新的字段'
        })
      }

      // 添加 updated_at 时间戳
      updateFields.push('updated_at = NOW()')

      // 执行更新
      updateValues.push(id)
      const updateQuery = `UPDATE exams SET ${updateFields.join(', ')} WHERE id = ?`

      await pool.query(updateQuery, updateValues)

      return {
        success: true,
        message: '试卷更新成功'
      }
    } catch (error) {
      console.error('更新试卷失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '更新失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取试卷详情
  // GET /api/exams/:id
  // 返回试卷完整信息，包含题目数量统计（按题型分组）
  // 不包含题目内容和答案（防止泄题）
  // 包含创建人信息
  fastify.get('/api/exams/:id', async (request, reply) => {
    const { id } = request.params

    try {
      // 获取试卷基本信息和创建人信息
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
          e.status,
          e.created_at,
          e.updated_at,
          u.id as creator_id,
          u.username as creator_username,
          u.real_name as creator_name
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = ?`,
        [id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 获取题目数量统计（按题型分组）
      const [questionStats] = await pool.query(
        `SELECT
          type,
          COUNT(*) as count,
          SUM(score) as total_score
        FROM questions
        WHERE exam_id = ?
        GROUP BY type`,
        [id]
      )

      // 格式化题目统计数据
      const questionStatistics = {
        single_choice: { count: 0, total_score: 0 },
        multiple_choice: { count: 0, total_score: 0 },
        true_false: { count: 0, total_score: 0 },
        fill_blank: { count: 0, total_score: 0 },
        essay: { count: 0, total_score: 0 }
      }

      questionStats.forEach(stat => {
        questionStatistics[stat.type] = {
          count: stat.count,
          total_score: parseFloat(stat.total_score)
        }
      })

      // 构建返回数据
      const result = {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        category: exam.category,
        difficulty: exam.difficulty,
        duration: exam.duration,
        total_score: parseFloat(exam.total_score),
        pass_score: parseFloat(exam.pass_score),
        question_count: exam.question_count,
        status: exam.status,
        created_at: exam.created_at,
        updated_at: exam.updated_at,
        creator: exam.creator_id ? {
          id: exam.creator_id,
          username: exam.creator_username,
          name: exam.creator_name
        } : null,
        question_statistics: questionStatistics
      }

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('获取试卷详情失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取失败'
      })
    }
  })

  // 更新试卷状态
  // PUT /api/exams/:id/status
  // 支持状态转换：draft -> published, published -> archived
  // 发布前验证：题目数量 > 0，总分匹配
  // 记录状态变更日志
  fastify.put('/api/exams/:id/status', async (request, reply) => {
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

      const { id } = request.params
      const { status } = request.body

      // 验证状态参数
      if (!status) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：status'
        })
      }

      const validStatuses = ['draft', 'published', 'archived']
      if (!validStatuses.includes(status)) {
        return reply.code(400).send({
          success: false,
          message: '无效的状态值，必须是 draft, published 或 archived'
        })
      }

      // 获取试卷当前信息
      const [examRows] = await pool.query(
        `SELECT
          e.id,
          e.title,
          e.status,
          e.question_count,
          e.total_score,
          COALESCE(SUM(q.score), 0) as calculated_total_score
        FROM exams e
        LEFT JOIN questions q ON e.id = q.exam_id
        WHERE e.id = ?
        GROUP BY e.id`,
        [id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]
      const currentStatus = exam.status
      const calculatedTotalScore = parseFloat(exam.calculated_total_score)

      // 验证状态转换规则
      const validTransitions = {
        'draft': ['published'],
        'published': ['archived'],
        'archived': ['published']
      }

      if (!validTransitions[currentStatus]?.includes(status)) {
        return reply.code(400).send({
          success: false,
          message: `不允许从 ${currentStatus} 状态转换到 ${status} 状态`,
          data: {
            current_status: currentStatus,
            requested_status: status,
            allowed_transitions: validTransitions[currentStatus] || []
          }
        })
      }

      // 如果要发布试卷，进行发布前验证
      if (status === 'published') {
        // 验证题目数量 > 0
        if (exam.question_count === 0) {
          return reply.code(400).send({
            success: false,
            message: '无法发布试卷：试卷必须至少包含一道题目',
            data: {
              question_count: exam.question_count
            }
          })
        }

        // 验证总分匹配
        const examTotalScore = parseFloat(exam.total_score)
        if (Math.abs(calculatedTotalScore - examTotalScore) > 0.01) {
          return reply.code(400).send({
            success: false,
            message: '无法发布试卷：试卷总分与题目分值总和不匹配',
            data: {
              exam_total_score: examTotalScore,
              calculated_total_score: calculatedTotalScore,
              difference: Math.abs(calculatedTotalScore - examTotalScore)
            }
          })
        }
      }

      // 更新试卷状态
      await pool.query(
        'UPDATE exams SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, id]
      )

      // 记录状态变更日志（插入到系统日志表，如果存在的话）
      // 可在此处写入系统日志表

      return {
        success: true,
        message: `试卷状态已更新为 ${status}`,
        data: {
          exam_id: parseInt(id),
          exam_title: exam.title,
          previous_status: currentStatus,
          new_status: status,
          updated_by: decoded.id,
          updated_at: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('更新试卷状态失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '更新状态失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取试卷题目列表
  // GET /api/exams/:examId/questions
  // 按 order_num 升序排列
  // 支持题型筛选（type）
  // 管理员返回完整信息（含答案）
  // 考生不返回 correct_answer 字段
  // 返回题目统计信息
  fastify.get('/api/exams/:examId/questions', async (request, reply) => {
    try {
      const { examId } = request.params
      const { type } = request.query

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

      // 检查试卷是否存在
      const [examRows] = await pool.query(
        'SELECT id, title, status FROM exams WHERE id = ?',
        [examId]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 检查用户角色（判断是否为管理员）
      const [userRoles] = await pool.query(
        `SELECT r.name, r.level
        FROM roles r
        INNER JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?`,
        [decoded.id]
      )

      // 判断是否为管理员（超级管理员、系统管理员、培训师等有管理权限的角色）
      const isAdmin = userRoles.some(role =>
        ['超级管理员', '系统管理员', '培训师', '客服主管'].includes(role.name) ||
        role.level >= 5
      )

      // 构建查询条件
      const selectFields = [
        'id',
        'exam_id',
        'type',
        'content',
        'options'
      ]

      if (isAdmin) {
        selectFields.push('correct_answer')
      }

      selectFields.push('score')

      if (isAdmin) {
        selectFields.push('explanation')
      }

      selectFields.push('order_num', 'created_at', 'updated_at')

      let query = `
        SELECT ${selectFields.join(', ')}
        FROM questions
        WHERE exam_id = ?
      `
      const queryParams = [examId]

      // 支持题型筛选
      if (type) {
        const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'essay']
        if (!validTypes.includes(type)) {
          return reply.code(400).send({
            success: false,
            message: '无效的题型，必须是 single_choice, multiple_choice, true_false, fill_blank 或 essay'
          })
        }
        query += ' AND type = ?'
        queryParams.push(type)
      }

      // 按 order_num 升序排列
      query += ' ORDER BY order_num ASC'

      const [questions] = await pool.query(query, queryParams)

      // 获取题目统计信息
      const [statistics] = await pool.query(
        `SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN type = 'single_choice' THEN 1 ELSE 0 END) as single_choice_count,
          SUM(CASE WHEN type = 'multiple_choice' THEN 1 ELSE 0 END) as multiple_choice_count,
          SUM(CASE WHEN type = 'true_false' THEN 1 ELSE 0 END) as true_false_count,
          SUM(CASE WHEN type = 'fill_blank' THEN 1 ELSE 0 END) as fill_blank_count,
          SUM(CASE WHEN type = 'essay' THEN 1 ELSE 0 END) as essay_count,
          SUM(score) as total_score
        FROM questions
        WHERE exam_id = ?`,
        [examId]
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
            console.error(`原始 options 值:`, q.options)
            // 如果解析失败，尝试作为字符串数组处理
            parsedOptions = q.options
          }
        }

        const question = {
          id: q.id,
          exam_id: q.exam_id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          score: parseFloat(q.score),
          order_num: q.order_num,
          created_at: q.created_at,
          updated_at: q.updated_at
        }

        // 只有管理员才能看到正确答案和解析
        if (isAdmin) {
          question.correct_answer = q.correct_answer
          question.explanation = q.explanation
        }

        return question
      })

      return {
        success: true,
        data: {
          exam: {
            id: exam.id,
            title: exam.title,
            status: exam.status
          },
          questions: formattedQuestions,
          statistics: {
            total_count: statistics[0].total_count,
            single_choice_count: statistics[0].single_choice_count,
            multiple_choice_count: statistics[0].multiple_choice_count,
            true_false_count: statistics[0].true_false_count,
            fill_blank_count: statistics[0].fill_blank_count,
            essay_count: statistics[0].essay_count,
            total_score: parseFloat(statistics[0].total_score || 0)
          },
          is_admin: isAdmin
        }
      }
    } catch (error) {
      console.error('获取试卷题目列表失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      console.error('SQL错误代码:', error.code)
      console.error('SQL错误编号:', error.errno)
      console.error('SQL状态:', error.sqlState)
      console.error('SQL消息:', error.sqlMessage)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取题目详情
  // GET /api/questions/:id
  // 返回题目完整信息
  // 根据用户角色控制答案可见性
  // 包含所属试卷信息
  fastify.get('/api/questions/:id', async (request, reply) => {
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

      // 检查用户角色（判断是否为管理员）
      const [userRoles] = await pool.query(
        `SELECT r.name, r.level
        FROM roles r
        INNER JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?`,
        [decoded.id]
      )

      // 判断是否为管理员（超级管理员、系统管理员、培训师等有管理权限的角色）
      const isAdmin = userRoles.some(role =>
        ['超级管理员', '系统管理员', '培训师', '客服主管'].includes(role.name) ||
        role.level >= 5
      )

      // 获取题目详情和所属试卷信息
      const [questionRows] = await pool.query(
        `SELECT
          q.id,
          q.exam_id,
          q.type,
          q.content,
          q.options,
          q.correct_answer,
          q.score,
          q.explanation,
          q.order_num,
          q.created_at,
          q.updated_at,
          e.id as exam_id,
          e.title as exam_title,
          e.category as exam_category,
          e.difficulty as exam_difficulty,
          e.status as exam_status
        FROM questions q
        INNER JOIN exams e ON q.exam_id = e.id
        WHERE q.id = ?`,
        [id]
      )

      if (questionRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '题目不存在'
        })
      }

      const question = questionRows[0]

      // 安全解析 options JSON
      let parsedOptions = null
      if (question.options) {
        try {
          parsedOptions = JSON.parse(question.options)
        } catch (error) {
          console.error(`题目 ${question.id} 的 options 字段 JSON 解析失败:`, error.message)
          console.error(`原始 options 值:`, question.options)
          // 如果解析失败，保留原始值
          parsedOptions = question.options
        }
      }

      // 构建返回数据
      const result = {
        id: question.id,
        exam_id: question.exam_id,
        type: question.type,
        content: question.content,
        options: parsedOptions,
        score: parseFloat(question.score),
        order_num: question.order_num,
        created_at: question.created_at,
        updated_at: question.updated_at,
        exam: {
          id: question.exam_id,
          title: question.exam_title,
          category: question.exam_category,
          difficulty: question.exam_difficulty,
          status: question.exam_status
        }
      }

      // 只有管理员才能看到正确答案和解析
      if (isAdmin) {
        result.correct_answer = question.correct_answer
        result.explanation = question.explanation
      }

      return {
        success: true,
        data: result,
        is_admin: isAdmin
      }
    } catch (error) {
      console.error('获取题目详情失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 添加题目
  // POST /api/exams/:examId/questions
  // 验证题型：single_choice, multiple_choice, true_false, fill_blank, essay
  // 验证选项格式（JSON，选择题必填）
  // 验证正确答案格式
  // 自动设置 order_num（当前最大值 + 1）
  // 更新试卷的 question_count 和 total_score
  // 返回创建的题目 ID
  fastify.post('/api/exams/:examId/questions', async (request, reply) => {
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

      const { examId } = request.params
      const { type, content, options, correct_answer, score, explanation } = request.body

      // 必填字段验证
      if (!type || !content || !correct_answer || score === undefined || score === null) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：type, content, correct_answer, score'
        })
      }

      // 验证题型
      const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'essay']
      if (!validTypes.includes(type)) {
        return reply.code(400).send({
          success: false,
          message: '无效的题型，必须是 single_choice, multiple_choice, true_false, fill_blank 或 essay'
        })
      }

      // 验证分值
      if (typeof score !== 'number' || score <= 0) {
        return reply.code(400).send({
          success: false,
          message: '分值必须是大于0的数字'
        })
      }

      // 检查试卷是否存在
      const [examRows] = await pool.query(
        'SELECT id, status, total_score FROM exams WHERE id = ?',
        [examId]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 验证试卷状态（published 状态限制修改）
      if (exam.status === 'published') {
        return reply.code(403).send({
          success: false,
          message: '已发布的试卷不允许添加题目，请先将试卷状态改为草稿'
        })
      }

      // 验证选项格式（选择题必填）
      let optionsJson = null
      if (type === 'single_choice' || type === 'multiple_choice') {
        if (!options) {
          return reply.code(400).send({
            success: false,
            message: '选择题必须提供选项'
          })
        }

        // 验证 options 是否为数组
        if (!Array.isArray(options)) {
          return reply.code(400).send({
            success: false,
            message: '选项必须是数组格式'
          })
        }

        // 验证选项数量
        if (options.length < 2) {
          return reply.code(400).send({
            success: false,
            message: '选择题至少需要2个选项'
          })
        }

        if (options.length > 10) {
          return reply.code(400).send({
            success: false,
            message: '选择题最多支持10个选项'
          })
        }

        // 验证选项内容
        for (let i = 0; i < options.length; i++) {
          if (!options[i] || typeof options[i] !== 'string' || options[i].trim() === '') {
            return reply.code(400).send({
              success: false,
              message: `选项 ${i + 1} 不能为空`
            })
          }
        }

        // 转换为 JSON 字符串
        optionsJson = JSON.stringify(options)
      } else if (type === 'true_false') {
        // 判断题自动设置选项
        optionsJson = JSON.stringify(['正确', '错误'])
      }

      // 验证正确答案格式
      if (type === 'single_choice') {
        // 单选题答案应该是 A, B, C, D 等
        const validAnswerPattern = /^[A-J]$/
        if (!validAnswerPattern.test(correct_answer)) {
          return reply.code(400).send({
            success: false,
            message: '单选题答案必须是 A-J 之间的单个字母'
          })
        }

        // 验证答案索引是否在选项范围内
        const answerIndex = correct_answer.charCodeAt(0) - 'A'.charCodeAt(0)
        if (answerIndex >= options.length) {
          return reply.code(400).send({
            success: false,
            message: `答案 ${correct_answer} 超出选项范围（共 ${options.length} 个选项）`
          })
        }
      } else if (type === 'multiple_choice') {
        // 多选题答案应该是 AB, ABC, ACD 等
        const validAnswerPattern = /^[A-J]+$/
        if (!validAnswerPattern.test(correct_answer)) {
          return reply.code(400).send({
            success: false,
            message: '多选题答案必须是 A-J 之间的字母组合（如 AB, ABC）'
          })
        }

        // 验证至少有2个答案
        if (correct_answer.length < 2) {
          return reply.code(400).send({
            success: false,
            message: '多选题至少需要2个正确答案'
          })
        }

        // 验证答案中没有重复字母
        const uniqueAnswers = new Set(correct_answer.split(''))
        if (uniqueAnswers.size !== correct_answer.length) {
          return reply.code(400).send({
            success: false,
            message: '多选题答案中不能有重复的选项'
          })
        }

        // 验证所有答案索引是否在选项范围内
        for (let i = 0; i < correct_answer.length; i++) {
          const answerIndex = correct_answer.charCodeAt(i) - 'A'.charCodeAt(0)
          if (answerIndex >= options.length) {
            return reply.code(400).send({
              success: false,
              message: `答案 ${correct_answer[i]} 超出选项范围（共 ${options.length} 个选项）`
            })
          }
        }
      } else if (type === 'true_false') {
        // 判断题答案应该是 A（正确）或 B（错误）
        if (correct_answer !== 'A' && correct_answer !== 'B') {
          return reply.code(400).send({
            success: false,
            message: '判断题答案必须是 A（正确）或 B（错误）'
          })
        }
      }

      // 开始事务
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 获取当前最大 order_num
        const [maxOrderRows] = await connection.query(
          'SELECT COALESCE(MAX(order_num), 0) as max_order FROM questions WHERE exam_id = ?',
          [examId]
        )
        const nextOrderNum = maxOrderRows[0].max_order + 1

        // 插入题目
        const [result] = await connection.query(
          `INSERT INTO questions (
            exam_id,
            type,
            content,
            options,
            correct_answer,
            score,
            explanation,
            order_num
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            examId,
            type,
            content,
            optionsJson,
            correct_answer,
            score,
            explanation || null,
            nextOrderNum
          ]
        )

        // 更新试卷的 question_count 和 total_score
        await connection.query(
          `UPDATE exams
          SET question_count = question_count + 1,
              total_score = total_score + ?,
              updated_at = NOW()
          WHERE id = ?`,
          [score, examId]
        )

        await connection.commit()

        return {
          success: true,
          message: '题目添加成功',
          data: {
            id: result.insertId,
            order_num: nextOrderNum
          }
        }
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('添加题目失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '添加失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 更新题目
  // PUT /api/questions/:id
  // 验证试卷状态（published 限制修改）
  // 可更新所有字段
  // 重新计算试卷总分
  // 更新 updated_at
  fastify.put('/api/questions/:id', async (request, reply) => {
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

      const { id } = request.params
      const { type, content, options, correct_answer, score, explanation } = request.body

      // 检查题目是否存在
      const [questionRows] = await pool.query(
        'SELECT id, exam_id, score FROM questions WHERE id = ?',
        [id]
      )

      if (questionRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '题目不存在'
        })
      }

      const question = questionRows[0]
      const oldScore = parseFloat(question.score)

      // 检查试卷状态
      const [examRows] = await pool.query(
        'SELECT id, status FROM exams WHERE id = ?',
        [question.exam_id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '所属试卷不存在'
        })
      }

      const exam = examRows[0]

      // 验证试卷状态（published 限制修改）
      if (exam.status === 'published') {
        return reply.code(403).send({
          success: false,
          message: '已发布的试卷不允许修改题目，请先将试卷状态改为草稿'
        })
      }

      // 构建更新字段
      const updateFields = []
      const updateValues = []
      let newScore = oldScore

      if (type !== undefined) {
        // 验证题型
        const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'essay']
        if (!validTypes.includes(type)) {
          return reply.code(400).send({
            success: false,
            message: '无效的题型，必须是 single_choice, multiple_choice, true_false, fill_blank 或 essay'
          })
        }
        updateFields.push('type = ?')
        updateValues.push(type)
      }

      if (content !== undefined) {
        if (!content || content.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '题目内容不能为空'
          })
        }
        updateFields.push('content = ?')
        updateValues.push(content)
      }

      if (options !== undefined) {
        // 如果提供了 options，验证格式
        if (options !== null) {
          if (!Array.isArray(options)) {
            return reply.code(400).send({
              success: false,
              message: '选项必须是数组格式'
            })
          }

          // 验证选项数量
          if (options.length < 2) {
            return reply.code(400).send({
              success: false,
              message: '选择题至少需要2个选项'
            })
          }

          if (options.length > 10) {
            return reply.code(400).send({
              success: false,
              message: '选择题最多支持10个选项'
            })
          }

          // 验证选项内容
          for (let i = 0; i < options.length; i++) {
            if (!options[i] || typeof options[i] !== 'string' || options[i].trim() === '') {
              return reply.code(400).send({
                success: false,
                message: `选项 ${i + 1} 不能为空`
              })
            }
          }

          updateFields.push('options = ?')
          updateValues.push(JSON.stringify(options))
        } else {
          updateFields.push('options = ?')
          updateValues.push(null)
        }
      }

      if (correct_answer !== undefined) {
        if (!correct_answer || correct_answer.trim() === '') {
          return reply.code(400).send({
            success: false,
            message: '正确答案不能为空'
          })
        }
        updateFields.push('correct_answer = ?')
        updateValues.push(correct_answer)
      }

      if (score !== undefined) {
        // 验证分值
        if (typeof score !== 'number' || score <= 0) {
          return reply.code(400).send({
            success: false,
            message: '分值必须是大于0的数字'
          })
        }
        newScore = score
        updateFields.push('score = ?')
        updateValues.push(score)
      }

      if (explanation !== undefined) {
        updateFields.push('explanation = ?')
        updateValues.push(explanation || null)
      }

      // 如果没有任何字段需要更新
      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '没有提供需要更新的字段'
        })
      }

      // 添加 updated_at 时间戳
      updateFields.push('updated_at = NOW()')

      // 开始事务
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 执行更新
        updateValues.push(id)
        const updateQuery = `UPDATE questions SET ${updateFields.join(', ')} WHERE id = ?`
        await connection.query(updateQuery, updateValues)

        // 如果分值发生变化，重新计算试卷总分
        if (newScore !== oldScore) {
          const scoreDifference = newScore - oldScore
          await connection.query(
            `UPDATE exams
            SET total_score = total_score + ?,
                updated_at = NOW()
            WHERE id = ?`,
            [scoreDifference, question.exam_id]
          )
        }

        await connection.commit()

        return {
          success: true,
          message: '题目更新成功',
          data: {
            id: parseInt(id),
            score_changed: newScore !== oldScore,
            old_score: oldScore,
            new_score: newScore
          }
        }
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('更新题目失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '更新失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 删除题目
  // DELETE /api/questions/:id
  // 检查是否有答题记录
  // 更新试卷 question_count 和 total_score
  // 重新排序剩余题目的 order_num
  fastify.delete('/api/questions/:id', async (request, reply) => {
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

      const { id } = request.params

      // 检查题目是否存在
      const [questionRows] = await pool.query(
        'SELECT id, exam_id, score, order_num FROM questions WHERE id = ?',
        [id]
      )

      if (questionRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '题目不存在'
        })
      }

      const question = questionRows[0]
      const examId = question.exam_id
      const questionScore = parseFloat(question.score)
      const questionOrderNum = question.order_num

      // 检查试卷状态
      const [examRows] = await pool.query(
        'SELECT id, title, status FROM exams WHERE id = ?',
        [examId]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '所属试卷不存在'
        })
      }

      const exam = examRows[0]

      // 验证试卷状态（published 状态限制修改）
      if (exam.status === 'published') {
        return reply.code(403).send({
          success: false,
          message: '已发布的试卷不允许删除题目，请先将试卷状态改为草稿'
        })
      }

      // 检查是否有答题记录
      const [answerRecordRows] = await pool.query(
        'SELECT COUNT(*) as count FROM answer_records WHERE question_id = ?',
        [id]
      )

      if (answerRecordRows[0].count > 0) {
        return reply.code(400).send({
          success: false,
          message: '该题目已有答题记录，无法删除',
          data: {
            answer_record_count: answerRecordRows[0].count
          }
        })
      }

      // 开始事务
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 删除题目
        await connection.query(
          'DELETE FROM questions WHERE id = ?',
          [id]
        )

        // 更新试卷的 question_count 和 total_score
        await connection.query(
          `UPDATE exams
          SET question_count = question_count - 1,
              total_score = total_score - ?,
              updated_at = NOW()
          WHERE id = ?`,
          [questionScore, examId]
        )

        // 重新排序剩余题目的 order_num（将被删除题目后面的题目序号减1）
        await connection.query(
          `UPDATE questions
          SET order_num = order_num - 1,
              updated_at = NOW()
          WHERE exam_id = ? AND order_num > ?`,
          [examId, questionOrderNum]
        )

        await connection.commit()

        return {
          success: true,
          message: '题目删除成功',
          data: {
            question_id: parseInt(id),
            exam_id: examId,
            exam_title: exam.title,
            deleted_score: questionScore
          }
        }
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('删除题目失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '删除失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 题目排序
  // PUT /api/exams/:examId/questions/reorder
  // 接收题目 ID 数组
  // 批量更新 order_num
  // 验证所有题目归属于该试卷
  fastify.put('/api/exams/:examId/questions/reorder', async (request, reply) => {
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

      const { examId } = request.params
      const { questionIds } = request.body

      // 验证必填字段
      if (!questionIds || !Array.isArray(questionIds)) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：questionIds（必须是数组）'
        })
      }

      // 验证数组不为空
      if (questionIds.length === 0) {
        return reply.code(400).send({
          success: false,
          message: '题目ID数组不能为空'
        })
      }

      // 验证数组元素都是数字
      for (let i = 0; i < questionIds.length; i++) {
        if (typeof questionIds[i] !== 'number' || questionIds[i] <= 0) {
          return reply.code(400).send({
            success: false,
            message: `题目ID必须是大于0的数字，位置 ${i} 的值无效`
          })
        }
      }

      // 检查试卷是否存在
      const [examRows] = await pool.query(
        'SELECT id, title, status FROM exams WHERE id = ?',
        [examId]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 验证试卷状态（published 状态限制修改）
      if (exam.status === 'published') {
        return reply.code(403).send({
          success: false,
          message: '已发布的试卷不允许修改题目顺序，请先将试卷状态改为草稿'
        })
      }

      // 验证所有题目归属于该试卷
      const [questionRows] = await pool.query(
        `SELECT id, exam_id FROM questions WHERE id IN (${questionIds.map(() => '?').join(',')})`,
        questionIds
      )

      // 检查是否所有题目都存在
      if (questionRows.length !== questionIds.length) {
        const foundIds = questionRows.map(q => q.id)
        const missingIds = questionIds.filter(id => !foundIds.includes(id))
        return reply.code(404).send({
          success: false,
          message: '部分题目不存在',
          data: {
            missing_question_ids: missingIds
          }
        })
      }

      // 检查所有题目是否都属于该试卷
      const invalidQuestions = questionRows.filter(q => q.exam_id !== parseInt(examId))
      if (invalidQuestions.length > 0) {
        return reply.code(400).send({
          success: false,
          message: '部分题目不属于该试卷',
          data: {
            invalid_question_ids: invalidQuestions.map(q => q.id)
          }
        })
      }

      // 开始事务，批量更新 order_num
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 批量更新每个题目的 order_num
        for (let i = 0; i < questionIds.length; i++) {
          const questionId = questionIds[i]
          const newOrderNum = i + 1 // order_num 从 1 开始

          await connection.query(
            'UPDATE questions SET order_num = ?, updated_at = NOW() WHERE id = ?',
            [newOrderNum, questionId]
          )
        }

        // 更新试卷的 updated_at
        await connection.query(
          'UPDATE exams SET updated_at = NOW() WHERE id = ?',
          [examId]
        )

        await connection.commit()

        return {
          success: true,
          message: '题目顺序更新成功',
          data: {
            exam_id: parseInt(examId),
            exam_title: exam.title,
            reordered_count: questionIds.length
          }
        }
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('题目排序失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '排序失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 删除试卷
  // DELETE /api/exams/:id
  // 检查是否有关联的考核计划
  // 检查是否有考试记录
  // 级联删除相关题目
  // 返回删除结果
  fastify.delete('/api/exams/:id', async (request, reply) => {
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

      const { id } = request.params

      // 检查试卷是否存在
      const [examRows] = await pool.query(
        'SELECT id, title FROM exams WHERE id = ?',
        [id]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '试卷不存在'
        })
      }

      const exam = examRows[0]

      // 检查是否有关联的考核计划
      const [planRows] = await pool.query(
        'SELECT COUNT(*) as count FROM assessment_plans WHERE exam_id = ?',
        [id]
      )

      if (planRows[0].count > 0) {
        return reply.code(400).send({
          success: false,
          message: '该试卷已被考核计划使用，无法删除',
          data: {
            assessment_plan_count: planRows[0].count
          }
        })
      }

      // 检查是否有考试记录
      const [resultRows] = await pool.query(
        'SELECT COUNT(*) as count FROM assessment_results WHERE exam_id = ?',
        [id]
      )

      if (resultRows[0].count > 0) {
        return reply.code(400).send({
          success: false,
          message: '该试卷已有考试记录，无法删除',
          data: {
            exam_record_count: resultRows[0].count
          }
        })
      }

      // 开始事务，级联删除相关题目和试卷
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 删除相关题目（虽然有外键级联删除，但显式删除更清晰）
        const [deleteQuestionsResult] = await connection.query(
          'DELETE FROM questions WHERE exam_id = ?',
          [id]
        )

        // 删除试卷
        await connection.query(
          'DELETE FROM exams WHERE id = ?',
          [id]
        )

        await connection.commit()

        return {
          success: true,
          message: '试卷删除成功',
          data: {
            exam_id: parseInt(id),
            exam_title: exam.title,
            deleted_questions_count: deleteQuestionsResult.affectedRows
          }
        }
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('删除试卷失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '删除失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取考核计划列表
  // GET /api/assessment-plans
  // 支持分页
  // 支持状态筛选：draft, published, ongoing, completed, cancelled
  // 支持时间范围筛选（start_time, end_time）
  // 返回计划基本信息和参与统计
  // 包含试卷标题
  fastify.get('/api/assessment-plans', async (request, reply) => {
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

      // 获取查询参数
      const {
        page = 1,
        limit = 10,
        status,
        start_time_from,
        start_time_to,
        end_time_from,
        end_time_to
      } = request.query

      // 验证分页参数
      const pageNum = parseInt(page)
      const limitNum = parseInt(limit)

      if (isNaN(pageNum) || pageNum < 1) {
        return reply.code(400).send({
          success: false,
          message: '页码必须是大于0的整数'
        })
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return reply.code(400).send({
          success: false,
          message: '每页数量必须是1-100之间的整数'
        })
      }

      // 验证状态参数
      if (status) {
        const validStatuses = ['draft', 'published', 'ongoing', 'completed', 'cancelled']
        if (!validStatuses.includes(status)) {
          return reply.code(400).send({
            success: false,
            message: '无效的状态值，必须是 draft, published, ongoing, completed 或 cancelled'
          })
        }
      }

      const offset = (pageNum - 1) * limitNum

      // 构建查询条件
      let query = `
        SELECT
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
          e.title as exam_title,
          e.category as exam_category,
          e.difficulty as exam_difficulty,
          e.duration as exam_duration,
          e.total_score as exam_total_score,
          e.pass_score as exam_pass_score
        FROM assessment_plans ap
        INNER JOIN exams e ON ap.exam_id = e.id
        WHERE 1=1
      `
      const params = []

      // 状态筛选
      if (status) {
        query += ' AND ap.status = ?'
        params.push(status)
      }

      // 开始时间范围筛选
      if (start_time_from) {
        query += ' AND ap.start_time >= ?'
        params.push(start_time_from)
      }

      if (start_time_to) {
        query += ' AND ap.start_time <= ?'
        params.push(start_time_to)
      }

      // 结束时间范围筛选
      if (end_time_from) {
        query += ' AND ap.end_time >= ?'
        params.push(end_time_from)
      }

      if (end_time_to) {
        query += ' AND ap.end_time <= ?'
        params.push(end_time_to)
      }

      // 获取总数
      const countQuery = query.replace(
        /SELECT[\s\S]*FROM/,
        'SELECT COUNT(*) as total FROM'
      )
      const [countResult] = await pool.query(countQuery, params)
      const total = countResult[0].total

      // 分页查询，按创建时间倒序排列
      query += ' ORDER BY ap.created_at DESC LIMIT ? OFFSET ?'
      params.push(limitNum, offset)

      const [plans] = await pool.query(query, params)

      // 为每个计划获取参与统计
      const plansWithStats = await Promise.all(plans.map(async (plan) => {
        // 解析 target_users JSON
        let targetUsers = []
        try {
          targetUsers = plan.target_users ? JSON.parse(plan.target_users) : []
        } catch (error) {
          console.error(`计划 ${plan.id} 的 target_users 解析失败:`, error.message)
          targetUsers = []
        }

        const totalUsers = targetUsers.length

        // 统计已完成人数（status 为 'submitted' 或 'graded'）
        const [completedStats] = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as completed_count
          FROM assessment_results
          WHERE plan_id = ? AND status IN ('submitted', 'graded')`,
          [plan.id]
        )

        const completedCount = completedStats[0].completed_count

        // 统计通过人数
        const [passedStats] = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as passed_count
          FROM assessment_results
          WHERE plan_id = ? AND is_passed = 1`,
          [plan.id]
        )

        const passedCount = passedStats[0].passed_count

        // 计算通过率
        const passRate = completedCount > 0 ? ((passedCount / completedCount) * 100).toFixed(2) : '0.00'

        return {
          id: plan.id,
          title: plan.title,
          description: plan.description,
          exam_id: plan.exam_id,
          exam_title: plan.exam_title,
          exam_category: plan.exam_category,
          exam_difficulty: plan.exam_difficulty,
          exam_duration: plan.exam_duration,
          exam_total_score: parseFloat(plan.exam_total_score),
          exam_pass_score: parseFloat(plan.exam_pass_score),
          start_time: plan.start_time,
          end_time: plan.end_time,
          max_attempts: plan.max_attempts,
          status: plan.status,
          created_by: plan.created_by,
          created_at: plan.created_at,
          updated_at: plan.updated_at,
          participation_stats: {
            total_users: totalUsers,
            completed_count: completedCount,
            passed_count: passedCount,
            pass_rate: parseFloat(passRate),
            completion_rate: totalUsers > 0 ? ((completedCount / totalUsers) * 100).toFixed(2) : '0.00'
          }
        }
      }))

      return {
        success: true,
        data: plansWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    } catch (error) {
      console.error('获取考核计划列表失败:', error)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })
}
