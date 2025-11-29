const fastify = require('fastify')({
  logger: true,
  bodyLimit: 10485760 // 10MB
})
const cors = require('@fastify/cors')
const multipart = require('@fastify/multipart')
const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream')
const util = require('util')
const pump = util.promisify(pipeline)
// 显式指定 .env 文件路径以确保正确加载
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

// 引入权限中间件
const { extractUserPermissions, applyDepartmentFilter } = require('./middleware/checkPermission')

// 注册 CORS
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
})

// 注册文件上传
// 注意：multipart 只处理 multipart/form-data，不影响 application/json
fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
})

// 添加请求日志钩子
fastify.addHook('onRequest', async (request, reply) => {
  if (request.url.includes('/api/knowledge/articles') && (request.method === 'PUT' || request.method === 'POST')) {
  }
})

fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.includes('/api/knowledge/articles') && (request.method === 'PUT' || request.method === 'POST')) {
  }
})

// 加载数据库配置
// 在打包环境中，配置位于 resources/config/db-config.json
// 在开发环境中，配置位于 ../config/db-config.json
const isPackaged = __dirname.includes('app.asar');
const dbConfigPath = isPackaged
  ? path.join(__dirname, '../../config/db-config.json')
  : path.join(__dirname, '../config/db-config.json');

console.log('尝试加载数据库配置:', dbConfigPath);

// 引入配置加密工具
const { loadConfig } = require('./utils/config-crypto');

let dbConfigJson = {}
try {
  // 使用 loadConfig 自动检测并解密配置（如果已加密）
  dbConfigJson = loadConfig(dbConfigPath);
} catch (error) {
  console.error('加载数据库配置失败:', error)
}

// 创建上传目录
// 优先使用配置文件中的 sharedDirectory，否则使用默认的 uploads 目录
let uploadDir = path.join(__dirname, '../uploads')
if (dbConfigJson.upload && dbConfigJson.upload.sharedDirectory) {
  // 确保路径是绝对路径
  uploadDir = path.isAbsolute(dbConfigJson.upload.sharedDirectory)
    ? dbConfigJson.upload.sharedDirectory
    : path.resolve(__dirname, dbConfigJson.upload.sharedDirectory)
  console.log('使用配置的上传目录:', uploadDir)
}

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true })
  } catch (error) {
    console.error('创建上传目录失败:', error)
    // 如果创建失败（可能是权限问题），回退到默认目录
    uploadDir = path.join(__dirname, '../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    console.log('回退到默认上传目录:', uploadDir)
  }
}

// 静态文件服务
fastify.register(require('@fastify/static'), {
  root: uploadDir,
  prefix: '/uploads/'
})

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'

// 数据库配置
const dbConfig = {
  host: (dbConfigJson.database && dbConfigJson.database.host) || process.env.DB_HOST || 'localhost',
  user: (dbConfigJson.database && dbConfigJson.database.user) || process.env.DB_USER || 'tian',
  password: (dbConfigJson.database && dbConfigJson.database.password) || process.env.DB_PASSWORD || 'root',
  database: (dbConfigJson.database && dbConfigJson.database.database) || process.env.DB_NAME || 'leixin_customer_service',
  port: (dbConfigJson.database && dbConfigJson.database.port) || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00'  // 设置为北京时间
}

let pool

// 初始化数据库连接池
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig)

    // 设置时区为北京时间
    const connection = await pool.getConnection()
    await connection.query("SET time_zone = '+08:00'")
    connection.release()

    // 将 pool 装饰到 fastify 实例上，供路由使用
    fastify.decorate('mysql', pool)
    console.error('✅ 数据库初始化成功')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
  }
}

// 健康检查
fastify.get('/api/health', async (request, reply) => {
  try {
    // 测试数据库连接
    if (pool) {
      const connection = await pool.getConnection();
      await connection.ping(); // 测试连接
      connection.release();

      // 测试查询
      const [result] = await pool.query('SELECT 1 as connected');

      return {
        status: 'ok',
        message: '服务正常',
        database: 'connected',
        dbTest: result[0].connected === 1
      };
    } else {
      return {
        status: 'warning',
        message: '服务运行中但数据库未初始化',
        database: 'not initialized'
      };
    }
  } catch (error) {
    console.error('健康检查失败:', error);
    return {
      status: 'error',
      message: '数据库连接失败',
      database: 'disconnected',
      error: error.message
    };
  }
})

// 添加根路径处理程序
fastify.get('/', async (request, reply) => {
  return {
    message: '客服管理系统后端服务正在运行',
    version: '1.0.0',
    documentation: '请访问前端应用或使用API接口',
    api_docs: '/api/health'
  }
})

// 添加API根路径
fastify.get('/api', async (request, reply) => {
  return {
    message: '客服管理系统API服务',
    version: '1.0.0',
    endpoints: [
      'GET /api/health - 健康检查',
      'POST /api/auth/login - 用户登录',
      'GET /api/employees - 获取员工列表'
    ]
  }
})

// ==================== 文件上传 API ====================

// 单个文件上传
fastify.post('/api/upload', async (request, reply) => {
  try {
    const data = await request.file()

    if (!data) {
      return reply.code(400).send({ error: '没有上传文件' })
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const ext = path.extname(data.filename)
    const filename = `${timestamp}-${randomStr}${ext}`
    const filepath = path.join(uploadDir, filename)

    // 保存文件
    await pump(data.file, fs.createWriteStream(filepath))

    // 返回文件URL - 使用配置的publicUrl或动态生成
    let baseUrl;
    if (dbConfigJson.upload && dbConfigJson.upload.publicUrl) {
      baseUrl = dbConfigJson.upload.publicUrl;
    } else {
      const protocol = request.protocol;
      const host = request.headers.host || request.hostname;
      baseUrl = `${protocol}://${host}`;
    }
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    return {
      success: true,
      url: fileUrl,
      filename: data.filename,
      size: fs.statSync(filepath).size
    }
  } catch (error) {
    console.error('文件上传失败:', error)
    return reply.code(500).send({ error: '文件上传失败' })
  }
})

// 批量文件上传
fastify.post('/api/upload/multiple', async (request, reply) => {
  try {
    const parts = request.parts()
    const uploadedFiles = []

    for await (const part of parts) {
      if (part.file) {
        // 生成唯一文件名
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(7)
        const ext = path.extname(part.filename)
        const filename = `${timestamp}-${randomStr}${ext}`
        const filepath = path.join(uploadDir, filename)

        // 保存文件
        await pump(part.file, fs.createWriteStream(filepath))

        // 生成文件URL
        let baseUrl;
        if (dbConfigJson.upload && dbConfigJson.upload.publicUrl) {
          baseUrl = dbConfigJson.upload.publicUrl;
        } else {
          const protocol = request.protocol;
          const host = request.headers.host || request.hostname;
          baseUrl = `${protocol}://${host}`;
        }

        // 收集结果
        uploadedFiles.push({
          url: `${baseUrl}/uploads/${filename}`,
          filename: part.filename,
          size: fs.statSync(filepath).size
        })
      }
    }

    return {
      success: true,
      files: uploadedFiles
    }
  } catch (error) {
    console.error('批量上传失败:', error)
    return reply.code(500).send({ error: '批量上传失败' })
  }
})

// ==================== 认证 API ====================

// 用户注册
fastify.post('/api/auth/register', async (request, reply) => {
  const { username, password, real_name, email, phone } = request.body

  try {
    // 检查用户名是否已存在
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username])
    if (existing.length > 0) {
      return reply.code(400).send({ success: false, message: '用户名已存在' })
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10)

    // 注册用户
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, real_name, email, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, passwordHash, real_name, email, phone, 'active']
    )

    return { success: true, message: '注册成功', userId: result.insertId }
  } catch (error) {
    console.error('注册失败:', error)
    return reply.code(500).send({ success: false, message: '注册失败' })
  }
})

// 检查用户是否已有活跃会话
fastify.post('/api/auth/check-session', async (request, reply) => {
  const { username } = request.body

  try {
    // 查询用户的session_token
    const [users] = await pool.query(
      'SELECT id, session_token, session_created_at FROM users WHERE username = ?',
      [username]
    )

    if (users.length === 0) {
      return { hasActiveSession: false }
    }

    const user = users[0]

    // 如果有session_token，说明有活跃会话
    if (user.session_token) {
      // 验证token是否还有效
      try {
        jwt.verify(user.session_token, JWT_SECRET)

        // Token有效，返回会话信息
        return {
          hasActiveSession: true,
          sessionCreatedAt: user.session_created_at,
          message: '该账号已在其他设备登录'
        }
      } catch (error) {
        // Token已过期，视为无活跃会话
        return { hasActiveSession: false }
      }
    }

    return { hasActiveSession: false }
  } catch (error) {
    console.error('检查会话失败:', error)
    return reply.code(500).send({ success: false, message: '检查会话失败' })
  }
})

