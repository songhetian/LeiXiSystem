/**
 * 审批流程引擎 - 核心模块
 * 
 * 支持多业务类型：
 * - reimbursement: 报销申请
 * - asset_request: 资产申请 (升级/维修)
 */

/**
 * 根据申请信息选择合适的审批流程
 * @param {Object} pool - 数据库连接池
 * @param {string} type - 业务类型 (reimbursement, asset_request)
 * @param {Object} data - 申请单信息 (含 user_id, department_id, total_amount 等)
 * @returns {Object} 匹配的审批流程
 */
async function selectWorkflow(pool, type, data) {
  try {
    // 1. 获取提交人的角色列表 (按角色等级降序排列)
    const [userRoles] = await pool.query(
      `SELECT ur.role_id, r.name as role_name, r.level
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?
       ORDER BY r.level DESC`,
      [data.user_id]
    )
    const userRoleIds = userRoles.map(r => r.role_id)

    // 1.5 优先检查 role_workflows 表中是否有针对该角色的明确指定流程 (仅限报销，资产暂不开启角色绑定)
    if (type === 'reimbursement' && userRoleIds.length > 0) {
      const [roleAssignedWorkflows] = await pool.query(
        `SELECT rw.workflow_id, aw.* 
         FROM role_workflows rw
         JOIN approval_workflows aw ON rw.workflow_id = aw.id
         WHERE rw.role_id IN (?) AND aw.status = 'active'
         ORDER BY (SELECT level FROM roles WHERE id = rw.role_id) DESC
         LIMIT 1`,
        [userRoleIds]
      )

      if (roleAssignedWorkflows.length > 0) {
        return roleAssignedWorkflows[0]
      }
    }

    // 2. 获取用户状态
    const [userInfo] = await pool.query(
      'SELECT is_department_manager FROM users WHERE id = ?',
      [data.user_id]
    )
    const isDepartmentManager = userInfo[0]?.is_department_manager === 1

    // 3. 查找满足条件的非默认流程
    const [workflows] = await pool.query(
      `SELECT * FROM approval_workflows
       WHERE type = ? AND status = 'active' AND is_default = 0
       ORDER BY id ASC`,
      [type]
    )

    for (const workflow of workflows) {
      if (!workflow.conditions) continue;
      
      const conditions = typeof workflow.conditions === 'string'
        ? JSON.parse(workflow.conditions)
        : workflow.conditions

      // 角色匹配 (通用)
      if (conditions.role_ids?.length > 0) {
        if (conditions.role_ids.some(roleId => userRoleIds.includes(roleId))) return workflow;
        continue;
      }

      // 部门主管匹配
      if (conditions.is_department_manager !== undefined) {
        if (conditions.is_department_manager === isDepartmentManager) return workflow;
        continue;
      }

      // 金额匹配 (主要用于报销)
      if (conditions.amount_greater_than && data.total_amount &&
          parseFloat(data.total_amount) > conditions.amount_greater_than) {
        return workflow;
      }

      // 部门匹配
      if (conditions.department_ids?.includes(data.department_id)) {
        return workflow;
      }
    }

    // 4. 使用默认流程
    const [defaultWorkflow] = await pool.query(
      `SELECT * FROM approval_workflows
       WHERE type = ? AND status = 'active' AND is_default = 1
       LIMIT 1`,
      [type]
    )

    if (defaultWorkflow.length > 0) return defaultWorkflow[0];

    throw new Error(`未找到可用的 ${type} 审批流程`);
  } catch (error) {
    console.error('选择审批流程失败:', error);
    throw error
  }
}

/**
 * 获取流程的所有节点
 */
async function getWorkflowNodes(pool, workflowId) {
  const [nodes] = await pool.query(
    `SELECT * FROM approval_workflow_nodes
     WHERE workflow_id = ?
     ORDER BY node_order ASC`,
    [workflowId]
  )
  return nodes
}

/**
 * 根据节点配置查找具体的审批人
 */
