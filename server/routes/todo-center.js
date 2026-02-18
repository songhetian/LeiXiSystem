/**
 * 待办中心 API 路由
 * 聚合所有类型的待处理任务
 */

module.exports = async function (fastify, opts) {

  fastify.get('/api/todo/list', async (request, reply) => {
    // 延迟获取 pool 以确保数据库已初始化
    const pool = fastify.mysql || global.pool;
    const { user_id } = request.query
    
    try {
      if (!pool) {
        console.error('❌ [Todo Center] Database pool not initialized');
        return reply.code(500).send({ success: false, error: 'Database not initialized' });
      }

      const { extractUserPermissions } = require('../middleware/checkPermission')
      const permissions = await extractUserPermissions(request, pool)
      if (!permissions) return reply.code(401).send({ success: false })

      const roleIds = (permissions.roles || []).map(r => r.id)
      const [approverConfig] = await pool.query(
        'SELECT custom_type_name FROM approvers WHERE user_id = ? AND is_active = 1', [user_id]
      )
      const customTypeNames = (approverConfig || []).map(a => a.custom_type_name)

      // --- 1. 获取报销申请 (基于灵活流程引擎) ---
      const myReimbursementCondition = `
        r.status = 'approving'
        AND EXISTS (
          SELECT 1 FROM approval_workflow_nodes n
          WHERE n.id = r.current_node_id
          AND (
            (n.approver_type = 'user' AND n.approver_id = ${user_id}) OR
            (n.approver_type = 'role' AND n.role_id IN (${roleIds.length > 0 ? roleIds.join(',') : '0'})) OR
            (n.approver_type = 'custom_group' AND n.custom_type_name IN (${customTypeNames.length > 0 ? customTypeNames.map(n => `'${n}'`).join(',') : "''"})) OR
            (n.approver_type = 'initiator' AND r.user_id = ${user_id}) OR
            (n.approver_type = 'department_manager' AND r.department_id = (SELECT department_id FROM users WHERE id = ${user_id} AND is_department_manager = 1))
          )
        )
      `
      const [reimbursements] = await pool.query(`
        SELECT r.id, r.reimbursement_no as no, r.title as summary, r.total_amount as extra_info, 
               r.created_at, 'reimbursement' as task_type, u.real_name as applicant,
               '报销申请' as type_label, 'blue' as color, 'reimbursement-approval' as tab
        FROM reimbursements r
        JOIN users u ON r.user_id = u.id
        WHERE ${myReimbursementCondition}
      `)

      // --- 2. 获取考勤类申请 (简单审批模式：通常由部门主管审批) ---
      // 这里检查用户是否是主管，如果是，查询其部门下状态为 pending 的单子
      let attendanceTasks = []
      if (permissions.canViewAllDepartments || permissions.roles.some(r => r.name.includes('主管') || r.name.includes('经理'))) {
        // 请假
        const [leaves] = await pool.query(`
          SELECT l.id, 'LEAVE' as no, CONCAT(l.leave_type, ' ', l.duration, '天') as summary, 
                 l.reason as extra_info, l.created_at, 'leave' as task_type, u.real_name as applicant,
                 '请假审批' as type_label, 'orange' as color, 'attendance-approval' as tab
          FROM leave_records l
          JOIN users u ON l.user_id = u.id
          WHERE l.status = 'pending' AND u.department_id = ?
        `, [permissions.departmentId])
        
        // 加班
        const [overtimes] = await pool.query(`
          SELECT o.id, 'OVERTIME' as no, CONCAT(o.overtime_type, ' ', o.duration, '小时') as summary, 
                 o.reason as extra_info, o.created_at, 'overtime' as task_type, u.real_name as applicant,
                 '加班审批' as type_label, 'purple' as color, 'attendance-approval' as tab
          FROM overtime_records o
          JOIN users u ON o.user_id = u.id
          WHERE o.status = 'pending' AND u.department_id = ?
        `, [permissions.departmentId])

        attendanceTasks = [...leaves, ...overtimes]
      }

      // --- 3. 获取待审核用户 (仅限管理员) ---
      let adminTasks = []
      if (permissions.canViewAllDepartments) {
        const [pendingUsers] = await pool.query(`
          SELECT u.id, 'USER_AUDIT' as no, u.username as summary, u.email as extra_info,
                 u.created_at, 'user_audit' as task_type, u.real_name as applicant,
                 '注册审核' as type_label, 'green' as color, 'user-approval' as tab
          FROM users u
          WHERE u.status = 'pending'
        `)
        adminTasks = pendingUsers
      }

      // 聚合所有任务并按时间倒序
      const allTasks = [...reimbursements, ...attendanceTasks, ...adminTasks].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )

      return { success: true, data: allTasks }
    } catch (error) {
      console.error('获取待办列表失败:', error)
      return reply.code(500).send({ success: false })
    }
  })
}