// 用户登录 (Updated to include department_id)
fastify.post('/api/auth/login', async (request, reply) => {
  const { username, password, forceLogin } = request.body

  try {
    // 查询用户
    const [users] = await pool.query(
      'SELECT id, username, password_hash, real_name, email, phone, status, department_id FROM users WHERE username = ?',
      [username]
    )

    if (users.length === 0) {
      return reply.code(401).send({ success: false, message: 'Invalid username or password' })
    }

    const user = users[0]

    // 账号状态检查
    if (user.status === 'pending') {
      return reply.code(403).send({ success: false, message: '账号待审核，请联系管理员' })
    }

    if (user.status !== 'active') {
      return reply.code(403).send({ success: false, message: '账号已禁用' })
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return reply.code(401).send({ success: false, message: 'Invalid username or password' })
    }

    // 生成 JWT token（包含时间戳确保唯一性）
    const sessionId = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const tokenPayload = {
      id: user.id,
      username: user.username,
      sessionId
    };

    // 只有当 department_id 存在且不为 null 时才添加到 payload 中
    if (user.department_id !== null && user.department_id !== undefined) {
      tokenPayload.department_id = user.department_id;
    }

    const token = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: '1h' } // Access token有效期1小时
    )

    // 生成 Refresh Token
    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Refresh token有效期7天
    )

    // 更新最后登录时间和session_token（实现单设备登录）
    await pool.query(
      'UPDATE users SET last_login = NOW(), session_token = ?, session_created_at = NOW() WHERE id = ?',
      [token, user.id]
    )

    // 返回登录信息（不包含密码）
    const { password_hash, ...userInfo } = user

    return {
      success: true,
      message: '登录成功',
      token,
      refresh_token: refreshToken,
      expiresIn: 3600,
      user: userInfo
    }
  } catch (error) {
    console.error('登录失败:', error)
    return reply.code(500).send({ success: false, message: '登录失败' })
  }
})

// 用户退出登录
fastify.post('/api/auth/logout', async (request, reply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    // 清除数据库中的session_token
    await pool.query(
      'UPDATE users SET session_token = NULL, session_created_at = NULL WHERE id = ?',
      [decoded.id]
    )

    return {
      success: true,
      message: '退出登录成功'
    }
  } catch (error) {
    console.error('退出登录失败:', error)
    // 即使出错也返回成功，因为前端会清除本地token
    return {
      success: true,
      message: '退出登录成功'
    }
  }
})

// 刷新Token
fastify.post('/api/auth/refresh', async (request, reply) => {
  const { refresh_token } = request.body

  if (!refresh_token) {
    return reply.code(400).send({ error: 'Refresh token is required' })
  }

  try {
    // 验证refresh token
    const decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET)

    // 检查用户是否存在且状态正常
    const [users] = await pool.query(
      'SELECT id, username, status, session_token FROM users WHERE id = ?',
      [decoded.id]
    )

    if (users.length === 0 || users[0].status !== 'active') {
      return reply.code(401).send({ error: 'User not found or inactive' })
    }

    const user = users[0]

    // 生成新的access token
    const sessionId = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const tokenPayload = {
      id: user.id,
      username: user.username,
      sessionId
    };

    // 只有当 department_id 存在且不为 null 时才添加到 payload 中
    if (user.department_id !== null && user.department_id !== undefined) {
      tokenPayload.department_id = user.department_id;
    }

    const newToken = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: '1h' } // Access token有效期1小时
    )

    // 生成新的refresh token (可选，这里选择轮换)
    const newRefreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Refresh token有效期7天
    )

    // 更新session_token
    await pool.query(
      'UPDATE users SET session_token = ?, session_created_at = NOW() WHERE id = ?',
      [newToken, user.id]
    )

    return {
      token: newToken,
      refresh_token: newRefreshToken,
      expiresIn: 3600
    }
  } catch (error) {
    console.error('Token刷新失败:', error)
    return reply.code(401).send({ error: 'Invalid refresh token' })
  }
})

// 重置用户密码（管理员功能）
fastify.post('/api/users/:userId/reset-password', async (request, reply) => {
  const { userId } = request.params
  const { newPassword } = request.body

  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录' })
    }

    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET)

    // 验证新密码
    if (!newPassword || newPassword.length < 6) {
      return reply.code(400).send({ success: false, message: '密码长度至少6位' })
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // 更新密码并清除session_token（强制重新登录）
    await pool.query(
      'UPDATE users SET password_hash = ?, session_token = NULL, session_created_at = NULL WHERE id = ?',
      [passwordHash, userId]
    )

    // 记录操作日志（可选）

    return {
      success: true,
      message: '密码重置成功'
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    if (error.name === 'JsonWebTokenError') {
      return reply.code(401).send({ success: false, message: 'Token无效' })
    }
    return reply.code(500).send({ success: false, message: '重置密码失败' })
  }
})

// 验证token是否有效（用于单设备登录检查）
fastify.get('/api/auth/verify-token', async (request, reply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录', valid: false })
    }

    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return reply.code(401).send({ success: false, message: 'Token无效或已过期', valid: false })
    }

    // 检查数据库中的session_token是否匹配
    const [users] = await pool.query(
      'SELECT session_token FROM users WHERE id = ?',
      [decoded.id]
    )

    if (users.length === 0) {
      return reply.code(401).send({ success: false, message: '用户不存在', valid: false })
    }

    const user = users[0]

    // 如果数据库中的token与当前token不匹配，说明用户在其他设备登录了
    if (user.session_token !== token) {
      return reply.code(401).send({
        success: false,
        message: '您的账号已在其他设备登录',
        valid: false,
        kicked: true // 标记为被踢出
      })
    }

    return { success: true, valid: true }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return reply.code(401).send({ success: false, message: 'Token已过期', valid: false })
    }
    console.error('Token验证失败:', error)
    return reply.code(401).send({ success: false, message: 'Token无效', valid: false })
  }
})

// 获取当前用户的权限列表
fastify.get('/api/auth/permissions', async (request, reply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未登录' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    // 获取用户的角色和权限
    const [permissions] = await pool.query(`
      SELECT DISTINCT p.code, p.name, p.resource, p.action, p.module
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
    `, [decoded.id])

    // 获取用户的角色信息
    const [roles] = await pool.query(`
      SELECT r.id, r.name
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, [decoded.id])

    // 获取用户基本信息
    const [user] = await pool.query('SELECT username, department_id FROM users WHERE id = ?', [decoded.id])

    return {
      success: true,
      data: {
        permissions: permissions.map(p => p.code),
        permissionDetails: permissions,
        roles: roles,
        canViewAllDepartments: roles.some(r => r.name === '超级管理员'),
        departmentId: user[0]?.department_id
      }
    }
  } catch (error) {
    console.error('获取权限失败:', error)
    return reply.code(401).send({ success: false, message: '获取权限失败' })
  }
})

// 验证 token 校验
async function verifyToken(request, reply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ success: false, message: '未提供认证令牌' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    request.user = decoded
  } catch (error) {
    return reply.code(401).send({ success: false, message: '无效的认证令牌' })
  }
}

// ==================== 员工管理 API ====================

// 根据user_id获取员工信息
fastify.get('/api/employees/by-user/:userId', async (request, reply) => {
  const { userId } = request.params

  try {
    const [employees] = await pool.query(
      `SELECT e.*, u.real_name, u.username, u.department_id, d.name as department_name
       FROM employees e
       LEFT JOIN users u ON e.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE e.user_id = ?`,
      [userId]
    )

    if (employees.length === 0) {
      return reply.code(404).send({
        success: false,
        message: '未找到员工信息，请联系管理员添加员工档案'
      })
    }

    return {
      success: true,
      data: employees[0]
    }
  } catch (error) {
    console.error('获取员工信息失败:', error)
    return reply.code(500).send({ success: false, message: '获取员工信息失败' })
  }
})

// ==================== 客服管理 API ====================

// 获取客服人员列表
fastify.get('/api/customers', async (request, reply) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.real_name as name,
        u.email,
        u.phone,
        d.name as department,
        u.status,
        e.rating
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE d.name = '客服部' OR u.department_id IN (SELECT id FROM departments WHERE name = '客服部')
      ORDER BY u.created_at DESC
    `)
    return rows
  } catch (error) {
    reply.code(500).send({ error: '获取客服列表失败' })
  }
})

// 新增客服人员
fastify.post('/api/customers', async (request, reply) => {
  const { name, email, phone, department, status, rating } = request.body

  try {
    // 获取部门ID
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [department])
    const departmentId = deptRows[0]?.id || 6 // 默认客服部ID为6

    // 生成用户名
    const username = `CS${Date.now()}`
    const passwordHash = '$2b$12$KIXxLQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNqYq' // 默认密码: 123456

    // 创建用户
    const [userResult] = await pool.query(
      'INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, name, email, phone, departmentId, status]
    )

    // 创建员工信息
    const employeeNo = `E${String(userResult.insertId).padStart(3, '0')}`
    await pool.query(
      'INSERT INTO employees (user_id, employee_no, position, hire_date, rating, status) VALUES (?, ?, ?, NOW(), ?, ?)',
      [userResult.insertId, employeeNo, '客服专员', rating, status]
    )

    return { success: true, id: userResult.insertId }
  } catch (error) {
    console.error(error)
    reply.code(500).send({ error: '新增客服失败' })
  }
})

