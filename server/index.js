/**
 * 雷犀旗舰版后端中枢 (超级容错自愈版)
 */
const fastify = require('fastify')({ logger: false, bodyLimit: 10485760 });
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const cron = require('node-cron');
const Redis = require('ioredis');

// 1. 同步加载基础配置 (最严密保护)
let config, dbConfigJson;
try {
  config = require('./config');
  const { loadConfig } = require('./utils/config-crypto');
  dbConfigJson = loadConfig(path.join(__dirname, '../config/db-config.json'));
} catch (err) {
  console.error('🔥 [Config Error] 配置文件加载溃散:', err.message);
  process.exit(1);
}

const { JWT_SECRET, oss } = config;
const { sanitizeUser } = require('./utils/pathHelper');

// 2. 核心引擎初始化
let pool, redis, io;
async function initEngines() {
  try {
    pool = mysql.createPool({ ...dbConfigJson.database, waitForConnections: true, connectionLimit: 15, timezone: '+08:00' });
    fastify.decorate('mysql', pool);
    global.pool = pool;

    redis = new Redis({
      host: process.env.REDIS_HOST || dbConfigJson.redis?.host || '127.0.0.1',
      port: dbConfigJson.redis?.port || 6379,
      password: dbConfigJson.redis?.password || '',
      db: dbConfigJson.redis?.db || 0,
      // 增强稳定性设置
      retryStrategy: (times) => Math.min(times * 100, 3000),
      keepAlive: 10000, // 10秒 TCP 心跳
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) return true;
        return false;
      },
      enableReadyCheck: true
    });
    fastify.decorate('redis', redis);

    const { setupWebSocket } = require('./websocket');
    io = setupWebSocket(fastify.server, redis, () => pool);
    fastify.decorate('io', io);
    return true;
  } catch (err) {
    console.error('🔥 [Engine Error] 基础引擎启动失败:', err.message);
    return false;
  }
}

// 3. 插件与路由注册
const setupServer = async () => {
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const uploadDir = dbConfigJson.upload?.sharedDirectory || path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  fastify.uploadDir = uploadDir; // 挂载到实例供其他路由使用
  fastify.register(require('@fastify/static'), { 
    root: uploadDir, 
    prefix: '/uploads/',
    setHeaders: (res, path, stat) => {
      // 强制 PDF 在浏览器内预览而非下载
      if (path.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Disposition', 'inline');
      }
    }
  });

  // 健康检查
  fastify.get('/api/health', async () => ({ status: 'ok', version: '2.0.1' }));

  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password, force = false } = request.body;
    
    // 联合查询用户信息和角色
    const [users] = await pool.query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      LEFT JOIN roles r ON ur.role_id = r.id 
      WHERE u.username = ? AND u.status = "active"
      LIMIT 1
    `, [username]);

    if (users.length === 0 || !(await bcrypt.compare(password, users[0].password_hash))) {
      return reply.code(401).send({ success: false, message: '认证失败' });
    }

    const user = users[0];
    const isForce = force === true || force === 'true' || force === 1;

    // --- 单设备登录逻辑：物理隔离保证 ---
    if (redis) {
      const activeToken = await redis.get(`user:session:${user.id}`);
      
      if (activeToken && !isForce) {
        return { 
          success: false, 
          conflict: true, 
          message: '您的账号已在另一台设备登录，是否强制登录并断开对方连接？',
          sessionCreatedAt: new Date()
        };
      }

      if (activeToken && isForce) {
        console.log(`🚨 [Auth] 用户 ${user.username} (ID: ${user.id}) 执行强制登录，清理旧设备...`);
        // 1. 物理删除 Redis 键，瞬间废除旧 Token 的 API 访问权
        await redis.del(`user:session:${user.id}`);
        // 2. 发送踢人广播
        await redis.publish('system_notifications', JSON.stringify({
            userId: String(user.id),
            category: 'kicked_out',
            message: '您的账号已在另一台设备登录，当前连接已断开'
        }));
        // 3. 阻塞 500ms 确保旧设备完成 Socket 断开和缓存清理
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const tokenPayload = { 
      id: user.id, 
      username: user.username,
      real_name: user.real_name,
      role: user.role_name,
      department_id: user.department_id
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

    if (redis) {
      // 4. 写入新 Token，正式开启新会话
      await redis.set(`user:session:${user.id}`, token, 'EX', 3600 * 24 * 30);
    }

    return { success: true, token, user: sanitizeUser(user, request) };
  });

  // 检查会话 (多端登录检测)
  fastify.post('/api/auth/check-session', async (request, reply) => {
    const { username } = request.body;
    if (redis) {
      const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (rows.length > 0) {
        const userId = rows[0].id;
        const activeToken = await redis.get(`user:session:${userId}`);
        return { success: true, hasActiveSession: !!activeToken };
      }
    }
    return { success: true, hasActiveSession: false };
  });

  // 登出
  fastify.post('/api/auth/logout', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (token && redis) {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // --- 关键加固：防止注销冲突 ---
        const activeToken = await redis.get(`user:session:${decoded.id}`);
        // 只有当请求注销的 Token 与 Redis 记录一致时才执行物理清理
        if (activeToken === token) {
          await redis.del(`user:session:${decoded.id}`);
          await redis.del(`user:permissions:${decoded.id}`);
          console.log(`📡 [Auth] 用户 ${decoded.id} 已安全注销会话`);
        }
      }
      return { success: true };
    } catch (e) {
      return { success: true };
    }
  });

  fastify.get('/api/auth/permissions', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      const [roles] = await pool.query(`SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?`, [decoded.id]);
      const roleNames = roles.map(r => r.name);
      const isAdmin = roleNames.includes('超级管理员') || decoded.username === 'admin';
      const [all] = await pool.query('SELECT code FROM permissions');
      const codes = isAdmin ? all.map(p => p.code) : []; // 简化逻辑供测试
      const [uRows] = await pool.query('SELECT id, avatar FROM users WHERE id = ?', [decoded.id]);
      return { success: true, permissions: codes, roles: roleNames, data: { permissions: codes, isAdmin, user: sanitizeUser(uRows[0], request) } };
    } catch (e) { return reply.code(401).send({ success: false }); }
  });

  // 动态注册路由 (彻底隔离)
  const routesPath = path.join(__dirname, 'routes');
  fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const route = require(path.join(routesPath, file));
        if (typeof route === 'function') fastify.register(route);
      } catch (err) {
        console.error(`⚠️ [Route Skip] ${file} 加载失败:`, err.message);
      }
    }
  });
};

async function main() {
  const engineOk = await initEngines();
  if (!engineOk) {
    console.error('❌ 系统核心引擎未就绪，强制退出');
    process.exit(1);
  }
  
  await setupServer();

  try {
    // --- 启动优化：异步执行预热任务，不阻塞主进程启动 ---
    const { warmUp } = require('./utils/cacheWarmer');
    warmUp(fastify).catch(e => console.error('⚠️ [Cache] 预热任务后台执行报错:', e.message));
    
    const MessageQueue = require('./utils/messageQueue');
    const queue = new MessageQueue(pool, redis);
    io.messageQueue = queue;
    await queue.initSequence();
    setInterval(() => queue.flush().catch(e => {}), 5000);

    await fastify.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' });
    console.log('🚀 雷犀旗舰系统引擎已完全体启动 (3001)');
  } catch (err) {
    console.error('🔥 [Final Crash]', err);
    process.exit(1);
  }
}

main();
