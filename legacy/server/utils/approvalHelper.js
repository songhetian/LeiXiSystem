const findApprover = async (pool, applicantId, departmentId) => {
  try {
    // 1. 查找同部门的部门主管
    // 要求：department_id 匹配且 is_department_manager = 1
    const [managers] = await pool.query(
      'SELECT id, username, real_name FROM users WHERE department_id = ? AND is_department_manager = 1 AND status = "active"',
      [departmentId]
    )

    if (managers.length > 0) {
      // 如果有多个主管，默认返回第一个（或者可以添加逻辑处理多个）
      return managers[0]
    }

    // 2. 如果找不到部门主管，可以回退到超级管理员（可选）
    // 这里暂时返回 null，由调用方决定如何处理（例如提示未配置审批人）
    return null

  } catch (error) {
    console.error('查找审批人失败:', error)
    throw error
  }
}

module.exports = { findApprover }
