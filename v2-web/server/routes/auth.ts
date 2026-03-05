import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { connection as redis } from '../lib/redis';
import bcrypt from 'bcryptjs';

// 1. 定义巅峰序列化 Schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  real_name: z.string(),
  avatar: z.string().nullable(),
  role: z.string().optional(), // 兼容前端
  department_id: z.number().nullable(),
});

export const loginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: userSchema,
  message: z.string().optional(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 登录接口 (规约执行：互踢逻辑 + 审计闭环)
  app.post('/api/auth/login', {
    schema: {
      body: z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        forceLogin: z.boolean().optional(),
      }),
      response: {
        200: loginResponseSchema,
        401: z.object({ success: z.boolean(), message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { username, password, forceLogin } = request.body;
    const ip = request.ip;

    // 1. 物理验证账号
    const user = await prisma.users.findUnique({ where: { username } });
    if (!user) {
      await logLoginAttempt(username, false, ip, 'User not found');
      return reply.code(401).send({ success: false, message: '账号或密码错误', token: '', user: {} as any });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await logLoginAttempt(username, false, ip, 'Invalid password');
      return reply.code(401).send({ success: false, message: '账号或密码错误', token: '', user: {} as any });
    }

    // 2. 互踢逻辑：检查活跃会话
    const sessionKey = `session:user:${user.id}`;
    const activeSession = await redis.hgetall(sessionKey);
    
    if (activeSession && activeSession.token && !forceLogin) {
      // 存在活跃会话且未强制登录 -> 返回冲突提示
      return reply.code(409).send({ 
        success: false, 
        message: '账号已在其他设备登录', 
        token: '',
        user: {} as any,
        sessionCreatedAt: activeSession.loginAt 
      } as any); // 临时 bypass schema 校验以返回特殊状态码
    }

    // 执行踢人 (发送系统信号)
    if (activeSession && activeSession.token) {
      await redis.publish('system_signals', JSON.stringify({
        action: 'FORCE_LOGOUT',
        userId: user.id,
        reason: 'New login from ' + ip
      }));
      await redis.del(sessionKey);
    }

    // 3. 生成新会话
    const token = app.jwt.sign({ id: user.id, username: user.username });
    
    // 物理存证 Session (HSET)
    await redis.hset(sessionKey, {
      token,
      ip,
      loginAt: new Date().toISOString(),
      userAgent: request.headers['user-agent'] || 'unknown'
    });
    await redis.expire(sessionKey, 86400 * 7); // 7天过期

    // 4. 审计闭环
    await logLoginAttempt(username, true, ip, 'Success');

    // 5. 更新用户最后登录时间
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login: new Date() }
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        avatar: user.avatar,
        role: user.is_department_manager ? 'manager' : 'employee', // 简易映射
        department_id: user.department_id
      }
    };
  });

  // 登出接口
  app.post('/api/auth/logout', {
    schema: { response: { 200: z.object({ success: z.boolean() }) } }
  }, async (request) => {
    const userId = (request as any).user?.id;
    if (userId) {
      await redis.del(`session:user:${userId}`);
      await redis.hdel('online_status', String(userId));
    }
    return { success: true };
  });

  // 检查会话状态 (前端轮询用)
  app.post('/api/auth/check-session', {
    schema: {
      body: z.object({ username: z.string() }),
      response: { 200: z.object({ hasActiveSession: z.boolean(), sessionCreatedAt: z.string().optional() }) }
    }
  }, async (request) => {
    const { username } = request.body;
    const user = await prisma.users.findUnique({ where: { username } });
    if (!user) return { hasActiveSession: false };

    const session = await redis.hgetall(`session:user:${user.id}`);
    return { 
      hasActiveSession: !!session && !!session.token,
      sessionCreatedAt: session?.loginAt 
    };
  });
}

// 辅助：审计日志记录
async function logLoginAttempt(username: string, success: boolean, ip: string, msg: string) {
  await prisma.operation_logs.create({
    data: {
      module: 'auth',
      action: 'login',
      username,
      status: success,
      ip,
      error_msg: msg,
      created_at: new Date()
    }
  });
}