// 更新客服人员
fastify.put('/api/customers/:id', async (request, reply) => {
  const { id } = request.params
  const { name, email, phone, department, status, rating } = request.body

  try {
    // 获取部门ID
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [department])
    const departmentId = deptRows[0]?.id || 6

    // 更新用户信息
    await pool.query(
      'UPDATE users SET real_name = ?, email = ?, phone = ?, department_id = ?, status = ? WHERE id = ?',
      [name, email, phone, departmentId, status, id]
    )

    // 更新员工信息
    await pool.query(
      'UPDATE employees SET rating = ?, status = ? WHERE user_id = ?',
      [rating, status, id]
    )

    return { success: true }
  } catch (error) {
    console.error(error)
    reply.code(500).send({ error: '更新客服失败' })
  }
})

// 删除客服人员
fastify.delete('/api/customers/:id', async (request, reply) => {
  const { id } = request.params

  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id])
    return { success: true }
  } catch (error) {
    console.error(error)
    reply.code(500).send({ error: '删除客服失败' })
  }
})

// 获取会话列表
fastify.get('/api/sessions', async (request, reply) => {
  try {
    // 模拟会话数据（实际应连接 quality_sessions 表）
    const sessions = [
      { id: 1, customer: '客户A', agent: '客服', startTime: '2024-11-09 09:00', duration: '15分钟', status: 'completed', satisfaction: 5 },
      { id: 2, customer: '客户B', agent: '客服', startTime: '2024-11-09 10:30', duration: '8分钟', status: 'completed', satisfaction: 4 },
      { id: 3, customer: '客户C', agent: '客服', startTime: '2024-11-09 11:15', duration: '正在通话', status: 'active', satisfaction: null }
    ];
    return sessions;
  } catch (error) {
    reply.code(500).send({ error: '获取会话列表失败' });
  }
})

// 获取质检记录
fastify.get('/api/quality-inspections', async (request, reply) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        qs.id,
        qs.session_id as sessionId,
        u.real_name as agent,
        qs.inspector_name as inspector,
        qs.total_score as score,
        qs.status,
        DATE_FORMAT(qs.created_at, '%Y-%m-%d') as date
      FROM quality_sessions qs
      LEFT JOIN users u ON qs.agent_id = u.id
      ORDER BY qs.created_at DESC
      LIMIT 50
    `);
    return rows;
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '获取质检列表失败' });
  }
});

// 提交质检
fastify.post('/api/quality-inspections', async (request, reply) => {
  const { sessionId, scores, comment } = request.body;

  try {
    const totalScore = Math.round(
      scores.attitude * 0.3 +
      scores.professional * 0.3 +
      scores.communication * 0.2 +
      scores.compliance * 0.2
    );

    await pool.query(
      'UPDATE quality_sessions SET status = ?, total_score = ?, inspector_name = ?, comments = ? WHERE id = ?',
      ['completed', totalScore, '前台人员', comment, sessionId]
    );

    return { success: true, score: totalScore };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '提交质检失败' });
  }
})

// ==================== 部门管理 API ====================
// 获取部门列表
fastify.get('/api/departments', async (request, reply) => {
  try {
    const { includeDeleted, forManagement } = request.query;
    const { extractUserPermissions } = require('./middleware/checkPermission');

    // 获取用户权限
    const permissions = await extractUserPermissions(request, pool);

    let query = 'SELECT * FROM departments WHERE 1=1';
    const params = [];

    // 默认不显示已删除的部门
    if (includeDeleted !== 'true') {
      query += ' AND status != "deleted"';
    }

    // 如果是用于管理目的（如配置角色部门权限），则返回所有部门
    // 否则应用正常的权限控制
    if (forManagement !== 'true') {
      // 不管是不是超级管理员，都根据JWT中的部门来显示
      // 使用部门权限逻辑：能看到的部门只和配置有关，和身份无关
      if (!permissions) {
        // 没有权限信息（未登录或无角色），不显示任何部门
        query += ' AND 1=0';
      } else if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        // 有配置部门权限，只显示配置的部门
        const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
        query += ` AND id IN (${placeholders})`;
        params.push(...permissions.viewableDepartmentIds);
      } else if (permissions.departmentId) {
        // 如果没有配置部门权限，但有所在部门，则显示自己的部门
        query += ' AND id = ?';
        params.push(permissions.departmentId);
      } else {
        // 没有配置部门权限，也没有所在部门，不显示任何部门
        query += ' AND 1=0';
      }
    }
    // 如果 permissions.canViewAllDepartments 为 true，则不添加任何过滤条件

    query += ' ORDER BY sort_order, created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('获取部门列表失败:', error);
    reply.code(500).send({ error: '获取部门列表失败' });
  }
})

// 创建部门
fastify.post('/api/departments', async (request, reply) => {
  const { name, description, status } = request.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO departments (name, description, status) VALUES (?, ?, ?)',
      [name, description, status]
    );
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '创建部门失败' });
  }
});

// 更新部门
fastify.put('/api/departments/:id', async (request, reply) => {
  const { id } = request.params;
  const { name, description, status } = request.body;
  try {
    // 获取原部门状态
    const [oldDept] = await pool.query('SELECT status FROM departments WHERE id = ?', [id]);
    const oldStatus = oldDept[0]?.status;

    // 更新部门信息
    await pool.query(
      'UPDATE departments SET name = ?, description = ?, status = ? WHERE id = ?',
      [name, description, status, id]
    );

    // 根据状态变更同步更新该部门下所有员工状态
    if (oldStatus && oldStatus !== status) {
      // 获取该部门下的所有员工
      const [employees] = await pool.query(`
        SELECT e.id, e.user_id
        FROM employees e


        LEFT JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ?
      `, [id]);

      // 更新所有员工状态
      if (employees.length > 0) {
        const employeeStatus = status === 'active' ? 'active' : 'inactive';
        await pool.query(`
          UPDATE employees
          SET status = ?
          WHERE id IN (${employees.map(() => '?').join(',')})
        `, [employeeStatus, ...employees.map(e => e.id)]);
      }
    }

    return {
      success: true,
      affectedEmployees: oldStatus !== status ? (await pool.query(`
        SELECT COUNT(*) as count
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ?
      `, [id]))[0][0].count : 0
    };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '更新部门失败' });
  }
});

// 删除部门（软删除）
fastify.delete('/api/departments/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    // 将部门状态设置为 deleted
    await pool.query('UPDATE departments SET status = ? WHERE id = ?', ['deleted', id]);

    // 同时将该部门下的所有员工状态设置为 deleted
    await pool.query(`
      UPDATE employees e
      LEFT JOIN users u ON e.user_id = u.id
      SET e.status = 'deleted'
      WHERE u.department_id = ?
    `, [id]);

    return { success: true, message: '部门删除成功' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '删除部门失败' });
  }
});

// 恢复部门
fastify.post('/api/departments/:id/restore', async (request, reply) => {
  const { id } = request.params;
  try {
    // 恢复部门状态为 active
    await pool.query('UPDATE departments SET status = ? WHERE id = ?', ['active', id]);

    // 同时恢复该部门下的所有员工状态为 active
    await pool.query(`
      UPDATE employees e
      LEFT JOIN users u ON e.user_id = u.id
      SET e.status = 'active'
      WHERE u.department_id = ? AND e.status = 'deleted'
    `, [id]);

    return { success: true, message: '部门恢复成功' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '恢复部门失败' });
  }
});

// ==================== 职位管理 API ====================
// 职位管理路由已移至 server/routes/positions.js

// ==================== 员工管理 API ====================

// 获取员工列表
fastify.get('/api/employees', async (request, reply) => {
  try {
    const { includeDeleted } = request.query;
    const { extractUserPermissions, applyDepartmentFilter } = require('./middleware/checkPermission');

    // 获取用户权限
    const permissions = await extractUserPermissions(request, pool);

    let query = `
      SELECT
        e.id,
        e.employee_no,
        e.position,
        e.hire_date,
        e.rating,
        e.status,
        e.emergency_contact,
        e.emergency_phone,
        e.address,
        e.education,
        e.skills,
        e.remark,
        u.id as user_id,
        u.username,
        u.real_name,
        u.email,
        u.phone,
        u.avatar,
        u.department_id,
        d.name as department_name
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;

    const params = [];

    // 默认不显示已删除的员工
    if (includeDeleted !== 'true') {
      query += ' AND e.status != "deleted"';
    }

    // 应用部门权限过滤
    const filtered = applyDepartmentFilter(permissions, query, params, 'u.department_id');
    query = filtered.query;
    const finalParams = filtered.params;

    query += ' ORDER BY e.created_at DESC';

    const [rows] = await pool.query(query, finalParams);
    return rows;
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '获取员工列表失败' });
  }
});

