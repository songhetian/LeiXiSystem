// 权限检查中间件
const jwt = require('jsonwebtoken')

/**
 * 获取当前用户的权限信息
 */
async function getUserPermissions(pool, userId, departmentIdFromToken, redis) {
  const cacheKey = `user:permissions:${userId}`;
  
  // 1. 尝试从 Redis 获取缓存
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        // console.log(`[Redis] Hit permissions cache for user ${userId}`);
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      console.error('[Redis] Get cache error:', cacheError);
    }
  }

  try {
    // 2. 缓存未命中，从 MySQL 查询
    // console.log(`[MySQL] Fetching permissions for user ${userId}`);
    
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

    // 优先检查用户个人部门权限
    let viewableDepartmentIds = [];
    const [userDepartments] = await pool.query(`
      SELECT DISTINCT ud.department_id
      FROM user_departments ud
      WHERE ud.user_id = ?
    `, [userId]);

    // 如果用户有个人部门权限，使用个人权限
    if (userDepartments.length > 0) {
      viewableDepartmentIds = userDepartments.map(ud => ud.department_id);
    } else {
      // 否则使用角色部门权限
      const [roleDepartments] = await pool.query(`
        SELECT DISTINCT rd.department_id
        FROM role_departments rd
        INNER JOIN user_roles ur ON rd.role_id = ur.role_id
        WHERE ur.user_id = ?
      `, [userId])

      viewableDepartmentIds = roleDepartments.map(rd => rd.department_id)
    }

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

    // 去重
    const uniqueViewableDepartmentIds = [...new Set(viewableDepartmentIds)];

    // --- 性能优化：预生成 SQL 过滤片段 ---
    const placeholders = uniqueViewableDepartmentIds.map(() => '?').join(',');
    
    const permissions = {
      userId: user.id,
      username: user.username,
      departmentId: effectiveDepartmentId,
      viewableDepartmentIds: uniqueViewableDepartmentIds, 
      canViewAllDepartments: canViewAllDepartments, 
      roles: roles,
      // 预存占位符和逻辑片段
      _filterCache: {
        placeholders: placeholders,
        isRestricted: !canViewAllDepartments
      }
    };

    // 3. 写入 Redis 缓存 (有效期 1 小时)
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(permissions), 'EX', 3600);
        // console.log(`[Redis] Cached permissions for user ${userId}`);
      } catch (cacheError) {
        console.error('[Redis] Set cache error:', cacheError);
      }
    }

    return permissions;
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

    const { JWT_SECRET } = require('../config')
    const decoded = jwt.verify(token, JWT_SECRET)

    // 从 fastify 实例中获取 redis 客户端
    const redis = request.server.redis;

    // --- Redis Session 校验 (黑名单/强制下线逻辑) ---
    if (redis) {
      const activeToken = await redis.get(`user:session:${decoded.id}`);
      if (!activeToken || activeToken !== token) {
        // console.log(`[Redis] Session invalid or kicked out for user ${decoded.id}`);
        return null; // 视为无权限，前端会收到 401 并跳转登录
      }
    }

    return await getUserPermissions(pool, decoded.id, decoded.department_id, redis)
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
  // 超级管理员或无限制：直接通过
  if (!permissions || permissions.canViewAllDepartments || !permissions._filterCache?.isRestricted) {
    return { query, params }
  }

  const { placeholders } = permissions._filterCache;

  // 1. 如果有明确的部门列表：(dept IN (...) OR user = self)
  if (placeholders) {
    query += ` AND (${departmentField} IN (${placeholders}) OR ${userField} = ?)`
    params.push(...permissions.viewableDepartmentIds, permissions.userId)
    return { query, params }
  }

  // 2. 兜底逻辑：仅能看自己
  query += ` AND ${userField} = ?`
  params.push(permissions.userId)
  return { query, params }
}

module.exports = {
  getUserPermissions,
  extractUserPermissions,
  applyDepartmentFilter
}
