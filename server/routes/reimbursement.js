const { getNotificationTargets } = require('../utils/notificationHelper')
const { sendNotificationToUser } = require('../websocket')

module.exports = async function (fastify, opts) {
  const { pool } = fastify

  // 创建报销申请
  fastify.post('/api/reimbursement', async (request, reply) => {
    const { type_id, title, amount, reason, items, attachments } = request.body
    const user_id = request.user.id

    try {
      const [result] = await pool.query(
        'INSERT INTO reimbursements (user_id, type_id, title, total_amount, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, type_id, title, amount, reason, 'pending']
      )

      const reimbursementId = result.insertId

      // 插入报销明细
      if (items && items.length > 0) {
        const itemValues = items.map(item => [reimbursementId, item.date, item.amount, item.description, item.category])
        await pool.query(
          'INSERT INTO reimbursement_items (reimbursement_id, date, amount, description, category) VALUES ?',
          [itemValues]
        )
      }

      // 插入附件
      if (attachments && attachments.length > 0) {
        const attachmentValues = attachments.map(url => [reimbursementId, url])
        await pool.query(
          'INSERT INTO reimbursement_attachments (reimbursement_id, file_url) VALUES ?',
          [attachmentValues]
        )
      }

      // 启动工作流
      const { workflowEngine } = require('../utils/workflowEngine')
      const workflowResult = await workflowEngine.startWorkflow(pool, 'reimbursement', reimbursementId, user_id)

      // --- 通知逻辑：接入配置中心 ---
      try {
        const [applicant] = await pool.query('SELECT department_id FROM users WHERE id = ?', [user_id]);
        const targetUserIds = await getNotificationTargets(pool, 'reimbursement_progress', {
          applicantId: user_id,
          departmentId: applicant[0]?.department_id,
          nextApproverId: workflowResult.approvers // 下一节点审批人
        });

        if (targetUserIds.length > 0) {
          const notifyTitle = '新报销待处理';
          const notifyContent = `您有一个来自 ${request.user.real_name} 的报销申请待处理: ${title}`;
          for (const uid of targetUserIds) {
            await pool.query(
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
      return reply.code(500).send({ success: false, message: '申请提交失败' })
    }
  })

  // 获取报销申请详情
  fastify.get('/api/reimbursement/:id', async (request, reply) => {
    try {
      const [reimbursement] = await pool.query(`
        SELECT r.*, rt.name as type_name, u.real_name as applicant_name
        FROM reimbursements r
        LEFT JOIN reimbursement_types rt ON r.type_id = rt.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [request.params.id])

      if (reimbursement.length === 0) return reply.code(404).send({ message: '未找到该报销申请' })

      const [items] = await pool.query('SELECT * FROM reimbursement_items WHERE reimbursement_id = ?', [request.params.id])
      const [attachments] = await pool.query('SELECT * FROM reimbursement_attachments WHERE reimbursement_id = ?', [request.params.id])
      
      // 获取工作流详情
      const { workflowEngine } = require('../utils/workflowEngine')
      const workflowInfo = await workflowEngine.getWorkflowStatus(pool, 'reimbursement', request.params.id)

      return {
        ...reimbursement[0],
        items,
        attachments,
        workflow: workflowInfo
      }
    } catch (error) {
      console.error('获取报销详情失败:', error)
      return reply.code(500).send({ success: false, message: '获取详情失败' })
    }
  })

  // 审批报销申请
  fastify.post('/api/reimbursement/:id/approve', async (request, reply) => {
    const { action, opinion } = request.body
    const user_id = request.user.id

    try {
      const { workflowEngine } = require('../utils/workflowEngine')
      const result = await workflowEngine.handleApproval(pool, 'reimbursement', request.params.id, user_id, action, opinion)

      // --- 通知逻辑：深度接入配置中心 ---
      try {
        const [reimbInfo] = await pool.query('SELECT user_id, title FROM reimbursements WHERE id = ?', [request.params.id]);
        if (reimbInfo.length > 0) {
          const applicantId = reimbInfo[0].user_id;
          const title = reimbInfo[0].title;
          const [applicant] = await pool.query('SELECT department_id FROM users WHERE id = ?', [applicantId]);

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

          // 核心加固：物理调用引擎分发
          const targetUserIds = await getNotificationTargets(pool, eventType, {
            applicantId,
            departmentId: applicant[0]?.department_id,
            nextApproverId: result.approvers // 物理透传下一环节审批人
          });

          for (const uid of targetUserIds) {
            await pool.query(
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
  })
}