// 创建员工
fastify.post('/api/employees', async (request, reply) => {
  const { employee_no, real_name, email, phone, department_id, position, hire_date, rating, status } = request.body;
  try {
    const passwordHash = '$2b$12$KIXxLQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNqYq'; // 默认密码: 123456

    let finalEmployeeNo = employee_no;

    // 如果没有提供工号，自动生成
    if (!finalEmployeeNo) {
      const [maxEmpRows] = await pool.query('SELECT employee_no FROM employees WHERE employee_no REGEXP "^EMP[0-9]+$" ORDER BY LENGTH(employee_no) DESC, employee_no DESC LIMIT 1');

      if (maxEmpRows.length > 0) {
        // 提取数字部分并加1
        const currentMax = maxEmpRows[0].employee_no;
        const numPart = parseInt(currentMax.replace(/\D/g, ''));
        finalEmployeeNo = `EMP${String(numPart + 1).padStart(4, '0')}`;
      } else {
        // 如果没有符合格式的工号，从 EMP0001 开始
        finalEmployeeNo = 'EMP0001';
      }
      console.log(`自动生成工号: ${finalEmployeeNo}`);
    }

    // 确保员工编号作为用户名使用
    const username = finalEmployeeNo;

    // 处理日期格式：确保只保存日期部分（YYYY-MM-DD）
    let formattedHireDate = null;
    if (hire_date) {
      // 如果是ISO格式或包含时间，提取日期部分
      formattedHireDate = hire_date.split('T')[0];
    } else {
      // 如果没有提供日期，使用当前日期
      formattedHireDate = new Date().toISOString().split('T')[0];
    }

    // 创建用户
    const [userResult] = await pool.query(
      'INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, real_name, email || null, phone || null, department_id || null, 'active']
    );

    // 创建员工信息
    const [employeeResult] = await pool.query(
      'INSERT INTO employees (user_id, employee_no, position, hire_date, rating, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userResult.insertId, finalEmployeeNo, position || null, formattedHireDate, rating || 3, status]
    );

    // 自动创建员工变动记录（入职记录）
    try {
      await pool.query(
        `INSERT INTO employee_changes
        (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position, new_position, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employeeResult.insertId,
          userResult.insertId,
          'hire',
          formattedHireDate,
          null,
          department_id || null,
          null,
          position || null,
          '新员工入职'
        ]
      );
    } catch (changeError) {
      console.error('⚠️ 创建员工变动记录失败:', changeError);
      // 不影响员工创建，只记录错误
    }

    return { success: true, id: userResult.insertId };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '创建员工失败' });
  }
});

// 更新员工
fastify.put('/api/employees/:id', async (request, reply) => {
  const { id } = request.params;
  const {
    employee_no, real_name, email, phone, department_id, position,
    hire_date, rating, status, avatar, emergency_contact, emergency_phone,
    address, education, skills, remark
  } = request.body;

  try {
    // 获取员工的user_id
    const [empRows] = await pool.query('SELECT user_id FROM employees WHERE id = ?', [id]);
    if (empRows.length === 0) {
      return reply.code(404).send({ error: '员工不存在' });
    }
    const userId = empRows[0].user_id;

    // 处理日期格式：确保只保存日期部分（YYYY-MM-DD）
    let formattedHireDate = null;
    if (hire_date) {
      // 如果是ISO格式或包含时间，提取日期部分
      formattedHireDate = hire_date.split('T')[0];
    }

    // 更新用户信息
    await pool.query(
      'UPDATE users SET real_name = ?, email = ?, phone = ?, department_id = ?, avatar = ? WHERE id = ?',
      [real_name, email || null, phone || null, department_id || null, avatar || null, userId]
    );

    // 更新员工信息
    await pool.query(
      `UPDATE employees SET
        employee_no = ?,
        position = ?,
        hire_date = ?,
        rating = ?,
        status = ?,
        emergency_contact = ?,
        emergency_phone = ?,
        address = ?,
        education = ?,
        skills = ?,
        remark = ?
      WHERE id = ?`,
      [
        employee_no,
        position || null,
        formattedHireDate,
        rating || 3,
        status,
        emergency_contact || null,
        emergency_phone || null,
        address || null,
        education || null,
        skills || null,
        remark || null,
        id
      ]
    );

    return { success: true };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '更新员工失败' });
  }
});

// 删除员工（软删除）
fastify.delete('/api/employees/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    // 将员工状态设置为 deleted
    await pool.query('UPDATE employees SET status = ? WHERE id = ?', ['deleted', id]);
    return { success: true, message: '员工删除成功' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '删除员工失败' });
  }
});

// 恢复员工
fastify.post('/api/employees/:id/restore', async (request, reply) => {
  const { id } = request.params;
  try {
    // 恢复员工状态为 active
    await pool.query('UPDATE employees SET status = ? WHERE id = ?', ['active', id]);
    return { success: true, message: '员工恢复成功' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: '恢复员工失败' });
  }
});

// 批量导入员工
fastify.post('/api/employees/batch-import', async (request, reply) => {
  const { employees } = request.body;

  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    return reply.code(400).send({
      success: false,
      message: '请提供员工数据'
    });
  }

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const emp of employees) {
    try {
      // 验证必填字段
      if (!emp.employee_no || !emp.real_name || !emp.username || !emp.password || !emp.department_id || !emp.hire_date) {
        errors.push(`${emp.employee_no || '未知'}: 缺少必填字段`);
        failCount++;
        continue;
      }

      // 检查工号是否已存在
      const [existingEmp] = await pool.query(
        'SELECT id FROM employees WHERE employee_no = ?',
        [emp.employee_no]
      );

      if (existingEmp.length > 0) {
        errors.push(`${emp.employee_no}: 工号已存在`);
        failCount++;
        continue;
      }

      // 检查用户名是否已存在
      const [existingUser] = await pool.query(
        'SELECT id FROM users WHERE username = ?',
        [emp.username]
      );

      if (existingUser.length > 0) {
        errors.push(`${emp.username}: 用户名已存在`);
        failCount++;
        continue;
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(emp.password, 10);

      // 处理日期格式：确保只保存日期部分（YYYY-MM-DD）
      const formattedHireDate = emp.hire_date.split('T')[0];

      // 创建用户
      const [userResult] = await pool.query(
        `INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          emp.username,
          hashedPassword,
          emp.real_name,
          emp.email,
          emp.phone,
          emp.department_id,
          emp.status || 'active'
        ]
      );

      const userId = userResult.insertId;

      // 创建员工记录
      const [employeeResult] = await pool.query(
        `INSERT INTO employees
         (user_id, employee_no, position, hire_date, rating, status,
          emergency_contact, emergency_phone, address, education, skills, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          emp.employee_no,
          emp.position,
          formattedHireDate,
          emp.rating || 3,
          emp.status || 'active',
          emp.emergency_contact,
          emp.emergency_phone,
          emp.address,
          emp.education,
          emp.skills,
          emp.remark
        ]
      );

      // 自动创建员工变动记录（入职记录）
      try {
        await pool.query(
          `INSERT INTO employee_changes
          (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position, new_position, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeResult.insertId,
            userId,
            'hire',
            formattedHireDate,
            null,
            emp.department_id || null,
            null,
            emp.position || null,
            '批量导入入职'
          ]
        );
      } catch (changeError) {
        console.error(`⚠️ 创建员工变动记录失败 (${emp.employee_no}):`, changeError);
        // 不影响员工创建，只记录错误
      }

      successCount++;
    } catch (error) {
      console.error(`导入员工失败 (${emp.employee_no}):`, error);
      errors.push(`${emp.employee_no}: ${error.message}`);
      failCount++;
    }
  }

  return {
    success: true,
    message: `导入完成：成功 ${successCount} 名，失败 ${failCount} 名`,
    successCount,
    failCount,
    errors: errors.slice(0, 10) // 只返回前10个错误
  };
});

// ==================== 员工审批 API ====================

// 获取待审批的用户列表
fastify.get('/api/users-pending', async (request, reply) => {
  try {
    // 获取用户权限
    const permissions = await extractUserPermissions(request, pool);

    let query = `
      SELECT
        u.id,
        u.username,
        u.real_name,
        u.email,
        u.phone,
        u.department_id,
        u.created_at,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.status = 'pending'
    `;

    let params = [];

    // 应用部门权限过滤
    const filtered = applyDepartmentFilter(permissions, query, params, 'u.department_id');
    query = filtered.query;
    params = filtered.params;

    query += ' ORDER BY u.created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to fetch pending users' });
  }
});