async function findNodeApprovers(pool, node, data) {
  const approverIds = []

  switch (node.approver_type) {
    case 'user':
      if (node.approver_id) approverIds.push(node.approver_id);
      break;

    case 'role':
      if (node.role_id) {
        const [users] = await pool.query(
          `SELECT u.id FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           WHERE ur.role_id = ? AND u.status = 'active'`,
          [node.role_id]
        )
        approverIds.push(...users.map(u => u.id))
      }
      break

    case 'custom_group':
      if (node.custom_type_name) {
        // 1. 尝试从 'approvers' 表获取 (主要用于报销)
        const [customApprovers] = await pool.query(
          `SELECT a.user_id, a.delegate_user_id, a.delegate_start_date, a.delegate_end_date,
                  a.department_scope, a.amount_min, a.amount_limit
           FROM approvers a
           WHERE a.approver_type = ? AND a.is_active = 1`,
          [node.custom_type_name]
        )
        
        if (customApprovers.length > 0) {
          for (const approver of customApprovers) {
            // 部门校验
            if (approver.department_scope) {
              const scope = typeof approver.department_scope === 'string' ? JSON.parse(approver.department_scope) : approver.department_scope;
              if (scope?.length > 0 && !scope.includes(data.department_id)) continue;
            }

            // 金额区间校验
            const appAmount = parseFloat(data.total_amount || 0);
            const minAmount = parseFloat(approver.amount_min || 0);
            const maxAmount = approver.amount_limit ? parseFloat(approver.amount_limit) : Infinity;

            if (appAmount < minAmount || appAmount > maxAmount) {
              // console.log(`[Workflow] 金额 ${appAmount} 不在区间 [${minAmount}, ${maxAmount}] 内，跳过 ${approver.user_id}`);
              continue;
            }

            // 检查代理
            const today = new Date().toISOString().split('T')[0]
            if (approver.delegate_user_id && approver.delegate_start_date <= today && approver.delegate_end_date >= today) {
              approverIds.push(approver.delegate_user_id)
            } else {
              approverIds.push(approver.user_id)
            }
          }
        } else {
          // 2. 尝试从 'special_approval_groups' 表获取 (用于资产申请)
          const [groups] = await pool.query('SELECT id FROM special_approval_groups WHERE name = ?', [node.custom_type_name]);
          if (groups.length > 0) {
            const groupId = groups[0].id;
            const [members] = await pool.query(`
              SELECT member_type, member_id FROM special_approval_group_members WHERE group_id = ?
            `, [groupId]);

            for (const member of members) {
              if (member.member_type === 'user') {
                approverIds.push(member.member_id);
              } else if (member.member_type === 'role') {
                const [roleUsers] = await pool.query('SELECT user_id FROM user_roles WHERE role_id = ?', [member.member_id]);
                approverIds.push(...roleUsers.map(u => u.user_id));
              }
            }
          }
        }
      }
      break

    case 'department_manager':
      if (data.department_id) {
        const [managers] = await pool.query(
          'SELECT id FROM users WHERE department_id = ? AND is_department_manager = 1 AND status = "active"',
          [data.department_id]
        )
        approverIds.push(...managers.map(m => m.id))
      }
      break

    case 'initiator':
      approverIds.push(data.user_id);
      break;

    default:
      console.warn(`未知的审批人类型: ${node.approver_type}`)
  }

  const result = [...new Set(approverIds)]

  // --- 关键优化：审批人为空时的兜底逻辑 ---
  if (result.length === 0) {
    console.warn(`[Workflow] 节点 ${node.node_name} 未匹配到审批人，正在寻找系统管理员兜底`);
    // 获取所有名为 admin 的用户，或者拥有“超级管理员”角色的用户
    const [adminUsers] = await pool.query(`
      SELECT DISTINCT u.id 
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.username = 'admin' 
      OR r.name = '超级管理员' 
      OR r.name = 'admin'
    `);
    
    if (adminUsers.length > 0) {
      adminUsers.forEach(admin => result.push(admin.id));
    }
  }

  // 如果依然没有任何审批人，抛出业务异常而非让 SQL 报错
  if (result.length === 0) {
    const error = new Error('该审批环节未正确配置审批人');
    error.isBusinessError = true;
    throw error;
  }

  return result;
}

/**
 * 启动审批流程 (通用)
 * @param {Object} pool - 数据库连接池
 * @param {string} businessType - 'reimbursement' 或 'asset_request'
 * @param {number} businessId - 业务单ID
 * @returns {Object}
 */
