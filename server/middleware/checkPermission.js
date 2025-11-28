// 权限检查中间件
const jwt = require('jsonwebtoken')

/**
 * 获取当前用户的权限信息
 */
async function getUserPermissions(pool, userId, departmentIdFromToken) {
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

    // 检查用户是否是超级管理员
    const canViewAllDepartments = roles.some(r => r.name === '超级管理员')

    // 获取用户角色可以查看的所有部门ID
    const [roleDepartments] = await pool.query(`
      SELECT DISTINCT rd.department_id
      FROM role_departments rd
      INNER JOIN user_roles ur ON rd.role_id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId])

    const viewableDepartmentIds = roleDepartments.map(rd => rd.department_id)

    // 优先使用JWT中的部门ID，如果没有则使用数据库中的部门ID
    const effectiveDepartmentId = departmentIdFromToken || user.department_id;

    // 如果是超级管理员，添加自己的部门到可查看部门列表
    if (canViewAllDepartments && effectiveDepartmentId) {
      viewableDepartmentIds.push(effectiveDepartmentId);
    }
    // 如果没有配置角色部门权限，默认只能查看自己的部门
    else if (viewableDepartmentIds.length === 0 && effectiveDepartmentId) {
      viewableDepartmentIds.push(effectiveDepartmentId);
    }

    return {
      userId: user.id,
      username: user.username,
      departmentId: effectiveDepartmentId,
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

    return await getUserPermissions(pool, decoded.id, decoded.department_id)
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
function applyDepartmentFilter(permissions, query, params, departmentField = 'u.department_id', userField = 'u.id') {
  // 如果没有权限信息（未登录或无角色），限制为看不到任何数据
  if (!permissions) {
    console.log('[applyDepartmentFilter] No permissions, blocking all data')
    query += ` AND 1=0`
    return { query, params }
  }

  console.log('[applyDepartmentFilter] Permissions:', {
    userId: permissions.userId,
    departmentId: permissions.departmentId,
    canViewAllDepartments: permissions.canViewAllDepartments,
    viewableDepartmentIds: permissions.viewableDepartmentIds
  })

  // 严格根据 viewableDepartmentIds 过滤
  // 即使是超级管理员，也必须配置了可查看的部门才能查看
  if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
    console.log(`[applyDepartmentFilter] Filtering by viewableDepartmentIds: ${permissions.viewableDepartmentIds.join(',')}`)
    const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',')

    // 允许查看指定部门的员工 OR 自己的记录
    query += ` AND (${departmentField} IN (${placeholders}) OR ${userField} = ?)`
    params.push(...permissions.viewableDepartmentIds, permissions.userId)
    return { query, params }
  }

  // 如果没有可查看的部门列表，只能查看自己
  console.log('[applyDepartmentFilter] No viewable departments, restricting to self')
  query += ` AND ${userField} = ?`
  params.push(permissions.userId)
  return { query, params }
}

module.exports = {
  getUserPermissions,
  extractUserPermissions,
  applyDepartmentFilter
}