// 批准用户
fastify.post('/api/users/:id/approve', async (request, reply) => {
  const { id } = request.params;
  const { note } = request.body;

  try {
    // 获取用户信息
    const [users] = await pool.query(
      'SELECT username, real_name, department_id FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const user = users[0];

    // 更新用户状态为active
    await pool.query(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      ['active', id]
    );

    // 检查是否已有员工记录
    const [existingEmployee] = await pool.query(
      'SELECT id FROM employees WHERE user_id = ?',
      [id]
    );

    if (existingEmployee.length === 0) {
      // 如果没有员工记录，创建一个
      const employeeNo = `E${String(id).padStart(3, '0')}`;
      const hireDate = new Date().toISOString().split('T')[0];

      const [employeeResult] = await pool.query(
        'INSERT INTO employees (user_id, employee_no, hire_date, rating, status) VALUES (?, ?, ?, ?, ?)',
        [id, employeeNo, hireDate, 3, 'active']
      );

      // 自动创建员工变动记录（入职记录）
      try {
        await pool.query(
          `INSERT INTO employee_changes
          (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeResult.insertId,
            id,
            'hire',
            hireDate,
            null,
            user.department_id || null,
            note || '注册审核通过入职'
          ]
        );
      } catch (changeError) {
        console.error('⚠️ 创建员工变动记录失败:', changeError);
        // 不影响审核通过，只记录错误
      }
    }

    // 记录审批日志
    // await pool.query(
    //   'INSERT INTO approval_logs (user_id, action, note, created_at) VALUES (?, ?, ?, NOW())',
    //   [id, 'approve', note]
    // );

    return { success: true, message: 'Approved successfully' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Approval failed' });
  }
});

// 拒绝用户
fastify.post('/api/users/:id/reject', async (request, reply) => {
  const { id } = request.params;
  const { note } = request.body;

  try {
    await pool.query(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      ['inactive', id]
    );

    // 记录审批日志
    // await pool.query(
    //   'INSERT INTO approval_logs (user_id, action, note, created_at) VALUES (?, ?, ?, NOW())',
    //   [id, 'reject', note]
    // );

    return { success: true, message: 'Rejected successfully' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Rejection failed' });
  }
});

// ==================== 员工变动记录 API ====================

// 获取员工变动记录
fastify.get('/api/employee-changes', async (request, reply) => {
  const { type } = request.query;

  try {
    // 获取用户权限
    const permissions = await extractUserPermissions(request, pool);

    let query = `
      SELECT
        ec.*,
        u.username,
        u.real_name as real_name,
        e.employee_no,
        d1.name as old_department_name,
        d2.name as new_department_name
      FROM employee_changes ec
      LEFT JOIN users u ON ec.user_id = u.id
      LEFT JOIN employees e ON ec.employee_id = e.id
      LEFT JOIN departments d1 ON ec.old_department_id = d1.id
      LEFT JOIN departments d2 ON ec.new_department_id = d2.id
      WHERE 1=1
    `;

    let params = [];

    // 应用部门权限过滤（检查新旧部门）
    if (!permissions || !permissions.canViewAllDepartments) {
      if (permissions && permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
        query += ` AND (ec.old_department_id IN (${placeholders}) OR ec.new_department_id IN (${placeholders}))`;
        params.push(...permissions.viewableDepartmentIds, ...permissions.viewableDepartmentIds);
      } else {
        query += ` AND 1=0`;
      }
    }

    if (type && type !== 'all') {
      query += ' AND ec.change_type = ?';
      params.push(type);
    }

    query += ' ORDER BY ec.change_date DESC, ec.created_at DESC';

    const [rows] = await pool.query(query, params);

    return rows;
  } catch (error) {
    console.error('获取员工变动记录失败:', error);
    return reply.code(500).send({ error: '获取员工变动记录失败' });
  }
});

// 获取员工的变动历�?
fastify.get('/api/employee-changes/:employeeId', async (request, reply) => {
  const { employeeId } = request.params;
  try {
    const [rows] = await pool.query(`
      SELECT
        ec.*,
        d1.name as old_department_name,
        d2.name as new_department_name
      FROM employee_changes ec
      LEFT JOIN departments d1 ON ec.old_department_id = d1.id
      LEFT JOIN departments d2 ON ec.new_department_id = d2.id
      WHERE ec.employee_id = ?
      ORDER BY ec.change_date DESC, ec.created_at DESC
    `, [employeeId]);
    return rows;
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to fetch employee change history' });
  }
});

// 创建员工变动记录
fastify.post('/api/employee-changes/create', async (request, reply) => {
  const {
    employee_id,
    user_id,
    change_type,
    change_date,
    old_department_id,
    new_department_id,
    old_position,
    new_position,
    reason
  } = request.body;

  try {
    // 验证必填字段
    if (!employee_id || !user_id || !change_type || !change_date) {
      console.error('缺少必填字段:', { employee_id, user_id, change_type, change_date });
      return reply.code(400).send({
        error: '缺少必填字段',
        details: {
          employee_id: !employee_id ? '缺少' : '正常',
          user_id: !user_id ? '缺少' : '正常',
          change_type: !change_type ? '缺少' : '正常',
          change_date: !change_date ? '缺少' : '正常'
        }
      });
    }

    // 处理日期格式
    const formattedChangeDate = change_date.split('T')[0];

    const [result] = await pool.query(
      `INSERT INTO employee_changes
      (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position, new_position, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee_id,
        user_id,
        change_type,
        formattedChangeDate,
        old_department_id || null,
        new_department_id || null,
        old_position || null,
        new_position || null,
        reason || null
      ]
    );
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('创建员工变动记录失败:', error);
    reply.code(500).send({
      error: '创建员工变动记录失败',
      message: error.message,
      sqlMessage: error.sqlMessage
    });
  }
});

// 保持在文件末尾调�?start()

// ==================== 知识库管�?API ====================

// 获取知识库分类列�?
fastify.get('/api/knowledge/categories', async (request, reply) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM knowledge_categories
      WHERE is_deleted = 0 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    return rows;
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to fetch knowledge categories' });
  }
});

// 创建知识库分类
fastify.post('/api/knowledge/categories', async (request, reply) => {
  const { name, description, icon, owner_id, type, is_public } = request.body;
  try {
    if (!name) {
      return reply.code(400).send({ error: 'Category name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO knowledge_categories (name, description, icon, owner_id, type, is_public) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, icon || '📁', owner_id || null, type || 'common', is_public !== undefined ? is_public : 1]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Failed to create knowledge category:', error);
    reply.code(500).send({ error: 'Failed to create knowledge category: ' + error.message });
  }
})


// 更新知识库分�?
fastify.put('/api/knowledge/categories/:id', async (request, reply) => {
  const { id } = request.params;
  const { name, description, icon, is_hidden, is_published, is_public } = request.body;
  try {
    // 构建更新语句
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon || '📁');
    }
    if (is_hidden !== undefined) {
      updates.push('is_hidden = ?');
      values.push(is_hidden ? 1 : 0);
    }
    if (is_published !== undefined) {
      updates.push('is_published = ?');
      values.push(is_published ? 1 : 0);
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: 'No updates provided' });
    }

    values.push(id);
    await pool.query(
      `UPDATE knowledge_categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return { success: true };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to update knowledge category' });
  }
});

// 删除知识库分�?
fastify.delete('/api/knowledge/categories/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    // 将关联的文章�?category_id 设置�?NULL
    await pool.query(
      'UPDATE knowledge_articles SET category_id = NULL WHERE category_id = ?',
      [id]
    );

    // 删除分类
    await pool.query('DELETE FROM knowledge_categories WHERE id = ?', [id]);

    return { success: true };
  } catch (error) {
    console.error('Failed to delete knowledge category:', error);
    reply.code(500).send({ error: 'Failed to delete knowledge category' });
  }
});

// 切换分类显示隐藏状态（同时更新该分类下所有文档状态）
fastify.post('/api/knowledge/categories/:id/toggle-visibility', async (request, reply) => {
  const { id } = request.params;
  const { is_hidden } = request.body;

  try {
    // 开始事�?
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 更新分类的隐藏状�?
      await connection.query(
        'UPDATE knowledge_categories SET is_hidden = ? WHERE id = ?',
        [is_hidden ? 1 : 0, id]
      );

      // 2. 根据隐藏状态更新该分类下所有文档状态为 deleted
      // 显示(is_hidden=0) -> 文档状态改�?published
      // 隐藏(is_hidden=1) -> 文档状态改�?archived
      const newArticleStatus = is_hidden ? 'archived' : 'published';
      const [result] = await connection.query(
        'UPDATE knowledge_articles SET status = ? WHERE category_id = ?',
        [newArticleStatus, id]
      );

      // 提交事务
      await connection.commit();
      connection.release();

      return {
        success: true,
        affectedArticles: result.affectedRows,
        message: is_hidden
          ? `已隐藏分类，${result.affectedRows} 篇文档已归档`
          : `已显示分类，${result.affectedRows} 篇文档已发布`
      };
    } catch (error) {
      // 回滚事务
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('切换分类可见性失�?', error);
    reply.code(500).send({ error: 'Failed to toggle category visibility: ' + error.message });
  }
});



// 创建知识文章
fastify.post('/api/knowledge/articles', async (request, reply) => {
  // 检查数据库连接
  if (!pool) {
    console.error('❌ 数据库未连接,无法创建知识文章');
    return reply.code(500).send({
      error: 'Database connection failed',
      message: '请检查数据库配置并确保数据库服务正在运行'
    });
  }

  const { title, category_id, summary, content, type, status, icon, attachments, is_public, owner_id } = request.body;
  try {
    const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;

    const [result] = await pool.query(
      `INSERT INTO knowledge_articles
      (title, category_id, summary, content, attachments, type, status, icon, is_public, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, category_id || null, summary || null, content || '', attachmentsJson, type || 'common', status || 'published', icon || '📄', is_public !== undefined ? is_public : 1, owner_id || null, request.user?.id || null]
    );
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('创建知识文章失败:', error);
    console.error('SQL状态:', error.sqlState);
    console.error('SQL信息:', error.sqlMessage);
    reply.code(500).send({
      error: 'Failed to create knowledge article',
      message: error.message,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  }
});

// 获取知识文章列表
fastify.get('/api/knowledge/articles', async (request, reply) => {
  try {
    const { type, category_id, owner_id, is_public } = request.query;

    let query = `
      SELECT * FROM knowledge_articles
      WHERE is_deleted = 0 AND deleted_at IS NULL
    `;
    const params = [];

    // 根据类型过滤
    if (type && type !== 'all') {
      query += ' AND type = ?';
      params.push(type);
    }

    // 根据分类过滤
    if (category_id) {
      query += ' AND category_id = ?';
      params.push(category_id);
    }

    // 根据所有者过滤
    if (owner_id) {
      query += ' AND owner_id = ?';
      params.push(owner_id);
    }

    // 根据公开状态过滤
    if (is_public !== undefined) {
      query += ' AND is_public = ?';
      params.push(is_public);
    }

    // 只返回已发布的文章
    query += ' AND status = ?';
    params.push('published');

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('获取知识文章列表失败:', error);
    reply.code(500).send({ error: 'Failed to fetch knowledge articles' });
  }
});

// 获取单篇知识文章
fastify.get('/api/knowledge/articles/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM knowledge_articles
       WHERE id = ? AND is_deleted = 0 AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Article not found' });
    }

    return rows[0];
  } catch (error) {
    console.error('获取知识文章失败:', error);
    reply.code(500).send({ error: 'Failed to fetch knowledge article' });
  }
});

