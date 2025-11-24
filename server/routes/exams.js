// 试卷管理 API
const { extractUserPermissions } = require('../middleware/checkPermission')
const jwt = require('jsonwebtoken')
const ExcelJS = require('exceljs')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 获取试卷列表
  // GET /api/exams
  // 支持分页参数（page, pageSize）
  // 支持筛选（category, difficulty, status, creator_id）
  // 支持搜索（title 模糊查询）
  // 支持排序（sort_by: created_at|title, order: asc|desc）
  // 返回字段：基础字段 + 创建人信息（creator_id, creator_name, creator_username）
  fastify.get('/api/exams', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: '未提供认证令牌'
        })
      }

      try {
        jwt.verify(token, JWT_SECRET)
      } catch (error) {
        return reply.code(401).send({
          success: false,
          message: '无效的认证令牌'
        })
      }

      const {
        page = 1,
        pageSize = 10,
        category,
        difficulty,
        status,
        title,
        creator_id,
        sort_by = 'created_at',
        order = 'desc'
      } = request.query

      const pageNum = parseInt(page)
      const limitNum = parseInt(pageSize)
      if (isNaN(pageNum) || pageNum < 1) {
        return reply.code(400).send({ success: false, message: '页码必须是大于0的整数' })
      }
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return reply.code(400).send({ success: false, message: '每页数量必须是1-100之间的整数' })
      }

      let whereClauses = []
      let params = []

      if (category) {
        whereClauses.push('category = ?')
        params.push(category)
      }
      if (difficulty) {
        const validDifficulties = ['easy', 'medium', 'hard']
        if (!validDifficulties.includes(difficulty)) {
          return reply.code(400).send({ success: false, message: '难度必须是 easy, medium 或 hard' })
        }
        whereClauses.push('difficulty = ?')
        params.push(difficulty)
      }
      if (status) {
        const validStatuses = ['draft', 'published', 'archived']
        if (!validStatuses.includes(status)) {
          return reply.code(400).send({ success: false, message: '状态必须是 draft, published 或 archived' })
        }
        whereClauses.push('e.status = ?')
        params.push(status)
      }
      if (title) {
        whereClauses.push('e.title LIKE ?')
        params.push(`%${title}%`)
      }
      if (creator_id) {
        const cid = parseInt(creator_id)
        if (!isNaN(cid)) {
          whereClauses.push('e.created_by = ?')
          params.push(cid)
        }
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const countSql = `SELECT COUNT(*) as total FROM exams e ${whereSql}`
      const [countRows] = await pool.query(countSql, params)
      const total = countRows[0]?.total || 0

      const offset = (pageNum - 1) * limitNum
      const sortField = ['created_at', 'title'].includes(String(sort_by)) ? String(sort_by) : 'created_at'
      const sortOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
      const listSql = `
        SELECT
          e.id, e.title, e.category, e.category_id, ec.name as category_name, e.difficulty, e.duration, e.total_score, e.pass_score, e.question_count, e.status, e.created_at,
          u.id as creator_id, u.real_name as creator_name, u.username as creator_username
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN exam_categories ec ON e.category_id = ec.id
        ${whereSql}
        ORDER BY e.${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `
      const [rows] = await pool.query(listSql, [...params, limitNum, offset])

      return {
        success: true,
        data: {
          exams: rows.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category_name || r.category, // 优先使用关联的分类名称
            category_id: r.category_id,
            difficulty: r.difficulty,
            duration: parseFloat(r.duration),
            total_score: parseFloat(r.total_score),
            pass_score: parseFloat(r.pass_score),
            question_count: r.question_count,
            status: r.status,
            created_at: r.created_at,
            creator: r.creator_id ? { id: r.creator_id, name: r.creator_name, username: r.creator_username } : null
          })),
          page: pageNum,
          pageSize: limitNum,
          total
        }
      }
    } catch (error) {
      console.error('获取试卷列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 获取试卷创建人列表（下拉筛选用）
  // GET /api/exams/creators
  fastify.get('/api/exams/creators', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }
      try { jwt.verify(token, JWT_SECRET) } catch { return reply.code(401).send({ success: false, message: '无效的认证令牌' }) }

      const [rows] = await pool.query(
        `SELECT DISTINCT u.id, COALESCE(u.real_name, u.username) AS name, u.username
         FROM exams e
         INNER JOIN users u ON e.created_by = u.id
         ORDER BY name ASC`
      )
      return { success: true, data: rows }
    } catch (error) {
      console.error('获取创建人列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

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

      const { title, description, category, category_id, difficulty, duration, total_score, pass_score } = request.body

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
          category_id,
          difficulty,
          duration,
          total_score,
          pass_score,
          question_count,
          status,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          category || null, // 仍然保存文本以备不时之需，或者可以传 null
          category_id || null,
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
      const { title, description, category, category_id, difficulty, duration, total_score, pass_score } = request.body

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

      if (category_id !== undefined) {
        updateFields.push('category_id = ?')
        updateValues.push(category_id || null)
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

      // 更新题目列表 (JSON)
      const { questions } = request.body
      if (questions !== undefined) {
        let questionsJson = '[]'
        let questionCount = 0

        if (Array.isArray(questions)) {
          // 验证题目格式并重新计算 order_num
          const formattedQuestions = questions.map((q, index) => ({
            id: q.id || require('crypto').randomUUID(), // 如果没有ID则生成
            type: q.type,
            content: q.content,
            options: q.options,
            correct_answer: q.correct_answer,
            score: parseFloat(q.score) || 0,
            explanation: q.explanation || '',
            order_num: index + 1
          }))

          questionsJson = JSON.stringify(formattedQuestions)
          questionCount = formattedQuestions.length
        }

        updateFields.push('questions = ?')
        updateValues.push(questionsJson)

        // 同时更新题目数量
        updateFields.push('question_count = ?')
        updateValues.push(questionCount)
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
      return reply.code(500).send({
        success: false,
        message: '更新失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 获取试卷详情
  // GET /api/exams/:id
  // 返回试卷完整信息，包含题目列表 (从 JSON 字段读取)
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
          e.category_id,
          ec.name as category_name,
          e.difficulty,
          e.duration,
          e.total_score,
          e.pass_score,
          e.question_count,
          e.questions,
          e.status,
          e.created_at,
          e.updated_at,
          u.id as creator_id,
          u.username as creator_username,
          u.real_name as creator_name
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN exam_categories ec ON e.category_id = ec.id
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

      // 解析题目 JSON
      let questions = []
      try {
        questions = typeof exam.questions === 'string' ? JSON.parse(exam.questions) : (exam.questions || [])
      } catch (e) {
        console.error('解析题目 JSON 失败:', e)
        questions = []
      }

      // 计算题目统计
      const questionStatistics = {
        single_choice: { count: 0, total_score: 0 },
        multiple_choice: { count: 0, total_score: 0 },
        true_false: { count: 0, total_score: 0 },
        fill_blank: { count: 0, total_score: 0 },
        essay: { count: 0, total_score: 0 }
      }

      questions.forEach(q => {
        const type = q.type === 'short_answer' ? 'essay' : q.type
        if (questionStatistics[type]) {
          questionStatistics[type].count++
          questionStatistics[type].total_score += (parseFloat(q.score) || 0)
        }
      })

      // 构建返回数据
      const result = {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        category: exam.category_name || exam.category,
        category_id: exam.category_id,
        difficulty: exam.difficulty,
        duration: exam.duration,
        total_score: parseFloat(exam.total_score),
        pass_score: parseFloat(exam.pass_score),
        question_count: questions.length, // 使用实际题目数量
        status: exam.status,
        created_at: exam.created_at,
        updated_at: exam.updated_at,
        creator: exam.creator_id ? {
          id: exam.creator_id,
          username: exam.creator_username,
          name: exam.creator_name
        } : null,
        questions: questions, // 返回题目列表
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
  // ... (保持不变)
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
        `SELECT id, title, status, questions, total_score FROM exams WHERE id = ?`,
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

      // 解析题目计算总分
      let questions = []
      try {
        questions = typeof exam.questions === 'string' ? JSON.parse(exam.questions) : (exam.questions || [])
      } catch (e) {
        questions = []
      }

      const calculatedTotalScore = questions.reduce((sum, q) => sum + (parseFloat(q.score) || 0), 0)
      const questionCount = questions.length

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
        if (questionCount === 0) {
          return reply.code(400).send({
            success: false,
            message: '无法发布试卷：试卷必须至少包含一道题目',
            data: {
              question_count: questionCount
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
      return reply.code(500).send({
        success: false,
        message: '更新状态失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  fastify.post('/api/exams/:examId/import', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }

      let decoded
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' })
      }

      const { examId } = request.params

      // Check if exam exists and get current questions
      const [examRows] = await pool.query(
        'SELECT id, title, status, questions, total_score FROM exams WHERE id = ?',
        [examId]
      )

      if (examRows.length === 0) {
        return reply.code(404).send({ success: false, message: '试卷不存在' })
      }

      const exam = examRows[0]
      if (exam.status === 'published') {
        return reply.code(403).send({ success: false, message: '已发布的试卷不允许导入题目' })
      }

      // Get existing questions
      let existingQuestions = []
      try {
        existingQuestions = exam.questions ? JSON.parse(exam.questions) : []
      } catch (e) {
        console.error('解析现有题目失败:', e)
        existingQuestions = []
      }

      const data = await request.file()
      if (!data) {
        return reply.code(400).send({ success: false, message: '未接收到文件' })
      }

      const mimetype = data.mimetype || ''
      const filename = (data.filename || '').toLowerCase()

      let importedQuestions = []
      let successCount = 0
      let failedCount = 0
      const errors = []

      // Parse TXT file
      if (mimetype === 'text/plain' || filename.endsWith('.txt')) {
        const content = (await data.toBuffer()).toString('utf-8')
        const blocks = content.split(/\n-{3,}\n|\r?\n\s*---\s*\r?\n/).map(s => s.trim()).filter(Boolean)

        for (let i = 0; i < blocks.length; i++) {
          try {
            const lines = blocks[i].split(/\r?\n/)
            let type = 'single_choice'
            let qContent = ''
            const options = []
            let answer = ''
            let score = 10
            let explanation = ''

            for (const line of lines) {
              if (line.startsWith('#')) {
                type = line.replace('#', '').trim()
              } else if (/^[A-J]\.\s*/.test(line)) {
                options.push(line.replace(/^[A-J]\.\s*/, '').trim())
              } else if (/^答案\s*:/i.test(line)) {
                answer = line.split(':')[1].trim().toUpperCase()
              } else if (/^分值\s*:/i.test(line)) {
                const v = parseFloat(line.split(':')[1])
                if (!isNaN(v)) score = v
              } else if (/^解析\s*:/i.test(line)) {
                explanation = line.split(':')[1].trim()
              } else {
                qContent += (qContent ? '\n' : '') + line.trim()
              }
            }

            const normalizedType = type === 'short_answer' ? 'essay' : type
            let questionOptions = null

            if (['single_choice', 'multiple_choice'].includes(normalizedType)) {
              questionOptions = options
            } else if (normalizedType === 'true_false') {
              questionOptions = ['正确', '错误']
              if (!answer) answer = 'A'
            }

            const question = {
              id: `temp_${Date.now()}_${i}`,
              type: normalizedType,
              content: qContent,
              options: questionOptions,
              correct_answer: answer || null,
              score: score,
              explanation: explanation || '',
              order_num: existingQuestions.length + importedQuestions.length + 1
            }

            importedQuestions.push(question)
            successCount++
          } catch (e) {
            failedCount++
            errors.push({ index: i + 1, message: e.message })
          }
        }
      }
      // Parse Excel file
      else if (mimetype.includes('spreadsheet') || filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        const ExcelJS = require('exceljs')
        const buffer = await data.toBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)

        const worksheet = workbook.getWorksheet('试题模板') || workbook.worksheets[0]
        if (!worksheet) {
          return reply.code(400).send({ success: false, message: 'Excel文件格式错误' })
        }

        // Skip header row, start from row 2
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return // Skip header

          try {
            const typeText = row.getCell(1).value?.toString().trim()
            const content = row.getCell(2).value?.toString().trim()
            const optA = row.getCell(3).value?.toString().trim()
            const optB = row.getCell(4).value?.toString().trim()
            const optC = row.getCell(5).value?.toString().trim()
            const optD = row.getCell(6).value?.toString().trim()
            const answer = row.getCell(7).value?.toString().trim().toUpperCase()
            const score = parseFloat(row.getCell(8).value) || 10
            const explanation = row.getCell(9).value?.toString().trim() || ''

            if (!content) return // Skip empty rows

            // Map Chinese type to English
            const typeMap = {
              '单选题': 'single_choice',
              '多选题': 'multiple_choice',
              '判断题': 'true_false',
              '填空题': 'fill_blank',
              '简答题': 'essay'
            }

            const type = typeMap[typeText] || 'single_choice'
            let options = null

            if (type === 'single_choice' || type === 'multiple_choice') {
              options = [optA, optB, optC, optD].filter(opt => opt && opt.length > 0)
            } else if (type === 'true_false') {
              options = ['正确', '错误']
            }

            const question = {
              id: `temp_${Date.now()}_${rowNumber}`,
              type: type,
              content: content,
              options: options,
              correct_answer: answer || null,
              score: score,
              explanation: explanation,
              order_num: existingQuestions.length + importedQuestions.length + 1
            }

            importedQuestions.push(question)
            successCount++
          } catch (e) {
            failedCount++
            errors.push({ row: rowNumber, message: e.message })
          }
        })
      } else {
        return reply.code(400).send({
          success: false,
          message: '不支持的文件格式，请上传 .txt 或 .xlsx 文件'
        })
      }

      // Merge with existing questions (append mode)
      const allQuestions = [...existingQuestions, ...importedQuestions]

      // Update exam with new questions
      await pool.query(
        `UPDATE exams
         SET questions = ?,
             question_count = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(allQuestions), allQuestions.length, examId]
      )

      // Log import activity
      global.__exam_import_logs = global.__exam_import_logs || []
      global.__exam_import_logs.unshift({
        exam_id: parseInt(examId),
        time: new Date().toISOString(),
        success_count: successCount,
        failed_count: failedCount,
        user_id: decoded.id
      })
      if (global.__exam_import_logs.length > 50) global.__exam_import_logs.pop()

      return {
        success: true,
        message: '导入完成',
        data: {
          success_count: successCount,
          failed_count: failedCount,
          total_questions: allQuestions.length,
          errors
        }
      }
    } catch (error) {
      console.error('试题导入失败:', error)
      return reply.code(500).send({
        success: false,
        message: '导入失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })

  // 试题导入模板下载（Excel）
  // GET /api/exams/import/template.xlsx
  fastify.get('/api/exams/import/template.xlsx', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' })
      }
      try { jwt.verify(token, JWT_SECRET) } catch { return reply.code(401).send({ success: false, message: '无效的认证令牌' }) }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('试题模板')
      sheet.columns = [
        { header: '题型', key: 'type', width: 16 },
        { header: '题干', key: 'content', width: 60 },
        { header: '选项A', key: 'optA', width: 20 },
        { header: '选项B', key: 'optB', width: 20 },
        { header: '选项C', key: 'optC', width: 20 },
        { header: '选项D', key: 'optD', width: 20 },
        { header: '正确答案', key: 'answer', width: 14 },
        { header: '分值', key: 'score', width: 10 },
        { header: '答案解析', key: 'explanation', width: 40 }
      ]

      const typeList = '单选题,多选题,判断题,填空题,简答题'
      for (let row = 2; row <= 1000; row++) {
        sheet.getCell(`A${row}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${typeList}"`]
        }
      }

      sheet.addRow({ type: '单选题', content: '下列哪项是HTTP方法？', optA: 'GET', optB: 'FETCH', optC: 'RECEIVE', optD: 'OBTAIN', answer: 'A', score: 10, explanation: 'GET/POST/PUT/DELETE 等' })
      sheet.addRow({ type: '多选题', content: '以下哪些是数组方法？', optA: 'map', optB: 'filter', optC: 'reduce', optD: 'assign', answer: 'ABC', score: 10, explanation: 'map/filter/reduce 属于数组方法' })
      sheet.addRow({ type: '判断题', content: 'HTTP 是无状态协议。', optA: '正确', optB: '错误', answer: 'A', score: 5, explanation: '' })
      sheet.addRow({ type: '填空题', content: '请填写命令：_____ install', score: 10, explanation: '' })
      sheet.addRow({ type: '简答题', content: '简述事件循环原理。', score: 20, explanation: '' })

      const guide = workbook.addWorksheet('使用说明')
      guide.getCell('A1').value = '试题导入模板使用说明'
      guide.getCell('A2').value = '1. 题型请使用下拉框选择：单选题/多选题/判断题/填空题/简答题'
      guide.getCell('A3').value = '2. 单选/多选题需填写选项A-D；判断题选项固定为“正确/错误”'
      guide.getCell('A4').value = '3. 正确答案：单选/判断题用 A/B；多选题用如 ABC；填空/简答无需填写'
      guide.getCell('A5').value = '4. 分值为正整数；建议每题 5~20 分'
      guide.getCell('A6').value = '5. 保存为 .xlsx 格式后，在试题管理页面的“试题导入”中上传'
      const host = request.hostname.split(':')[0]
      const frontendUrl = `http://${host}:5173/#/knowledge-base`
      guide.getCell('A8').value = { text: '查看详细使用文档', hyperlink: frontendUrl, tooltip: '打开知识库' }

      const buffer = await workbook.xlsx.writeBuffer()
      const now = new Date()
      const yyyy = String(now.getFullYear())
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const filename = `试题导入模板_${yyyy}${mm}${dd}.xlsx`

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      return reply.send(buffer)
    } catch (error) {
      console.error('生成模板失败:', error)
      return reply.code(500).send({ success: false, message: '生成模板失败' })
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
      const normalizedType = type === 'short_answer' ? 'essay' : type

      // 必填字段验证
      if (!normalizedType || !content || score === undefined || score === null ||
          ((normalizedType === 'single_choice' || normalizedType === 'multiple_choice' || normalizedType === 'true_false') && !correct_answer)) {
        return reply.code(400).send({
          success: false,
          message: '缺少必填字段：type, content, score；客观题需提供 correct_answer'
        })
      }

      // 验证题型
      const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'essay']
      if (!validTypes.includes(normalizedType)) {
        return reply.code(400).send({
          success: false,
          message: '无效的题型，必须是 single_choice, multiple_choice, true_false, fill_blank 或 essay'
        })
      }

      // 验证分值
      const numericScore = Number(score)
      if (!Number.isFinite(numericScore) || numericScore <= 0) {
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
      if (normalizedType === 'single_choice' || normalizedType === 'multiple_choice') {
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
      } else if (normalizedType === 'true_false') {
        // 判断题自动设置选项
        optionsJson = JSON.stringify(['正确', '错误'])
      }

      // 验证正确答案格式
      if (normalizedType === 'single_choice') {
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
      } else if (normalizedType === 'multiple_choice') {
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
      } else if (normalizedType === 'true_false') {
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
            normalizedType,
            content,
            optionsJson,
            correct_answer,
            numericScore,
            explanation || null,
            nextOrderNum
          ]
        )

        await connection.query(
          `UPDATE exams
          SET question_count = question_count + 1,
              updated_at = NOW()
          WHERE id = ?`,
          [examId]
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
        const normalizedType = type === 'short_answer' ? 'essay' : type
        if (!validTypes.includes(normalizedType)) {
          return reply.code(400).send({
            success: false,
            message: '无效的题型，必须是 single_choice, multiple_choice, true_false, fill_blank 或 essay'
          })
        }
        updateFields.push('type = ?')
        updateValues.push(normalizedType)
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
        const currentType = (type !== undefined) ? (type === 'short_answer' ? 'essay' : type) : undefined
        const effectiveType = currentType || (await (async () => {
          const [rows] = await pool.query('SELECT type FROM questions WHERE id = ?', [id])
          return rows.length ? rows[0].type : null
        })())
        const isObjective = ['single_choice', 'multiple_choice', 'true_false'].includes(effectiveType)
        if (!isObjective && (!correct_answer || correct_answer.trim() === '')) {
          updateFields.push('correct_answer = ?')
          updateValues.push(null)
        } else {
          if (!correct_answer || correct_answer.trim() === '') {
            return reply.code(400).send({
              success: false,
              message: '正确答案不能为空'
            })
          }
          updateFields.push('correct_answer = ?')
          updateValues.push(correct_answer)
        }
      }

      if (score !== undefined) {
        const s = Number(score)
        if (!Number.isFinite(s) || s <= 0) {
          return reply.code(400).send({
            success: false,
            message: '分值必须是大于0的数字'
          })
        }
        newScore = s
        updateFields.push('score = ?')
        updateValues.push(s)
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

        await connection.query(
          `UPDATE exams
          SET question_count = question_count - 1,
              updated_at = NOW()
          WHERE id = ?`,
          [examId]
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

  // 获取考核计划列表（分页）
  // GET /api/assessment-plans
  // 支持分页（默认第1页，每页20条）
  // 支持状态筛选：draft, published, ongoing, completed, cancelled
  // 支持时间范围筛选（start_time, end_time）
  // 返回计划基本信息和参与统计
  // 包含试卷标题
  /*
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
        limit = 20,
        status,
        start_time_from,
        start_time_to,
        end_time_from,
        end_time_to,
        department_id,
        keyword
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
          e.pass_score as exam_pass_score,
          u.real_name as creator_name,
          u.username as creator_username,
          u.department_id as creator_department_id,
          d.name as creator_department_name
        FROM assessment_plans ap
        INNER JOIN exams e ON ap.exam_id = e.id
        INNER JOIN users u ON ap.created_by = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1 AND e.status = 'published'
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

      // 部门筛选（按创建人部门，前端默认传当前用户部门）
      if (department_id) {
        const deptId = parseInt(department_id)
        if (!isNaN(deptId)) {
          query += ' AND u.department_id = ?'
          params.push(deptId)
        }
      }

      // 人员关键词筛选（姓名/用户名模糊）
      if (keyword && keyword.trim()) {
        const kw = `%${keyword.trim()}%`
        query += ' AND (COALESCE(u.real_name, "") LIKE ? OR COALESCE(u.username, "") LIKE ? )'
        params.push(kw, kw)
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
          target_users_count: totalUsers,
          start_time: plan.start_time,
          end_time: plan.end_time,
          max_attempts: plan.max_attempts,
          status: plan.status,
          created_by: plan.created_by,
          creator_name: plan.creator_name,
          creator_username: plan.creator_username,
          creator_department_id: plan.creator_department_id,
          creator_department_name: plan.creator_department_name,
          created_at: plan.created_at,
          updated_at: plan.updated_at,
          statistics: {
            total_users: totalUsers,
            completed_count: completedCount,
            passed_count: passedCount,
            pass_rate: parseFloat(passRate)
          }
        }
      }))

      return {
        success: true,
        data: plansWithStats,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    } catch (error) {
      console.error('获取考核计划列表失败:', error)
      return reply.code(500).send({
        success: false,
        message: '获取失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })
  */

}
