// 认证和权限工具函数

/**
 * 获取当前登录用户信息
 */
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return null
  }
}

/**
 * 获取当前用户的部门ID
 */
export const getCurrentUserDepartmentId = () => {
  const user = getCurrentUser()
  return user?.department_id || null
}

/**
 * 判断当前用户是否是系统管理员
 * 系统管理员的判断标准：
 * 1. username 为 'admin'
 * 2. 或者 department_id 为 1（假设1是管理部门）
 * 3. 或者有特定的管理员角色标识
 */
export const isSystemAdmin = () => {
  const user = getCurrentUser()
  if (!user) return false

  // 方式1：通过用户名判断
  if (user.username === 'admin') return true

  // 方式2：通过部门判断（可根据实际情况调整）
  // if (user.department_id === 1) return true

  // 方式3：通过角色判断（如果有角色字段）
  // if (user.role === 'admin' || user.role === 'super_admin') return true

  return false
}

/**
 * 获取用户Token
 */
export const getToken = () => {
  return localStorage.getItem('token')
}

/**
 * 清除用户信息（登出）
 */
export const clearAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

/**
 * 检查用户是否已登录
 */
export const isAuthenticated = () => {
  return !!getToken() && !!getCurrentUser()
}


/**
 * 根据用户权限过滤部门列表
 * 系统管理员可以看到所有部门，普通用户只能看到自己的部门
 * @param {Array} departments - 部门列表
 * @returns {Array} 过滤后的部门列表
 */
export const filterDepartmentsByPermission = (departments) => {
  const currentUser = getCurrentUser()
  const isAdmin = isSystemAdmin()

  // 管理员可以看到所有部门
  if (isAdmin) {
    return departments
  }

  // 普通用户只能看到自己的部门
  if (currentUser?.department_id) {
    return departments.filter(d => d.id === currentUser.department_id)
  }

  // 没有部门的用户看不到任何部门
  return []
}

/**
 * 根据用户权限过滤员工列表
 * 系统管理员可以看到所有员工，普通用户只能看到同部门的员工
 * @param {Array} employees - 员工列表
 * @returns {Array} 过滤后的员工列表
 */
export const filterEmployeesByPermission = (employees) => {
  const currentUser = getCurrentUser()
  const isAdmin = isSystemAdmin()

  // 管理员可以看到所有员工
  if (isAdmin) {
    return employees
  }

  // 普通用户只能看到同部门的员工
  if (currentUser?.department_id) {
    return employees.filter(e => e.department_id === currentUser.department_id)
  }

  // 没有部门的用户看不到任何员工
  return []
}