async function startWorkflow(pool, businessType, businessId) {
  const tableName = businessType === 'reimbursement' ? 'reimbursements' : 'asset_requests';
  
  try {
    const [records] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [businessId]);
    if (records.length === 0) throw new Error('单据不存在');
    const data = records[0];

    const workflow = await selectWorkflow(pool, businessType, data);
    const nodes = await getWorkflowNodes(pool, workflow.id);
    if (nodes.length === 0) throw new Error('审批流程未配置节点');

    // 找到第一个生效节点
    let firstNode = nodes[0]; // 简化逻辑，暂不处理跳过

    // 更新单据状态
    await pool.query(
      `UPDATE ${tableName} SET status = 'pending', workflow_id = ?, current_node_id = ?, submitted_at = NOW() WHERE id = ?`,
      [workflow.id, firstNode.id, businessId]
    );

    const approvers = await findNodeApprovers(pool, firstNode, data);

    return { completed: false, workflow, currentNode: firstNode, approvers };
  } catch (error) {
    console.error(`启动 ${businessType} 流程失败:`, error);
    throw error;
  }
}

/**
 * 处理审批动作 (通用)
 */
async function processApproval(pool, businessType, businessId, approverId, action, opinion) {
  const tableName = businessType === 'reimbursement' ? 'reimbursements' : 'asset_requests';
  const connection = await pool.getConnection()
  await connection.beginTransaction()

  try {
    const [records] = await connection.query(`SELECT * FROM ${tableName} WHERE id = ? FOR UPDATE`, [businessId])
    if (records.length === 0) throw new Error('单据不存在');
    const data = records[0];

    const [nodes] = await connection.query('SELECT * FROM approval_workflow_nodes WHERE id = ?', [data.current_node_id])
    if (nodes.length === 0) throw new Error('当前节点失效');
    const currentNode = nodes[0];

    // 记录审批历史 (建议复用 approval_records 表，增加 business_type 字段)
    await connection.query(
      `INSERT INTO approval_records (reimbursement_id, node_id, node_order, approver_id, action, opinion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [businessType === 'reimbursement' ? businessId : (businessId + 1000000), // 临时Hack，建议重构表结构支持 business_type
       currentNode.id, currentNode.node_order, approverId, action, opinion]
    )

    let result = { action, completed: false };

    if (action === 'approve') {
      const [nextNodes] = await connection.query(
        'SELECT * FROM approval_workflow_nodes WHERE workflow_id = ? AND node_order > ? ORDER BY node_order ASC LIMIT 1',
        [data.workflow_id, currentNode.node_order]
      )

      if (nextNodes.length > 0) {
        const nextNode = nextNodes[0];
        await connection.query(`UPDATE ${tableName} SET current_node_id = ? WHERE id = ?`, [nextNode.id, businessId]);
        result.approvers = await findNodeApprovers(pool, nextNode, data);
        result.nextNode = nextNode;
      } else {
        await connection.query(`UPDATE ${tableName} SET status = 'approved', current_node_id = NULL, completed_at = NOW() WHERE id = ?`, [businessId]);
        result.completed = true;
      }
    } else if (action === 'reject') {
      await connection.query(`UPDATE ${tableName} SET status = 'rejected', current_node_id = NULL, completed_at = NOW() WHERE id = ?`, [businessId]);
      result.completed = true;
    }

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 获取审批进度 (通用)
 */
async function getApprovalProgress(pool, businessType, businessId) {
  const tableName = businessType === 'reimbursement' ? 'reimbursements' : 'asset_requests';
  const [records] = await pool.query(
    `SELECT r.*, w.name as workflow_name FROM ${tableName} r 
     LEFT JOIN approval_workflows w ON r.workflow_id = w.id WHERE r.id = ?`, [businessId]
  )
  if (records.length === 0) return null;
  const data = records[0];

  const [nodes] = await pool.query('SELECT * FROM approval_workflow_nodes WHERE workflow_id = ? ORDER BY node_order ASC', [data.workflow_id]);
  
  // 这里暂时简化，记录表关联逻辑需要根据实际业务调整
  const [history] = await pool.query(
    'SELECT ar.*, u.real_name as approver_name FROM approval_records ar LEFT JOIN users u ON ar.approver_id = u.id WHERE reimbursement_id = ? ORDER BY ar.approved_at ASC',
    [businessType === 'reimbursement' ? businessId : (businessId + 1000000)]
  )

  return { data, nodes, history, currentNodeId: data.current_node_id };
}

module.exports = {
  startWorkflow,
  processApproval,
  getApprovalProgress,
  selectWorkflow
}