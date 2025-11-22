// 权限检查中间件
const jwt = require('jsonwebtoken')

/**
 * 获取当前用户的权限信息
 */
async function getUserPermissions(pool, userId) {
  try {
    // 获取用户信息
    const [users] = await pool.query(
      'SELECT id, username, department_id FROM users WHERE id = ?',
      [userId]
    )

    if (users.length === 0) return null

    const user = users[0]

    // 获取用户的所有角色
    const [roles] = await pool.query(`
      SELECT r.id, r.name
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId])

    // 不管是不是超级管理员，都根据JWT中的部门来显示
    const canViewAllDepartments = false

    // 获取用户角色可以查看的所有部门ID
    const [roleDepartments] = await pool.query(`
      SELECT DISTINCT rd.department_id
      FROM role_departments rd
      INNER JOIN user_roles ur ON rd.role_id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId])

    const viewableDepartmentIds = roleDepartments.map(rd => rd.department_id)

    // 如果没有配置角色部门权限，且没有查看所有部门权限，默认只能查看自己的部门
    if (!canViewAllDepartments && viewableDepartmentIds.length === 0 && user.department_id) {
      viewableDepartmentIds.push(user.department_id)
    }

    return {
      userId: user.id,
      username: user.username,
      departmentId: user.department_id,
      viewableDepartmentIds: viewableDepartmentIds, // 可查看的部门ID列表
      canViewAllDepartments: canViewAllDepartments, // 是否可以查看所有部门
      roles: roles
    }
  } catch (error) {
    console.error('获取用户权限失败:', error)
    return null
  }
}

/**
 * 从请求中提取并验证用户权限
 */
async function extractUserPermissions(request, pool) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) return null

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
    const decoded = jwt.verify(token, JWT_SECRET)

    return await getUserPermissions(pool, decoded.id)
  } catch (error) {
    return null
  }
}

/**
 * 应用部门权限过滤
 * @param {Object} permissions - 用户权限对象
 * @param {String} query - SQL查询语句
 * @param {Array} params - SQL参数数组
 * @param {String} departmentField - 部门字段名（如 'u.department_id'）
 * @returns {Object} { query, params } - 修改后的查询和参数
 */
function applyDepartmentFilter(permissions, query, params, departmentField = 'u.department_id') {
  // 如果没有权限信息（未登录或无角色），限制为看不到任何数据
  if (!permissions) {
    query += ` AND 1=0`
    return { query, params }
  }

  // 如果有查看所有部门的权限，不进行过滤
  if (permissions.canViewAllDepartments) {
    return { query, params }
  }

  // 使用部门权限列表
  if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
    // 可以查看多个部门的数据
    const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',')
    query += ` AND ${departmentField} IN (${placeholders})`
    params.push(...permissions.viewableDepartmentIds)
  } else {
    // 没有配置部门权限，看不到任何数据
    query += ` AND 1=0`
  }

  return { query, params }
}

module.exports = {
  getUserPermissions,
  extractUserPermissions,
  applyDepartmentFilter
}