// 更新知识文章
fastify.put('/api/knowledge/articles/:id', async (request, reply) => {
  const { id } = request.params;
  const { title, category_id, summary, content, type, status, icon, attachments, is_public } = request.body;
  try {
    // 验证必要字段
    if (!title || title.trim() === '') {
      console.error('× title 字段为空');
      return reply.code(400).send({ error: 'Title is required' });
    }

    // content 可以为空,因为文档可能只有附件
    // 如果 content 未定义,设置为空字符串
    const finalContent = content !== undefined && content !== null ? content : '';

    // 处理附件数据
    let attachmentsJson = null;
    if (attachments) {
      if (Array.isArray(attachments)) {
        attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : null;
      } else if (typeof attachments === 'string') {
        attachmentsJson = attachments;
      } else {
        console.warn('attachments 类型不正确', typeof attachments, attachments);
        attachmentsJson = JSON.stringify(attachments);
      }
    }

    const result = await pool.query(
      `UPDATE knowledge_articles SET
        title = ?,
        category_id = ?,
        summary = ?,
        content = ?,
        attachments = ?,
        type = ?,
        status = ?,
        icon = ?,
        is_public = ?,
        updated_by = ?
      WHERE id = ?`,
      [title, category_id || null, summary || null, finalContent, attachmentsJson, type, status, icon || '📄', is_public !== undefined ? is_public : null, request.user?.id || null, id]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to update knowledge article:', error);
    console.error('Failed to update knowledge article:', error.message);
    console.error('SQL状态', error.sqlState);
    console.error('SQL信息:', error.sqlMessage);
    reply.code(500).send({ error: 'Failed to update knowledge article: ' + error.message });
  }
});

// 删除知识文章
fastify.delete('/api/knowledge/articles/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    await pool.query('DELETE FROM knowledge_articles WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to delete knowledge article' });
  }
});

// ==================== 回收�?API ====================

// 软删除分�?
fastify.post('/api/knowledge/categories/:id/soft-delete', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.id || null;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 检查分类是否存�?
      const [categories] = await connection.query(
        'SELECT id FROM knowledge_categories WHERE id = ?',
        [id]
      );

      if (categories.length === 0) {
        await connection.rollback();
        connection.release();
        return reply.code(404).send({ error: 'Category not found' });
      }

      // 2. 更新分类的隐藏状�?
      await connection.query(
        `UPDATE knowledge_categories
         SET deleted_at = NOW(), deleted_by = ?
         WHERE id = ?`,
        [userId, id]
      );

      // 3. 根据隐藏状态更新该分类下所有文档状态为 deleted
      const [result] = await connection.query(
        `UPDATE knowledge_articles
         SET status = 'deleted', deleted_at = NOW(), deleted_by = ?
         WHERE category_id = ? AND status != 'deleted'`,
        [userId, id]
      );

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: 'Category soft deleted',
        deletedArticles: result.affectedRows
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('软删除分类失败:', error);
    reply.code(500).send({ error: 'Failed to soft delete category: ' + error.message });
  }
});

// 软删除文档
fastify.post('/api/knowledge/articles/:id/soft-delete', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.id || null;

  try {
    // 检查文档是否存�?
    const [articles] = await pool.query(
      'SELECT id FROM knowledge_articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return reply.code(404).send({ error: 'Article not found' });
    }

    await pool.query(
      `UPDATE knowledge_articles
       SET status = 'deleted', deleted_at = NOW(), deleted_by = ?
       WHERE id = ?`,
      [userId, id]
    );

    return {
      success: true,
      message: 'Article soft deleted'
    };
  } catch (error) {
    console.error('软删除文档失败:', error);
    reply.code(500).send({ error: 'Failed to soft delete article: ' + error.message });
  }
});

// 获取回收站中的分类
fastify.get('/api/knowledge/recycle-bin/categories', async (request, reply) => {
  const { userId } = request.query;

  try {
    const [categories] = await pool.query(
      `SELECT * FROM knowledge_categories
       WHERE deleted_at IS NOT NULL
       ${userId ? 'AND deleted_by = ?' : ''}
       ORDER BY deleted_at DESC`,
      userId ? [userId] : []
    );

    return categories || [];
  } catch (error) {
    console.error('获取回收站分类失败:', error);
    reply.code(500).send({ error: 'Failed to fetch deleted categories: ' + error.message });
  }
});

// 获取回收站中的文档
fastify.get('/api/knowledge/recycle-bin/articles', async (request, reply) => {
  const { userId } = request.query;

  try {
    const [articles] = await pool.query(
      `SELECT a.*, c.name as category_name
       FROM knowledge_articles a
       LEFT JOIN knowledge_categories c ON a.category_id = c.id
       WHERE a.status = 'deleted' AND a.deleted_at IS NOT NULL
       ${userId ? 'AND a.deleted_by = ?' : ''}
       ORDER BY a.deleted_at DESC`,
      userId ? [userId] : []
    );

    return articles || [];
  } catch (error) {
    console.error('获取回收站文档失败:', error);
    reply.code(500).send({ error: 'Failed to fetch deleted articles: ' + error.message });
  }
});

fastify.post('/api/knowledge/recycle-bin/categories/:id/restore', async (request, reply) => {
  const { id } = request.params;
  const { restoreArticles } = request.body;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 恢复分类
      await connection.query(
        `UPDATE knowledge_categories
         SET deleted_at = NULL, deleted_by = NULL
         WHERE id = ?`,
        [id]
      );

      let restoredArticles = 0;
      // 2. 可选：恢复该分类下的文�?
      if (restoreArticles) {
        const [result] = await connection.query(
          `UPDATE knowledge_articles
           SET status = 'published', deleted_at = NULL, deleted_by = NULL
           WHERE category_id = ? AND status = 'deleted'`,
          [id]
        );
        restoredArticles = result.affectedRows;
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: 'Category restored',
        restoredArticles
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('恢复分类失败:', error);
    reply.code(500).send({ error: 'Failed to restore category: ' + error.message });
  }
});

// 恢复文档
fastify.post('/api/knowledge/recycle-bin/articles/:id/restore', async (request, reply) => {
  const { id } = request.params;

  try {
    await pool.query(
      `UPDATE knowledge_articles
       SET status = 'published', deleted_at = NULL, deleted_by = NULL
       WHERE id = ?`,
      [id]
    );

    return {
      success: true,
      message: 'Article restored'
    };
  } catch (error) {
    console.error('恢复文档失败:', error);
    reply.code(500).send({ error: 'Failed to restore article: ' + error.message });
  }
});



// 永久删除分类
fastify.delete('/api/knowledge/recycle-bin/categories/:id/permanent', async (request, reply) => {
  const { id } = request.params;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 永久删除该分类下的所有文�?
      const [result] = await connection.query(
        'DELETE FROM knowledge_articles WHERE category_id = ? AND status = \'deleted\'',
        [id]
      );

      // 2. 永久删除分类
      await connection.query(
        'DELETE FROM knowledge_categories WHERE id = ?',
        [id]
      );

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: 'Category permanently deleted',
        deletedArticles: result.affectedRows
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('永久删除分类失败:', error);
    reply.code(500).send({ error: 'Failed to permanently delete category: ' + error.message });
  }
});

// 永久删除文档
fastify.delete('/api/knowledge/recycle-bin/articles/:id/permanent', async (request, reply) => {
  const { id } = request.params;

  try {
    await pool.query(
      'DELETE FROM knowledge_articles WHERE id = ? AND status = \'deleted\'',
      [id]
    );

    return {
      success: true,
      message: 'Article permanently deleted'
    };
  } catch (error) {
    console.error('永久删除文档失败:', error);
    reply.code(500).send({ error: 'Failed to permanently delete article: ' + error.message });
  }
});

