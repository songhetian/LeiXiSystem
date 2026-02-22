const fastify = require('fastify')({
  logger: true,
  bodyLimit: 10485760 // 10MB
})
const cors = require('@fastify/cors')
const multipart = require('@fastify/multipart')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream')
const util = require('util')
const pump = util.promisify(pipeline)
const dayjs = require('dayjs')
// 引入统一配置
const config = require('./config');
const { JWT_SECRET, JWT_REFRESH_SECRET, isProd } = config;

// 全局错误处理器
fastify.setErrorHandler((error, request, reply) => {
  // 记录详细错误到控制台（无论什么环境）
  request.log.error(error)

  // 生产环境下，隐藏 500 错误的详细技术细节
  if (isProd && reply.statusCode >= 500) {
    return reply.send({
      success: false,
      message: '服务器繁忙，请稍后再试',
      error: 'Internal Server Error'
    })
  }

  // 开发环境或非 500 错误，返回原始信息
  reply.send({
    success: false,
    message: error.message || '操作失败',
    ...(isProd ? {} : { stack: error.stack, detail: error })
  })
})

// 注册 CORS
fastify.register(cors, {
  // 生产环境下限制允许的域名，开发环境下允许所有
  origin: (origin, cb) => {
    if (!isProd || !origin || origin === 'null' || origin.startsWith('http://localhost') || origin.startsWith('vscode-webview://')) {
      cb(null, true);
      return;
    }
    
    // 从环境变量获取允许的域名列表
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
    if (allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Payslip-Token'],
  credentials: true,
  exposedHeaders: ['Content-Type']
})

// 设置默认响应头确保UTF-8编码
fastify.addHook('onSend', async (request, reply, payload) => {
  if (!reply.getHeader('Content-Type')) {
    reply.header('Content-Type', 'application/json; charset=utf-8')
  } else if (reply.getHeader('Content-Type')?.includes('application/json')) {
    reply.header('Content-Type', 'application/json; charset=utf-8')
  }
  return payload
})

// 引入权限中间件
const { extractUserPermissions, applyDepartmentFilter } = require('./middleware/checkPermission')
// 引入日志工具
const { recordLog } = require('./utils/logger')
// 引入人事闭环工具
const { syncUserChatGroups } = require('./utils/personnelClosure')
const cron = require('node-cron');

// ... 之前的逻辑 ...

// --- 知识库优化：Redis 阅读量同步任务 (每 10 分钟一次) ---
cron.schedule('*/10 * * * *', async () => {
  const pool = fastify.mysql || global.pool;
  const redis = fastify.redis;
  if (!pool || !redis) return;

  try {
    const views = await redis.hgetall('stats:article:views');
    const articleIds = Object.keys(views);
    
    if (articleIds.length > 0) {
      console.log(`[Cron] 正在同步 ${articleIds.length} 篇文章的阅读量...`);
      for (const id of articleIds) {
        const count = parseInt(views[id]);
        await pool.query(
          'UPDATE knowledge_articles SET view_count = view_count + ?, updated_at = updated_at WHERE id = ?',
          [count, id]
        );
      }
      // 同步完成后清理 Redis 增量
      await redis.del('stats:article:views');
      console.log('✅ 知识库阅读量同步完成');
    }
  } catch (error) {
    console.error('❌ 阅读量同步任务失败:', error);
  }
});

// 注册文件上传// 注意：multipart 只处理 multipart/form-data，不影响 application/json
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

fastify.decorate('uploadDir', uploadDir)
fastify.decorate('uploadUrl', dbConfigJson.upload?.publicUrl || '')

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

  // Redis 配置
  const Redis = require('ioredis');
  const redisConfig = {
    host: process.env.REDIS_HOST || (dbConfigJson.redis && dbConfigJson.redis.host) || '127.0.0.1',
    port: (dbConfigJson.redis && dbConfigJson.redis.port) || process.env.REDIS_PORT || 6379,
    password: (dbConfigJson.redis && dbConfigJson.redis.password) || process.env.REDIS_PASSWORD || '',
    db: (dbConfigJson.redis && dbConfigJson.redis.db) || process.env.REDIS_DB || 0
  };

  let pool
  let redis;

  // ==================== 初始化基础服务 ====================
  // 同步创建连接池以保证后续 register 能立即获取装饰器
  try {
    pool = mysql.createPool(dbConfig);
    fastify.decorate('mysql', pool);
    global.pool = pool; // 兜底：供某些未正确获取 fastify 实例的模块使用
    console.log('📦 Database pool created and decorated (global.pool set)');
  } catch (dbInitErr) {
    console.error('❌ Failed to create database pool:', dbInitErr);
  }

  try {
    redis = new Redis({
      ...redisConfig,
      connectTimeout: 5000, // 5秒连接超时
      maxRetriesPerRequest: 1 // 减少重试次数，快速失败
    });
    redis.on('error', (err) => {
      console.error('❌ Redis error (降级模式运行):', err.message);
    });
    fastify.decorate('redis', redis);
    console.log('📦 Redis client created (Host: ' + redisConfig.host + ')');
  } catch (redisInitErr) {
    console.error('❌ Failed to initialize Redis:', redisInitErr);
  }

  // 优雅关闭
  fastify.addHook('onClose', async (instance) => {
    if (redis) {
      await redis.quit();
      console.log('👋 Redis connection closed');
    }
  });

  // 以前的 initDatabase 函数现在变为可选的连接测试
  async function initDatabase() {
    try {
      if (!pool) throw new Error('Pool not initialized');
      const connection = await pool.getConnection();
      await connection.query("SET time_zone = '+08:00'");
      connection.release();
      console.log('✅ Database connection verified (timezone set)');
    } catch (error) {
      console.error('⚠️ Database verification failed:', error);
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
    serverTime: new Date().toISOString(),
    codeVersion: 'v2024-12-14-14:55', // 添加代码版本标识
    endpoints: [
      'GET /api/health - 健康检查',
      'POST /api/auth/login - 用户登录',
      'GET /api/employees - 获取员工列表'
    ]
  }
})


// ==================== 职位管理 API ====================
// 职位管理路由已移至 server/routes/positions.js
const start = async () => {
  try {
    await initDatabase();

    // ==================== 认证 API (在数据库初始化后注册) ====================

    // 检查用户名是否可用并提供建议
    fastify.post('/api/auth/check-username', async (request, reply) => {
      const { username, realName } = request.body

      try {
        // 检查用户名是否已存在
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username])

        if (existing.length === 0) {
          return { available: true, suggestions: [] }
        }

        // 生成建议用户名（类似 Google）
        const suggestions = []
        const baseUsername = username.toLowerCase()
        const currentYear = new Date().getFullYear()

        // 建议1: 用户名 + 随机3位数字
        suggestions.push(`${baseUsername}${Math.floor(100 + Math.random() * 900)}`)

        // 建议2: 用户名 + 当前年份
        suggestions.push(`${baseUsername}${currentYear}`)

        // 建议3: 用户名 + 随机4位数字
        suggestions.push(`${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`)

        // 建议4: 如果有真实姓名，尝试姓+名首字母+数字
        if (realName && realName.length >= 2) {
          const pinyin = require('pinyin-pro')
          const pinyinArray = pinyin.pinyin(realName, { toneType: 'none', type: 'array' })
          if (pinyinArray.length >= 2) {
            const firstNameInitial = pinyinArray[0][0]
            const lastNameInitial = pinyinArray[pinyinArray.length - 1][0]
            suggestions.push(`${firstNameInitial}${lastNameInitial}${Math.floor(10 + Math.random() * 90)}`)
          }
        }

        // 建议5: 用户名 + "_" + 随机2位数字
        suggestions.push(`${baseUsername}_${Math.floor(10 + Math.random() * 90)}`)

        // 过滤掉已存在的建议
        const uniqueSuggestions = []
        for (const suggestion of suggestions) {
          const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [suggestion])
          if (exists.length === 0) {
            uniqueSuggestions.push(suggestion)
          }
        }

        return {
          available: false,
          suggestions: uniqueSuggestions.slice(0, 5) // 最多返回5个建议
        }
      } catch (error) {
        console.error('检查用户名失败:', error)
        return reply.code(500).send({ success: false, message: '检查用户名失败' })
      }
    })

    // 用户注册
    fastify.post('/api/auth/register', async (request, reply) => {
      const { username, password, real_name, email, phone, department_id } = request.body

      try {
        // 检查用户名是否已存在
        const [existingUsername] = await pool.query('SELECT id FROM users WHERE username = ?', [username])
        if (existingUsername.length > 0) {
          return reply.code(400).send({ success: false, message: '用户名已存在' })
        }

        // 检查邮箱是否已存在（仅当提供了邮箱时）
        if (email && email.trim()) {
          const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [email])
          if (existingEmail.length > 0) {
            return reply.code(400).send({ success: false, message: '该邮箱已被注册' })
          }
        }

        // 检查手机号是否已存在（仅当提供了手机号时）
        if (phone && phone.trim()) {
          const [existingPhone] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone])
          if (existingPhone.length > 0) {
            return reply.code(400).send({ success: false, message: '该手机号已被注册' })
          }
        }

        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10)

        // 注册用户
        // 注意：如果 email 或 phone 为空字符串，将其转换为 null，避免唯一索引冲突（如果数据库有唯一索引且允许 NULL）
        const emailToSave = email && email.trim() ? email : null;
        const phoneToSave = phone && phone.trim() ? phone : null;

        const [result] = await pool.query(
          'INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
          [username, passwordHash, real_name, emailToSave, phoneToSave, department_id || null, 'pending']
        )

        return { success: true, userId: result.insertId, message: '注册成功，请等待管理员审核' }
      } catch (error) {
        console.error('注册失败:', error)
        return reply.code(500).send({ success: false, message: '注册失败: ' + error.message })
      }
    })

    // 检查会话状态
    fastify.post('/api/auth/check-session', async (request, reply) => {
      const { userId, sessionToken, username } = request.body

      // 场景1：登录前的活跃会话检查（通过用户名）
      if (username && !userId) {
        try {
          const [user] = await pool.query(
            'SELECT id, session_token, last_login FROM users WHERE username = ? AND status = "active"',
            [username]
          );
          if (user.length > 0 && user[0].session_token) {
            return {
              success: true,
              hasActiveSession: true,
              lastLogin: user[0].last_login
            };
          }
          return { success: true, hasActiveSession: false };
        } catch (err) {
          return { success: false, message: '检查活跃会话失败' };
        }
      }

      // 场景2：已登录状态的会话校验
      if (!userId || !sessionToken) {
        return { success: false, message: '会话信息不完整', hasActiveSession: false };
      }

      try {
        const [user] = await pool.query(
          'SELECT id, session_token, status FROM users WHERE id = ?',
          [userId]
        )

        if (user.length === 0) {
          return { success: false, message: '用户不存在', hasActiveSession: false }
        }

        if (user[0].status !== 'active') {
          return { success: false, message: '账号未激活或已禁用', hasActiveSession: false }
        }

        if (user[0].session_token !== sessionToken) {
          return { success: false, message: '会话已过期或在其他设备登录', hasActiveSession: true }
        }

        return { success: true, hasActiveSession: true }
      } catch (error) {
        console.error('检查会话失败:', error)
        return { success: false, message: '服务器错误', hasActiveSession: false }
      }
    })

    // 用户登录
    fastify.post('/api/auth/login', async (request, reply) => {
      const { username, password } = request.body

      try {
        const [users] = await pool.query(
          'SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.username = ? AND u.status = "active"',
          [username]
        )

        if (users.length === 0) {
          return reply.code(401).send({ success: false, message: '用户名或密码错误，或账号未审核' })
        }

        const user = users[0]
        const isValid = await bcrypt.compare(password, user.password_hash)

        if (!isValid) {
          return reply.code(401).send({ success: false, message: '用户名或密码错误' })
        }

        // 生成 Token
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        )

        // 生成会话 Token 用于单设备登录校验
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36)

        // 更新用户最后登录时间和会话 Token
        await pool.query(
          'UPDATE users SET last_login = NOW(), session_token = ?, session_created_at = NOW() WHERE id = ?',
          [sessionToken, user.id]
        )

        // 缓存 Session 到 Redis - 存储完整的 JWT Token 以供 checkPermission 中间件校验
        if (redis) {
          await redis.set(`user:session:${user.id}`, token, 'EX', 86400);
        }

        // 不返回密码
        const { password: _, ...userWithoutPassword } = user
        return {
          success: true,
          token,
          sessionToken,
          expiresIn: 86400, // 24小时，与 JWT expiresIn: '24h' 保持一致
          user: userWithoutPassword
        }
      } catch (error) {
        console.error('登录失败:', error)
        return reply.code(500).send({ success: false, message: '服务器错误' })
      }
    })

    // 退出登录
    fastify.post('/api/auth/logout', async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '')
        if (!token) {
          return { success: true }
        }

        const decoded = jwt.verify(token, JWT_SECRET)
        const userId = decoded.id

        // 清除 MySQL 会话
        await pool.query(
          'UPDATE users SET session_token = NULL, session_created_at = NULL WHERE id = ?',
          [userId]
        )

        // 清除 Redis Session
        if (redis) {
          await redis.del(`user:session:${userId}`);
        }

        return { success: true }
      } catch (error) {
        console.error('退出登录失败:', error)
        return { success: true } // 即使失败也返回成功，让前端清除本地存储
      }
    })

    // 刷新 Token
    fastify.post('/api/auth/refresh', async (request, reply) => {
      const { refreshToken, refresh_token } = request.body
      const actualToken = refreshToken || refresh_token

      try {
        const decoded = jwt.verify(actualToken, JWT_REFRESH_SECRET)
        const [users] = await pool.query('SELECT * FROM users WHERE id = ? AND status = "active"', [decoded.id])

        if (users.length === 0) {
          return reply.code(401).send({ success: false, message: '用户不存在或已禁用' })
        }

        const user = users[0]
        const newToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        )

        return { success: true, token: newToken }
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的刷新令牌' })
      }
    })

    // 验证 Token 是否有效
    fastify.get('/api/auth/verify-token', async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
          return { valid: false, message: '未提供认证令牌' };
        }

        let decoded;
        try {
          decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtErr) {
          console.error('[VerifyToken] JWT 校验失败:', jwtErr.message);
          return { valid: false, message: '令牌无效或已过期' };
        }

        const userId = decoded.id;

        // 检查用户状态
        const [userRows] = await pool.query(
          'SELECT id, username, session_token, status FROM users WHERE id = ?',
          [userId]
        );

        if (userRows.length === 0) {
          return { valid: false, message: '用户不存在' };
        }

        const user = userRows[0];
        if (user.status !== 'active') {
          return { valid: false, message: '账号未激活或已禁用' };
        }

        return {
          success: true,
          valid: true,
          user: decoded
        };
      } catch (error) {
        console.error('[VerifyToken] 系统错误:', error);
        return { valid: false, message: '服务器校验出错' };
      }
    })

    // 获取当前用户权限
    fastify.get('/api/auth/permissions', async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '')
        if (!token) {
          return reply.code(401).send({ success: false, message: '未提供认证令牌' })
        }

        const decoded = jwt.verify(token, JWT_SECRET)
        const userId = decoded.id

        // 查询用户角色
        const [roles] = await pool.query(
          `SELECT r.* FROM roles r
           JOIN user_roles ur ON r.id = ur.role_id
           WHERE ur.user_id = ?`,
          [userId]
        )

        // 查询用户权限
        const [permissions] = await pool.query(
          `SELECT DISTINCT p.* FROM permissions p
           JOIN role_permissions rp ON p.id = rp.permission_id
           JOIN user_roles ur ON rp.role_id = ur.role_id
           WHERE ur.user_id = ?`,
          [userId]
        )

        // 获取用户基本信息，包括部门
        const [user] = await pool.query(
          'SELECT id, username, real_name, department_id FROM users WHERE id = ?',
          [userId]
        )

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

    // ==================== 批量强制下线用户 ====================
    fastify.post('/api/auth/batch-logout', async (request, reply) => {
      const { userIds } = request.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return reply.code(400).send({ success: false, message: '请选择要下线的用户' });
      }

      try {
        await pool.query(
          'UPDATE users SET session_token = NULL, session_created_at = NULL WHERE id IN (?)',
          [userIds]
        );

        if (redis) {
          const pipeline = redis.pipeline();
          userIds.forEach(id => {
            pipeline.del(`user:session:${id}`);
            pipeline.del(`user:permissions:${id}`);
          });
          await pipeline.exec();
        }

        if (fastify.io) {
          userIds.forEach(id => {
            fastify.io.to(`user_${id}`).emit('kicked_out', {
              message: '您的账号已被管理员强制下线',
              timestamp: new Date()
            });
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, message: `成功强制下线 ${userIds.length} 名用户` };
      } catch (error) {
        console.error('批量下线失败:', error);
        return reply.code(500).send({ success: false, message: '操作失败' });
      }
    })

    // ==================== 核心业务路由注册 ====================
    // 基础功能
    fastify.register(require('./routes/upload'))
    fastify.register(require('./routes/notification-settings'))
    fastify.register(require('./routes/user-management'))
    fastify.register(require('./routes/chat'))
    fastify.register(require('./routes/system-logs'))
    fastify.register(require('./routes/todo-center'))
    fastify.register(require('./routes/dashboard'))
    fastify.register(require('./routes/admin-dashboard'))
    
    // 人事管理
    fastify.register(require('./routes/personnel'))
    fastify.register(require('./routes/personnel-logic'))
    fastify.register(require('./routes/positions'))
    fastify.register(require('./routes/permissions'))
    fastify.register(require('./routes/departments'))
    
    // 资产与报销
    fastify.register(require('./routes/reimbursement'))
    fastify.register(require('./routes/reimbursement-settings'))
    fastify.register(require('./routes/assets'))
    fastify.register(require('./routes/inventory'))
    fastify.register(require('./routes/approval-workflow'))
    fastify.register(require('./routes/approval-groups'))
    fastify.register(require('./routes/approvers'))

    // 考勤管理
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
    fastify.register(require('./routes/smart-schedule'));

    // 工资与假期
    fastify.register(require('./routes/payslips'));
    fastify.register(require('./routes/vacation-settings'))
    fastify.register(require('./routes/holidays'))
    fastify.register(require('./routes/conversion-rules'))
    fastify.register(require('./routes/vacation-balance'))
    fastify.register(require('./routes/vacation-conversion'))
    fastify.register(require('./routes/compensatory-leave'))
    fastify.register(require('./routes/vacation-type-balances'))
    fastify.register(require('./routes/vacation-types'))

    // 知识库与考核
    fastify.register(require('./routes/knowledge'))
    fastify.register(require('./routes/knowledge-reading'))
    fastify.register(require('./routes/knowledge-stats'))
    fastify.register(require('./routes/learning-tasks'))
    fastify.register(require('./routes/learning-plans'))
    fastify.register(require('./routes/learning-center'))
    fastify.register(require('./routes/exams'))
    fastify.register(require('./routes/exam-categories'))
    fastify.register(require('./routes/assessment-plans'))
    fastify.register(require('./routes/assessment-results'))

    // 质检管理
    fastify.register(require('./routes/quality-inspection'))
    fastify.register(require('./routes/quality-inspection-import-new'))
    fastify.register(require('./routes/quality-tags'))
    fastify.register(require('./routes/case-categories'))
    fastify.register(require('./routes/quality-cases'))
    fastify.register(require('./routes/quality-case-interactions'))

    // 消息与广播
    fastify.register(require('./routes/notifications'))
    fastify.register(require('./routes/memos'))
    fastify.register(require('./routes/broadcasts'))
    fastify.register(require('./routes/export'))

    const { setupWebSocket } = require('./websocket')
    // 设置WebSocket - 直接使用 fastify.server
    const io = setupWebSocket(fastify.server, redis, () => pool)
    // 将io实例挂载到fastify，供其他路由使用
    fastify.decorate('io', io)

    // 先准备fastify
    await fastify.ready()

    // 启动服务器
    fastify.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' }, async (err, address) => {
      if (err) {
        console.error('❌ 服务器启动失败:', err);
        process.exit(1);
      }

      // --- 启动聊天消息异步持久化 Worker ---
      if (redis) {
        try {
          const MessageQueue = require('./utils/messageQueue');
          const queue = new MessageQueue(pool, redis);
          io.messageQueue = queue;
          await queue.initSequence();

          // 每 5 秒批量存入数据库一次
          setInterval(() => {
            queue.flush().catch(e => console.error('Message Flush Error:', e));
          }, 5000);

          // --- 用户名片预热 (Warm-up) ---
          console.log('🔥 正在预热用户名片缓存...');
          const { cacheUserProfile } = require('./utils/personnelClosure');
          const [activeUsers] = await pool.query('SELECT id FROM users WHERE status = "active"');
          for (const u of activeUsers) {
            try {
              await cacheUserProfile(pool, redis, u.id);
            } catch (preheatErr) {
              // 如果报错说明类型冲突，强制清理后重试
              if (preheatErr.message.includes('WRONGTYPE')) {
                await redis.del(`user:profile:${u.id}`);
                await cacheUserProfile(pool, redis, u.id);
              }
            }
          }
          console.log(`✅ 已预热 ${activeUsers.length} 个用户缓存`);

          // --- 复杂统计数据预热 ---
          const CacheWarmer = require('./utils/cacheWarmer');
          const warmer = new CacheWarmer(pool, redis);
          warmer.runAll().catch(e => console.error('❌ Cache Preheat Error:', e));

          // --- 自动化考勤终盘 (Daily Cron Job) ---
          const cron = require('node-cron');
          const AttendanceAutoProcessor = require('./utils/attendanceAutoProcessor');
          const attendanceProcessor = new AttendanceAutoProcessor(pool, redis, io);
          
          // 每天凌晨 01:00 执行
          cron.schedule('0 1 * * *', () => {
            attendanceProcessor.processDaily().catch(e => console.error('❌ Daily Attendance Job Error:', e));
          });
          console.log('⏰ [Cron] 考勤自动化终盘任务已注册 (每日 01:00)');
          
        } catch (queueErr) {
          console.error('❌ 消息队列 Worker 启动失败:', queueErr);
        }
      }

      console.log(`🚀 服务器启动成功！监听地址: ${address}`);
      console.log(`   本地访问: http://localhost:3001`);
      if (dbConfigJson.upload && dbConfigJson.upload.publicUrl) {
        console.log(`   公共访问: ${dbConfigJson.upload.publicUrl}`);
      }
      console.log(`   网络访问: http://[您的IP地址]:3001`);
      console.log(`🔌 WebSocket服务已启动`);
    });
  } catch (err) {
    console.error('❌ 服务器初始化失败:', err);
    process.exit(1);
  }
};
start();
