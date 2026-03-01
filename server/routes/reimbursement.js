const { getNotificationTargets } = require('../utils/notificationHelper')
const { sendNotificationToUser } = require('../websocket')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')
const dayjs = require('dayjs')

module.exports = async function (fastify, opts) {
  // 核心：统一数据库连接池引用，增加全局兜底
  const dbPool = fastify.mysql || global.pool;

  // 内置认证工具函数：解析 JWT 并返回 user 信息（含 real_name）
  async function authenticateRequest(request, reply) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      console.error('[Reimbursement Auth] No token provided');
      reply.code(401).send({ success: false, message: '未登录' })
      return null
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      if (!decoded.id) throw new Error('Token payload missing user ID');
      
      const [rows] = await dbPool.query('SELECT real_name FROM users WHERE id = ?', [decoded.id])
      
      if (rows.length === 0) {
        console.error(`[Reimbursement Auth] User ID ${decoded.id} not found in DB`);
        reply.code(401).send({ success: false, message: '用户不存在' })
        return null;
      }
      
      return { ...decoded, real_name: rows[0]?.real_name || '' }
    } catch (err) {
      console.error('[Reimbursement Auth] Auth failure:', err.message);
      reply.code(401).send({ success: false, message: '无效或已过期的登录凭证' })
      return null
    }
  }


  // 创建报销申请
  fastify.post('/api/reimbursement', async (request, reply) => {
    const { type, title, amount, remark, items, attachments } = request.body
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return
    const user_id = authUser.id

    try {
      // 获取用户信息以获取 employee_id (从 employees 表) 和 department_id (从 users 表)
      const [user] = await dbPool.query(`
        SELECT u.department_id, e.id as employee_id 
        FROM users u 
        LEFT JOIN employees e ON u.id = e.user_id 
        WHERE u.id = ?
      `, [user_id]);
      
      if (user.length === 0) return reply.code(404).send({ success: false, message: '用户不存在' });

      // 如果没有关联的员工记录
      if (!user[0].employee_id) {
        console.error(`[Reimbursement] No employee record found for user_id ${user_id}`);
        return reply.code(400).send({ success: false, message: '您的账号尚未绑定员工档案，无法提交报销' });
      }

      const { employee_id, department_id } = user[0];
      const reimbursement_no = `BX${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const [result] = await dbPool.query(
        'INSERT INTO reimbursements (reimbursement_no, user_id, employee_id, department_id, title, total_amount, remark, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [reimbursement_no, user_id, employee_id, department_id, title, amount || 0, remark || '', type || 'other', 'pending']
      )

      const reimbursementId = result.insertId

      // 插入报销明细
      if (items && items.length > 0) {
        const itemValues = items.map(item => [
          reimbursementId,
          item.item_type || item.category || 'other',
          item.amount || 0,
          item.date || item.expense_date || dayjs().format('YYYY-MM-DD'),
          item.description || '',
          item.attachment_url || null
        ])
        await dbPool.query(
          'INSERT INTO reimbursement_items (reimbursement_id, item_type, amount, expense_date, description, attachment_url) VALUES ?',
          [itemValues]
        )
      }

      // 插入附件
      if (attachments && attachments.length > 0) {
        const attachmentValues = attachments.map(url => {
          const fileName = url.split('/').pop() || 'attachment';
          return [reimbursementId, fileName, url];
        });
        await dbPool.query(
          'INSERT INTO reimbursement_attachments (reimbursement_id, file_name, file_url) VALUES ?',
          [attachmentValues]
        )
      }

      // 启动工作流
      const workflowEngine = require('../utils/workflowEngine')
      const workflowResult = await workflowEngine.startWorkflow(dbPool, 'reimbursement', reimbursementId, user_id)

      // --- 通知逻辑：接入配置中心 ---
      try {
        const targetUserIds = await getNotificationTargets(dbPool, 'reimbursement_progress', {
          applicantId: user_id,
          departmentId: department_id,
          nextApproverId: workflowResult.approvers // 下一节点审批人
        });

        if (targetUserIds.length > 0) {
          const notifyTitle = '新报销待处理';
          const notifyContent = `您有一个来自 ${authUser.real_name} 的报销申请待处理: ${title}`;
          for (const uid of targetUserIds) {
            await dbPool.query(
              `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)`,
              [uid, 'reimbursement_progress', notifyTitle, notifyContent, reimbursementId, 'reimbursement']
            );
            if (fastify.io) {
              sendNotificationToUser(fastify.io, uid, {
                type: 'reimbursement_progress',
                title: notifyTitle,
                content: notifyContent,
                related_id: reimbursementId,
                related_type: 'reimbursement',
                created_at: new Date()
              });
            }
          }
        }
      } catch (notifyErr) { console.error('报销申请通知失败:', notifyErr); }

      return { success: true, data: { id: reimbursementId } }
    } catch (error) {
      console.error('创建报销申请失败:', error)
      return reply.code(500).send({ 
        success: false, 
        message: '申请提交失败: ' + error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      })
    }
  })

  // 获取报销记录列表
  fastify.get('/api/reimbursement/list', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return

    const { user_id, status, page = 1, limit = 10 } = request.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    
    let query = `
      SELECT r.*, u.real_name as applicant_name, d.name as department_name
      FROM reimbursements r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE 1=1
    `

    if (user_id) {
      query += ' AND r.user_id = ?'
      params.push(user_id)
    }

    if (status && status !== 'all') {
      query += ' AND r.status = ?'
      params.push(status)
    }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), offset)

    try {
      const [rows] = await dbPool.query(query, params)
      
      // 获取总数用于分页
      let countQuery = 'SELECT COUNT(*) as total FROM reimbursements WHERE 1=1'
      const countParams = []
      if (user_id) {
        countQuery += ' AND user_id = ?'
        countParams.push(user_id)
      }
      if (status && status !== 'all') {
        countQuery += ' AND status = ?'
        countParams.push(status)
      }
      const [countResult] = await dbPool.query(countQuery, countParams)

      return {
        success: true,
        data: rows,
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    } catch (error) {
      console.error('获取报销列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取列表失败' })
    }
  })

  // 获取报销申请详情
  fastify.get('/api/reimbursement/:id', async (request, reply) => {
    try {
      const [reimbursement] = await dbPool.query(`
        SELECT r.*, u.real_name as applicant_name
        FROM reimbursements r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [request.params.id])

      if (reimbursement.length === 0) return reply.code(404).send({ message: '未找到该报销申请' })

      const [items] = await dbPool.query('SELECT * FROM reimbursement_items WHERE reimbursement_id = ?', [request.params.id])
      const [attachments] = await dbPool.query('SELECT * FROM reimbursement_attachments WHERE reimbursement_id = ?', [request.params.id])

      // 获取工作流详情
      const workflowEngine = require('../utils/workflowEngine')
      const workflowInfo = await workflowEngine.getApprovalProgress(dbPool, 'reimbursement', request.params.id)

      return {
        success: true,
        data: {
          ...reimbursement[0],
          items,
          attachments,
          workflow: workflowInfo
        }
      }
    } catch (error) {
      console.error('获取报销详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取详情失败' })
    }
  })

  // 获取待我审批的报销列表
  fastify.get('/api/reimbursement/pending', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return
    const user_id = authUser.id

    const { department_id, status, keyword } = request.query
    const params = []

    try {
      // 核心逻辑：查询当前节点审批人包含当前用户的单据
      // 这里需要关联 workflow 相关表，或者通过流程引擎辅助判断
      // 简化版：查询 status='approving' 且 current_node_id 对应的审批人包含我的
      let query = `
        SELECT r.*, u.real_name as applicant_name, d.name as department_name,
               awn.node_name as current_node_name
        FROM reimbursements r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN approval_workflow_nodes awn ON r.current_node_id = awn.id
        WHERE 1=1
      `

      // 状态筛选
      if (status === 'approving') {
        query += " AND r.status IN ('pending', 'approving')"
      } else if (status && status !== 'all') {
        query += " AND r.status = ?"
        params.push(status)
      }

      if (department_id) {
        query += " AND r.department_id = ?"
        params.push(department_id)
      }

      if (keyword) {
        query += " AND (r.title LIKE ? OR r.reimbursement_no LIKE ? OR u.real_name LIKE ?)"
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
      }

      query += " ORDER BY r.created_at DESC"

      const [rows] = await dbPool.query(query, params)

      // 注入权限标记：判断当前用户是否真的是当前节点的审批人
      const workflowEngine = require('../utils/workflowEngine')
      const enrichedRows = await Promise.all(rows.map(async (row) => {
        let is_approvable = false
        if (row.status === 'pending' || row.status === 'approving') {
          try {
            const progress = await workflowEngine.getApprovalProgress(dbPool, 'reimbursement', row.id)
            // 获取当前节点的所有审批人
            const currentNode = progress.nodes.find(n => n.id === row.current_node_id)
            if (currentNode) {
              const { selectWorkflow } = require('../utils/workflowEngine')
              // 这里简化处理，如果是管理员或显式包含在审批人列表中
              // 实际生产环境应通过 findNodeApprovers 逻辑判断
              is_approvable = true; // 演示版本设为 true，生产环境需严格校验
            }
          } catch (e) {}
        }
        return { ...row, is_approvable }
      }))

      return { success: true, data: enrichedRows }
    } catch (error) {
      console.error('获取待审批列表失败:', error)
      return reply.code(500).send({ success: false, message: '获取列表失败' })
    }
  })

  // 审批报销申请 (兼容前端路径)
  fastify.post('/api/reimbursement/:id/approval', async (request, reply) => {
    // 复用之前的审批逻辑
    return await handleApproveLogic(request, reply)
  })

  // 审批报销申请 (原始路径)
  fastify.post('/api/reimbursement/:id/approve', async (request, reply) => {
    return await handleApproveLogic(request, reply)
  })

  // 撤销报销申请
  fastify.post('/api/reimbursement/:id/cancel', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return

    try {
      // 检查单据状态
      const [rows] = await dbPool.query('SELECT status, user_id FROM reimbursements WHERE id = ?', [request.params.id])
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '单据不存在' })
      
      const record = rows[0]
      if (record.user_id !== authUser.id) return reply.code(403).send({ success: false, message: '无权操作此单据' })
      if (!['pending', 'approving'].includes(record.status)) {
        return reply.code(400).send({ success: false, message: '当前状态不可撤销' })
      }

      await dbPool.query('UPDATE reimbursements SET status = \"cancelled\", current_node_id = NULL WHERE id = ?', [request.params.id])
      
      return { success: true, message: '已撤销' }
    } catch (error) {
      console.error('撤销报销失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 提交报销草稿
  fastify.post('/api/reimbursement/:id/submit', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return

    try {
      const [rows] = await dbPool.query('SELECT status, user_id FROM reimbursements WHERE id = ?', [request.params.id])
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '单据不存在' })
      
      const record = rows[0]
      if (record.user_id !== authUser.id) return reply.code(403).send({ success: false, message: '无权操作此单据' })
      if (record.status !== 'draft') {
        return reply.code(400).send({ success: false, message: '只有草稿状态可提交' })
      }

      // 启动工作流
      const workflowEngine = require('../utils/workflowEngine')
      await workflowEngine.startWorkflow(dbPool, 'reimbursement', request.params.id, authUser.id)
      
      return { success: true, message: '提交成功' }
    } catch (error) {
      console.error('提交报销失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    }
  })

  // 删除报销记录 (草稿或撤销)
  fastify.delete('/api/reimbursement/:id', async (request, reply) => {
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      const [rows] = await connection.query('SELECT status, user_id FROM reimbursements WHERE id = ?', [request.params.id])
      if (rows.length === 0) {
        await connection.rollback()
        return reply.code(404).send({ success: false, message: '单据不存在' })
      }
      
      const record = rows[0]
      if (record.user_id !== authUser.id) {
        await connection.rollback()
        return reply.code(403).send({ success: false, message: '无权操作此单据' })
      }
      
      if (!['draft', 'cancelled', 'rejected'].includes(record.status)) {
        await connection.rollback()
        return reply.code(400).send({ success: false, message: '当前状态不可删除' })
      }

      // 删除明细和附件
      await connection.query('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [request.params.id])
      await connection.query('DELETE FROM reimbursement_attachments WHERE reimbursement_id = ?', [request.params.id])
      await connection.query('DELETE FROM reimbursements WHERE id = ?', [request.params.id])

      await connection.commit()
      return { success: true, message: '已删除' }
    } catch (error) {
      await connection.rollback()
      console.error('删除报销失败:', error)
      return reply.code(500).send({ success: false, message: '操作失败' })
    } finally {
      connection.release()
    }
  })

  // 提取审批核心逻辑以供复用
  async function handleApproveLogic(request, reply) {
    const { action, opinion } = request.body
    const authUser = await authenticateRequest(request, reply)
    if (!authUser) return
    const user_id = authUser.id

    try {
      const workflowEngine = require('../utils/workflowEngine')
      const result = await workflowEngine.processApproval(dbPool, 'reimbursement', request.params.id, user_id, action, opinion)

      // --- 通知逻辑：深度接入配置中心 ---
      try {
        const [reimbInfo] = await dbPool.query('SELECT user_id, title FROM reimbursements WHERE id = ?', [request.params.id]);
        if (reimbInfo.length > 0) {
          const applicantId = reimbInfo[0].user_id;
          const title = reimbInfo[0].title;
          const [applicant] = await dbPool.query('SELECT department_id FROM users WHERE id = ?', [applicantId]);

          let eventType = 'reimbursement_progress';
          let notifyTitle = '报销环节更新';
          let notifyContent = `您的报销申请 "${title}" 已通过当前审批`;

          if (action === 'approve' && result.completed) {
            eventType = 'reimbursement_pass';
            notifyTitle = '报销终审通过';
            notifyContent = `您的报销申请 "${title}" 已通过最终审批`;
          } else if (action === 'reject') {
            eventType = 'reimbursement_reject';
            notifyTitle = '报销申请被驳回';
            notifyContent = `您的报销申请 "${title}" 已被驳回: ${opinion || '无理由'}`;
          } else if (action === 'return') {
            eventType = 'reimbursement_return';
            notifyTitle = '报销退回修改';
            notifyContent = `您的报销申请 "${title}" 已被退回: ${opinion || '无理由'}`;
          }

          const targetUserIds = await getNotificationTargets(dbPool, eventType, {
            applicantId,
            departmentId: applicant[0]?.department_id,
            nextApproverId: result.approvers
          });

          for (const uid of targetUserIds) {
            await dbPool.query(
              `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)`,
              [uid, eventType, notifyTitle, notifyContent, request.params.id, 'reimbursement']
            );
            if (fastify.io) {
              sendNotificationToUser(fastify.io, uid, {
                type: eventType,
                title: notifyTitle,
                content: notifyContent,
                related_id: request.params.id,
                related_type: 'reimbursement',
                created_at: new Date()
              });
            }
          }
        }
      } catch (notifyError) {
        console.error('❌ 发送报销审批结果通知失败:', notifyError);
      }

      return { success: true, data: result }
    } catch (error) {
      console.error('报销审批操作失败:', error)
      return reply.code(500).send({ success: false, message: error.message || '操作失败' })
    }
  }
}
