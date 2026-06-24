/**
 * 权限检查中间件
 * 用于验证用户是否拥有特定权限
 */

/**
 * 检查用户是否有指定权限
 * @param {Object} pool - 数据库连接池
 * @param {Number} userId - 用户ID
 * @param {String} permissionCode - 权限代码
 * @returns {Promise<Boolean>}
 */
async function hasPermission(pool, userId, permissionCode) {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ? AND p.code = ?
    `, [userId, permissionCode])

    return rows[0].count > 0
  } catch (error) {
    console.error('权限检查失败:', error)
    return false
  }
}

/**
 * 检查用户是否有多个权限中的任意一个（OR关系）
 * @param {Object} pool - 数据库连接池
 * @param {Number} userId - 用户ID
 * @param {Array<String>} permissionCodes - 权限代码数组
 * @returns {Promise<Boolean>}
 */
async function hasAnyPermission(pool, userId, permissionCodes) {
  try {
    const placeholders = permissionCodes.map(() => '?').join(',')
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ? AND p.code IN (${placeholders})
    `, [userId, ...permissionCodes])

    return rows[0].count > 0
  } catch (error) {
    console.error('权限检查失败:', error)
    return false
  }
}

/**
 * 检查用户是否拥有所有指定权限（AND关系）
 * @param {Object} pool - 数据库连接池
 * @param {Number} userId - 用户ID
 * @param {Array<String>} permissionCodes - 权限代码数组
 * @returns {Promise<Boolean>}
 */
async function hasAllPermissions(pool, userId, permissionCodes) {
  try {
    const placeholders = permissionCodes.map(() => '?').join(',')
    const [rows] = await pool.query(`
      SELECT COUNT(DISTINCT p.code) as count
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ? AND p.code IN (${placeholders})
    `, [userId, ...permissionCodes])

    return rows[0].count === permissionCodes.length
  } catch (error) {
    console.error('权限检查失败:', error)
    return false
  }
}

/**
 * 获取用户的所有权限代码
 * @param {Object} pool - 数据库连接池
 * @param {Number} userId - 用户ID
 * @returns {Promise<Array<String>>}
 */
async function getUserPermissions(pool, userId) {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId])

    return rows.map(row => row.code)
  } catch (error) {
    console.error('获取用户权限失败:', error)
    return []
  }
}

/**
 * 创建权限检查中间件
 * @param {Object} pool - 数据库连接池
 * @param {String|Array<String>} permissions - 权限代码或权限代码数组
 * @param {String} mode - 检查模式: 'any'(任一) 或 'all'(全部)，默认'any'
 * @returns {Function} Fastify中间件函数
 */
function checkPermission(pool, permissions, mode = 'any') {
  return async (request, reply) => {
    try {
      // 检查是否已登录
      if (!request.user || !request.user.id) {
        return reply.code(401).send({
          success: false,
          message: '未登录或登录已过期'
        })
      }

      const userId = request.user.id
      const permissionArray = Array.isArray(permissions) ? permissions : [permissions]

      let hasAccess = false

      if (mode === 'all') {
        // 需要拥有所有权限
        hasAccess = await hasAllPermissions(pool, userId, permissionArray)
      } else {
        // 只需要拥有任一权限
        hasAccess = await hasAnyPermission(pool, userId, permissionArray)
      }

      if (!hasAccess) {
        return reply.code(403).send({
          success: false,
          message: '没有权限执行此操作',
          required_permissions: permissionArray
        })
      }

      // 权限检查通过，继续执行
    } catch (error) {
      console.error('权限检查中间件错误:', error)
      return reply.code(500).send({
        success: false,
        message: '权限检查失败'
      })
    }
  }
}

/**
 * 检查用户角色级别
 * @param {Object} pool - 数据库连接池
 * @param {Number} userId - 用户ID
 * @param {Number} minLevel - 最小角色级别
 * @returns {Promise<Boolean>}
 */
async function hasRoleLevel(pool, userId, minLevel) {
  try {
    const [rows] = await pool.query(`
      SELECT MAX(r.level) as max_level
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId])

    return rows[0].max_level >= minLevel
  } catch (error) {
    console.error('角色级别检查失败:', error)
    return false
  }
}

/**
 * 创建角色级别检查中间件
 * @param {Object} pool - 数据库连接池
 * @param {Number} minLevel - 最小角色级别
 * @returns {Function} Fastify中间件函数
 */
function checkRoleLevel(pool, minLevel) {
  return async (request, reply) => {
    try {
      if (!request.user || !request.user.id) {
        return reply.code(401).send({
          success: false,
          message: '未登录或登录已过期'
        })
      }

      const hasAccess = await hasRoleLevel(pool, request.user.id, minLevel)

      if (!hasAccess) {
        return reply.code(403).send({
          success: false,
          message: '角色级别不足',
          required_level: minLevel
        })
      }
    } catch (error) {
      console.error('角色级别检查中间件错误:', error)
      return reply.code(500).send({
        success: false,
        message: '角色级别检查失败'
      })
    }
  }
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  checkPermission,
  hasRoleLevel,
  checkRoleLevel
}