// 清空回收站
fastify.post('/api/knowledge/recycle-bin/empty', async (request, reply) => {
  const { type } = request.body; // 'all', 'categories', 'articles'

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let deletedCategories = 0;
      let deletedArticles = 0;

      if (type === 'all' || type === 'articles') {
        // 删除所有已删除的文档
        const [articleResult] = await connection.query(
          'DELETE FROM knowledge_articles WHERE status = \'deleted\''
        );
        deletedArticles = articleResult.affectedRows;
      }

      if (type === 'all' || type === 'categories') {
        // 删除所有已删除的分类
        const [categoryResult] = await connection.query(
          'DELETE FROM knowledge_categories WHERE deleted_at IS NOT NULL'
        );
        deletedCategories = categoryResult.affectedRows;
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: 'Recycle bin emptied',
        deletedCategories,
        deletedArticles
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('清空回收站失败', error);
    reply.code(500).send({ error: 'Failed to empty recycle bin: ' + error.message });
  }
});


// ==================== 我的知识库 API ====================

// 获取我的知识库分类列表
fastify.get('/api/my-knowledge/categories', async (request, reply) => {
  try {
    const userId = request.user?.id || request.query.userId;

    const [rows] = await pool.query(`
      SELECT * FROM knowledge_categories
      WHERE owner_id = ? AND is_deleted = 0 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [userId]);

    return rows;
  } catch (error) {
    console.error('获取我的知识库分类失败:', error);
    reply.code(500).send({ error: 'Failed to fetch my knowledge categories' });
  }
});

// 创建我的知识库分类
fastify.post('/api/my-knowledge/categories', async (request, reply) => {
  const { name, description, icon } = request.body;
  const userId = request.user?.id || request.body.owner_id;

  try {
    if (!name) {
      return reply.code(400).send({ error: 'Category name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO knowledge_categories (name, description, icon, owner_id, type, is_public) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, icon || '📁', userId, 'personal', 0]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('创建我的知识库分类失败:', error);
    reply.code(500).send({ error: 'Failed to create my knowledge category: ' + error.message });
  }
});

// 获取我的知识库文章列表
fastify.get('/api/my-knowledge/articles', async (request, reply) => {
  try {
    const userId = request.user?.id || request.query.userId;
    const { category_id } = request.query;

    let query = `
      SELECT * FROM knowledge_articles
      WHERE owner_id = ? AND is_deleted = 0 AND deleted_at IS NULL AND status != 'deleted'
    `;
    const params = [userId];

    if (category_id) {
      query += ' AND category_id = ?';
      params.push(category_id);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('获取我的知识库文章失败:', error);
    reply.code(500).send({ error: 'Failed to fetch my knowledge articles' });
  }
});

// 保存文章到我的知识库 (从公共知识库复制)
fastify.post('/api/my-knowledge/articles/save', async (request, reply) => {
  const { articleId, categoryId, notes } = request.body;
  const userId = request.user?.id || request.body.userId;

  try {
    // 获取原文章信息
    const [articles] = await pool.query(
      'SELECT * FROM knowledge_articles WHERE id = ?',
      [articleId]
    );

    if (articles.length === 0) {
      return reply.code(404).send({ error: 'Article not found' });
    }

    const article = articles[0];

    // 创建副本到我的知识库
    const [result] = await pool.query(
      `INSERT INTO knowledge_articles
      (title, category_id, summary, content, attachments, type, status, icon, owner_id, original_article_id, notes, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        article.title,
        categoryId || null,
        article.summary,
        article.content,
        article.attachments,
        'personal',
        'published',
        article.icon || '📄',
        userId,
        articleId,
        notes || null,
        0,
        userId
      ]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('保存到我的知识库失败:', error);
    reply.code(500).send({ error: 'Failed to save to my knowledge: ' + error.message });
  }
});

// 增加文档浏览量
fastify.post('/api/knowledge/articles/:id/view', async (request, reply) => {
  const { id } = request.params
  try {
    await pool.query('UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = ?', [id])
    return { success: true }
  } catch (error) {
    console.error(error)
    reply.code(500).send({ error: 'Failed to update view count' })
  }
})

// 文档点赞
fastify.post('/api/knowledge/articles/:id/like', async (request, reply) => {
  const { id } = request.params;
  const { userId } = request.body; // 从请求体获取用户ID

  try {
    // 检查用户是否已经点赞过
    const [existing] = await pool.query(
      'SELECT id FROM article_likes WHERE article_id = ? AND user_id = ?',
      [id, userId || 'anonymous']
    );

    if (existing.length > 0) {
      return reply.code(400).send({ success: false, message: '您已经点赞过' });
    }

    // 记录点赞
    await pool.query(
      'INSERT INTO article_likes (article_id, user_id) VALUES (?, ?)',
      [id, userId || 'anonymous']
    );

    // 更新点赞数
    await pool.query('UPDATE knowledge_articles SET like_count = like_count + 1 WHERE id = ?', [id]);

    return { success: true, message: '点赞成功' };
  } catch (error) {
    console.error(error);
    // 如果表不存在，先创建表
    if (error.code === 'ER_NO_SUCH_TABLE') {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS article_likes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            article_id INT NOT NULL,
            user_id VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_like (article_id, user_id),
            INDEX idx_article (article_id),
            INDEX idx_user (user_id)
          )
        `);
        // 重试点赞
        return reply.redirect(307, request.url);
      } catch (createError) {
        console.error('创建点赞表失败', createError);
      }
    }
    reply.code(500).send({ error: 'Failed to update like count' });
  }
});

// 检查用户是否已点赞
fastify.get('/api/knowledge/articles/:id/liked', async (request, reply) => {
  const { id } = request.params;
  const { userId } = request.query;

  try {
    const [existing] = await pool.query(
      'SELECT id FROM article_likes WHERE article_id = ? AND user_id = ?',
      [id, userId || 'anonymous']
    );

    return { liked: existing.length > 0 };
  } catch (error) {
    console.error(error);
    return { liked: false };
  }
});

// 文档收藏
fastify.post('/api/knowledge/articles/:id/collect', async (request, reply) => {
  const { id } = request.params;
  const { folder_id, notes } = request.body;
  const userId = request.user?.id || null;

  try {
    // 检查是否已经收藏过
    const [existing] = await pool.query(
      'SELECT id FROM article_collections WHERE user_id = ? AND article_id = ?',
      [userId, id]
    );

    if (existing.length > 0) {
      return reply.code(400).send({ success: false, message: '文档已在收藏夹中' });
    }

    // 添加收藏记录
    const [result] = await pool.query(
      'INSERT INTO article_collections (user_id, article_id, folder_id, notes) VALUES (?, ?, ?, ?)',
      [userId, id, folder_id || null, notes || null]
    );

    // 更新文章的收藏次数
    await pool.query(
      'UPDATE knowledge_articles SET collect_count = collect_count + 1 WHERE id = ?',
      [id]
    );

    return {
      success: true,
      message: '收藏成功',
      id: result.insertId
    };
  } catch (error) {
    console.error('收藏文档失败:', error);
    reply.code(500).send({ error: 'Failed to collect article' });
  }
});

// 获取用户收藏的文档
fastify.get('/api/knowledge/collections', async (request, reply) => {
  try {
    const userId = request.user?.id || null;

    const [rows] = await pool.query(`
      SELECT
        ac.*,
        ka.title,
        ka.summary,
        ka.icon,
        ka.view_count,
        ka.like_count,
        ka.collect_count,
        ka.created_at as article_created_at,
        cf.name as folder_name
      FROM article_collections ac
      LEFT JOIN knowledge_articles ka ON ac.article_id = ka.id
      LEFT JOIN collection_folders cf ON ac.folder_id = cf.id
      WHERE ac.user_id = ?
      ORDER BY ac.created_at DESC
    `, [userId]);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('获取收藏文档失败:', error);
    reply.code(500).send({ error: 'Failed to fetch collections' });
  }
});

// 取消收藏文档
fastify.delete('/api/knowledge/articles/:id/uncollect', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.id || null;

  try {
    // 删除收藏记录
    const [result] = await pool.query(
      'DELETE FROM article_collections WHERE user_id = ? AND article_id = ?',
      [userId, id]
    );

    if (result.affectedRows === 0) {
      return reply.code(404).send({ success: false, message: '未找到收藏记录' });
    }

    // 更新文章的收藏次数
    await pool.query(
      'UPDATE knowledge_articles SET collect_count = GREATEST(0, collect_count - 1) WHERE id = ?',
      [id]
    );

    return {
      success: true,
      message: '已取消收藏'
    };
  } catch (error) {
    console.error('取消收藏失败:', error);
    reply.code(500).send({ error: 'Failed to uncollect article' });
  }
});

// 检查文档是否已收藏
fastify.get('/api/knowledge/articles/:id/collected', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.id || null;

  try {
    const [existing] = await pool.query(
      'SELECT id, folder_id, notes FROM article_collections WHERE user_id = ? AND article_id = ?',
      [userId, id]
    );

    return {
      collected: existing.length > 0,
      collection: existing[0] || null
    };
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    return { collected: false };
  }
});

// 高级搜索文档
fastify.post('/api/knowledge/articles/search', async (request, reply) => {
  try {
    const {
      keyword = '',
      categories = [],
      types = [],
      statuses = [],
      authors = [],
      dateFrom = null,
      dateTo = null,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      page = 1,
      pageSize = 20
    } = request.body;

    let query = `
      SELECT
        ka.*,
        kc.name as category_name,
        u.real_name as author_name
      FROM knowledge_articles ka
      LEFT JOIN knowledge_categories kc ON ka.category_id = kc.id
      LEFT JOIN users u ON ka.created_by = u.id
      WHERE ka.status != 'deleted'
    `;
    const params = [];

    // 关键词搜索
    if (keyword && keyword.trim() !== '') {
      query += ` AND (ka.title LIKE ? OR ka.content LIKE ? OR ka.summary LIKE ?)`;
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam);
    }

    // 分类筛选
    if (categories && categories.length > 0) {
      query += ` AND ka.category_id IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }

    // 类型筛选
    if (types && types.length > 0) {
      query += ` AND ka.type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    // 状态筛选
    if (statuses && statuses.length > 0) {
      query += ` AND ka.status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    // 作者筛选
    if (authors && authors.length > 0) {
      query += ` AND ka.created_by IN (${authors.map(() => '?').join(',')})`;
      params.push(...authors);
    }

    // 日期范围筛选
    if (dateFrom) {
      query += ` AND ka.created_at >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ` AND ka.created_at <= ?`;
      params.push(dateTo);
    }

    // 排序
    const validSortFields = ['created_at', 'updated_at', 'view_count', 'like_count', 'title'];
    const validSortOrders = ['ASC', 'DESC'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    query += ` ORDER BY ka.${finalSortBy} ${finalSortOrder}`;

    // 分页
    const offset = (page - 1) * pageSize;
    query += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM knowledge_articles ka
      WHERE ka.status != 'deleted'
    `;
    const countParams = [];

    if (keyword && keyword.trim() !== '') {
      countQuery += ` AND (ka.title LIKE ? OR ka.content LIKE ? OR ka.summary LIKE ?)`;
      const keywordParam = `%${keyword}%`;
      countParams.push(keywordParam, keywordParam, keywordParam);
    }
    if (categories && categories.length > 0) {
      countQuery += ` AND ka.category_id IN (${categories.map(() => '?').join(',')})`;
      countParams.push(...categories);
    }
    if (types && types.length > 0) {
      countQuery += ` AND ka.type IN (${types.map(() => '?').join(',')})`;
      countParams.push(...types);
    }
    if (statuses && statuses.length > 0) {
      countQuery += ` AND ka.status IN (${statuses.map(() => '?').join(',')})`;
      countParams.push(...statuses);
    }
    if (authors && authors.length > 0) {
      countQuery += ` AND ka.created_by IN (${authors.map(() => '?').join(',')})`;
      countParams.push(...authors);
    }
    if (dateFrom) {
      countQuery += ` AND ka.created_at >= ?`;
      countParams.push(dateFrom);
    }
    if (dateTo) {
      countQuery += ` AND ka.created_at <= ?`;
      countParams.push(dateTo);
    }

    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    return {
      success: true,
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('搜索失败:', error);
    reply.code(500).send({ error: 'Search failed: ' + error.message });
  }
});





// ==================== 角色部门权限管理 API ====================

// 获取角色的部门权限列表
fastify.get('/api/roles/:id/departments', async (request, reply) => {
  const { id } = request.params;
  try {
    const [rows] = await pool.query(`
      SELECT d.*
      FROM departments d
      INNER JOIN role_departments rd ON d.id = rd.department_id
      WHERE rd.role_id = ?
      ORDER BY d.sort_order, d.id
    `, [id]);
    return { success: true, data: rows };
  } catch (error) {
    console.error('获取角色部门权限失败:', error);
    reply.code(500).send({ success: false, error: 'Failed to fetch role departments' });
  }
});

// 为角色添加部门权限
fastify.post('/api/roles/:id/departments', async (request, reply) => {
  const { id } = request.params;
  const { department_id } = request.body;
  try {
    await pool.query(
      'INSERT IGNORE INTO role_departments (role_id, department_id) VALUES (?, ?)',
      [id, department_id]
    );
    return { success: true, message: '部门权限添加成功' };
  } catch (error) {
    console.error('添加角色部门权限失败:', error);
    reply.code(500).send({ success: false, error: 'Failed to add department permission' });
  }
});

// 批量设置角色的部门权限
fastify.put('/api/roles/:id/departments', async (request, reply) => {
  const { id } = request.params;
  const { department_ids } = request.body; // 部门ID数组

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 删除该角色的所有部门权限
      await connection.query('DELETE FROM role_departments WHERE role_id = ?', [id]);

      // 2. 批量添加新的部门权限
      if (department_ids && department_ids.length > 0) {
        const values = department_ids.map(deptId => [id, deptId]);
        await connection.query(
          'INSERT INTO role_departments (role_id, department_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: '部门权限设置成功',
        count: department_ids?.length || 0
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('批量设置角色部门权限失败:', error);
    reply.code(500).send({ success: false, error: 'Failed to update department permissions' });
  }
});

// 移除角色的部门权限
fastify.delete('/api/roles/:roleId/departments/:departmentId', async (request, reply) => {
  const { roleId, departmentId } = request.params;
  try {
    await pool.query(
      'DELETE FROM role_departments WHERE role_id = ? AND department_id = ?',
      [roleId, departmentId]
    );
    return { success: true, message: '部门权限移除成功' };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to remove permission' });
  }
});

// 获取用户列表（包含角色信息）
fastify.get('/api/users-with-roles', async (request, reply) => {
  try {
    // 获取用户权限
    const permissions = await extractUserPermissions(request, pool);

    let query = `
      SELECT
        u.*,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.status != 'pending'
    `;

    let params = [];

    // 应用部门权限过滤
    const filtered = applyDepartmentFilter(permissions, query, params, 'u.department_id');
    query = filtered.query;
    params = filtered.params;

    const [users] = await pool.query(query, params);

    // 为每个用户获取角色信息
    for (const user of users) {
      const [roles] = await pool.query(`
        SELECT r.id, r.name, r.description, r.level
        FROM roles r
        INNER JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `, [user.id]);
      user.roles = roles;
    }

    return users;
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return reply.code(500).send({ error: '获取用户列表失败' });
  }
});


// 获取用户的所有权限（通过角色）
fastify.get('/api/users/:id/permissions', async (request, reply) => {
  const { id } = request.params;
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT p.*
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY p.module, p.id
    `, [id]);
    return rows;
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to fetch user permissions' });
  }
});

// 检查用户是否有某个权限
fastify.get('/api/users/:id/has-permission/:code', async (request, reply) => {
  const { id, code } = request.params;
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ? AND p.code = ?
    `, [id, code]);
    return { hasPermission: rows[0].count > 0 };
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: 'Failed to check permission' });
  }
});

