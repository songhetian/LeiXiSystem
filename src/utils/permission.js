// 权限管理工具

/**
 * 获取用户权限列表
 */
export const getUserPermissions = () => {
  try {
    const permissionsStr = localStorage.getItem('permissions')
    return permissionsStr ? JSON.parse(permissionsStr) : []
  } catch (error) {
    console.error('获取权限列表失败:', error)
    return []
  }
}

/**
 * 检查用户是否有某个权限
 * @param {string} permissionCode - 权限代码
 * @returns {boolean}
 */
export const hasPermission = (permissionCode) => {
  const permissions = getUserPermissions()
  return permissions.includes(permissionCode)
}

/**
 * 检查用户是否有任意一个权限
 * @param {string[]} permissionCodes - 权限代码数组
 * @returns {boolean}
 */
export const hasAnyPermission = (permissionCodes) => {
  const permissions = getUserPermissions()
  return permissionCodes.some(code => permissions.includes(code))
}

/**
 * 检查用户是否有所有权限
 * @param {string[]} permissionCodes - 权限代码数组
 * @returns {boolean}
 */
export const hasAllPermissions = (permissionCodes) => {
  const permissions = getUserPermissions()
  return permissionCodes.every(code => permissions.includes(code))
}

/**
 * 获取用户权限详情
 */
export const getPermissionDetails = () => {
  try {
    const detailsStr = localStorage.getItem('permissionDetails')
    return detailsStr ? JSON.parse(detailsStr) : null
  } catch (error) {
    console.error('获取权限详情失败:', error)
    return null
  }
}

/**
 * 保存权限到本地存储
 */
export const savePermissions = (permissionData) => {
  try {
    localStorage.setItem('permissions', JSON.stringify(permissionData.permissions || []))
    localStorage.setItem('permissionDetails', JSON.stringify(permissionData))
  } catch (error) {
    console.error('保存权限失败:', error)
  }
}

/**
 * 清除权限
 */
export const clearPermissions = () => {
  localStorage.removeItem('permissions')
  localStorage.removeItem('permissionDetails')
}

/**
 * 菜单权限映射
 * 定义每个菜单项需要的权限代码
 */
export const MENU_PERMISSIONS = {
  // 用户管理
  'user-employee': ['employee:view', 'employee:list'],
  'user-changes': ['employee:view', 'employee:changes'],
  'user-approval': ['employee:approve'],
  'user-permission': ['permission:manage', 'role:manage'],

  // 组织架构
  'org-department': ['department:view', 'department:manage'],
  'org-position': ['position:view', 'position:manage'],

  // 考勤管理
  'attendance-home': ['attendance:view'],
  'attendance-records': ['attendance:view', 'attendance:records'],
  'attendance-leave': ['leave:apply', 'leave:view'],
  'attendance-overtime': ['overtime:apply', 'overtime:view'],
  'attendance-shifts': ['shift:view', 'shift:manage'],
  'attendance-schedule': ['schedule:view', 'schedule:manage'],
  'attendance-approval': ['attendance:approve'],
  'attendance-settings': ['attendance:settings'],

  // 知识库
  'knowledge-base': ['knowledge:view'],
  'knowledge-manage': ['knowledge:manage'],

  // 考试管理
  'exam-manage': ['exam:manage'],
  'exam-category': ['exam:manage'],

  // 统计报表
  'statistics': ['statistics:view']
}

/**
 * 检查菜单是否有权限访问
 * @param {string} menuId - 菜单ID
 * @returns {boolean}
 */
export const hasMenuPermission = (menuId) => {
  const details = getPermissionDetails()

  // 管理员有所有权限
  if (details?.isAdmin) {
    return true
  }

  // 如果没有定义权限要求，默认允许访问
  const requiredPermissions = MENU_PERMISSIONS[menuId]
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true
  }

  // 检查是否有任意一个所需权限
  return hasAnyPermission(requiredPermissions)
}

/**
 * 过滤有权限的菜单
 * @param {Array} menus - 菜单列表
 * @returns {Array} 过滤后的菜单列表
 */
export const filterMenusByPermission = (menus) => {
  return menus.map(menu => {
    // 如果有子菜单，递归过滤
    if (menu.children && menu.children.length > 0) {
      const filteredChildren = menu.children.filter(child => hasMenuPermission(child.id))

      // 如果所有子菜单都被过滤掉了，则隐藏父菜单
      if (filteredChildren.length === 0) {
        return null
      }

      return {
        ...menu,
        children: filteredChildren
      }
    }

    // 检查单个菜单权限
    return hasMenuPermission(menu.id) ? menu : null
  }).filter(Boolean) // 移除null项
}