// ==================== 启动服务 ====================

// ==================== 考勤管理路由 ====================
fastify.register(require('./routes/attendance-clock'));
fastify.register(require('./routes/leave'));
fastify.register(require('./routes/overtime'));
fastify.register(require('./routes/makeup'));
fastify.register(require('./routes/attendance-stats'));
fastify.register(require('./routes/attendance-settings'));
fastify.register(require('./routes/shifts'));
fastify.register(require('./routes/schedules'));
fastify.register(require('./routes/schedule-excel'));
fastify.register(require('./routes/attendance-approval'));

// ==================== 增强功能路由 ====================
fastify.register(require('./routes/export'));
fastify.register(require('./routes/smart-schedule'));

// ==================== 职位管理路由 ====================
fastify.register(require('./routes/positions'))

// ==================== 权限管理路由 ====================
fastify.register(require('./routes/permissions'))

// ==================== 部门管理路由 ====================
fastify.register(require('./routes/departments'))

// ==================== 考核系统路由 ====================
fastify.register(require('./routes/exams'))
fastify.register(require('./routes/exam-categories'))
fastify.register(require('./routes/assessment-plans'))
fastify.register(require('./routes/assessment-results'))

// ==================== 学习中心路由 ====================
fastify.register(require('./routes/learning-tasks'))
fastify.register(require('./routes/learning-plans'))
fastify.register(require('./routes/learning-center'))

// ==================== 假期管理路由 ====================
fastify.register(require('./routes/vacation-settings'))
fastify.register(require('./routes/holidays'))
fastify.register(require('./routes/conversion-rules'))
fastify.register(require('./routes/vacation-balance'))
fastify.register(require('./routes/compensatory-leave'))
fastify.register(require('./routes/vacation-type-balances'))
fastify.register(require('./routes/vacation-types'))

// ==================== 知识库路由 ====================
fastify.register(require('./routes/knowledge-reading'))
fastify.register(require('./routes/knowledge-stats'))

// ==================== 质检管理路由 ====================
fastify.register(require('./routes/quality-inspection'))

const start = async () => {
  try {
    await initDatabase();
    // 尝试多种绑定方式确保网络访问
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log(`🚀 服务器启动成功！`);
    console.log(`   本地访问: http://localhost:3001`);
    if (dbConfigJson.upload && dbConfigJson.upload.publicUrl) {
      console.log(`   公共访问: ${dbConfigJson.upload.publicUrl}`);
    }
    console.log(`   网络访问: http://[您的IP地址]:3001`);
  } catch (err) {
    console.error('❌ 服务器启动失败:', err);
    // 如果0.0.0.0失败，尝试绑定到所有接口
    try {
      await fastify.listen(3001);
      console.log('🚀 服务器已启动 (备用模式)');
    } catch (fallbackErr) {
      fastify.log.error(fallbackErr);
      process.exit(1);
    }
  }
};

start();
