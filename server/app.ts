import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { 
  serializerCompiler, 
  validatorCompiler, 
  ZodTypeProvider 
} from 'fastify-type-provider-zod';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import config from './lib/config';

import authRoutes from './routes/auth';
import assetRoutes from './routes/assets';
import reimbursementRoutes from './routes/reimbursement';
import qualityRoutes from './routes/quality';
import attendanceRoutes from './routes/attendance';
import shiftRoutes from './routes/attendance-shifts';
import broadcastRoutes from './routes/broadcasts';
import workflowRoutes from './routes/workflow';
import chatRoutes from './routes/chat';
import hrChangeRoutes from './routes/hr-changes';
import employeeRoutes from './routes/employees';
import rbacRoutes from './routes/permissions';
import systemLogRoutes from './routes/system-logs';
import knowledgeRoutes from './routes/knowledge';
import personalRoutes from './routes/personal';
import dashboardRoutes from './routes/dashboard';
import personalDashboardRoutes from './routes/personal-dashboard';
import examRoutes from './routes/exams';
import vacationRoutes from './routes/vacation';
import smartScheduleRoutes from './routes/smart-schedule';
import makeupRoutes from './routes/attendance-makeup';
import uploadRoutes from './routes/upload';
import { setupWebSocket, io } from './lib/socket';

const prisma = new PrismaClient();
const app = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

// 配置 Zod 编译器
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// 注册插件
app.register(cors);
app.register(multipart, { attachFieldsToBody: true, limits: { fileSize: 50 * 1024 * 1024 } });
app.register(jwt, {
  secret: config.jwtSecret,
});

const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/check-session',
  '/api/auth/check-username',
  '/api/public/departments',
  '/api/departments',
  '/api/departments/list',
  '/api/positions',
];

app.addHook('onRequest', async (request, reply) => {
  if (
    publicPaths.some((path) => request.url.startsWith(path)) ||
    request.url.startsWith('/uploads/')
  ) {
    return;
  }

  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch (error) {
    return reply.code(401).send({ success: false, message: 'Unauthorized' });
  }
});

// 注册业务路由
app.register(authRoutes);
app.register(assetRoutes);
app.register(reimbursementRoutes);
app.register(qualityRoutes);
app.register(attendanceRoutes);
app.register(shiftRoutes);
app.register(broadcastRoutes);
app.register(hrChangeRoutes);
app.register(employeeRoutes);
app.register(chatRoutes);
app.register(rbacRoutes);
app.register(systemLogRoutes);
app.register(workflowRoutes);
app.register(knowledgeRoutes);
app.register(personalRoutes);
app.register(dashboardRoutes);
app.register(personalDashboardRoutes);
app.register(examRoutes);
app.register(vacationRoutes);
app.register(smartScheduleRoutes);
app.register(makeupRoutes);
app.register(uploadRoutes);

// --- 系统就绪状态检查 ---
async function verifySystemReady() {
  console.log('\n🚀 \x1b[36m雷犀系统 v2 正在启动...\x1b[0m');
  
  // 1. MySQL (Prisma)
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ \x1b[32mMySQL (Prisma) 数据库:\x1b[0m 已连接 (leixin_customer_service)');
  } catch (err) {
    console.error('❌ \x1b[31mMySQL (Prisma) 数据库:\x1b[0m 连接失败！', err);
  }

  // 2. Redis
  try {
    const redis = (await import('./lib/redis')).connection;
    await redis.ping();
    console.log('✅ \x1b[32mRedis (BullMQ) 异步队列:\x1b[0m 已连接 (192.168.2.32:6379)');
  } catch (err) {
    console.error('❌ \x1b[31mRedis (BullMQ) 异步队列:\x1b[0m 连接失败！', err);
  }

  // 3. WebSocket (Socket.io)
  if (io) {
    console.log('✅ \x1b[32mWebSocket (Socket.io) 实时通讯:\x1b[0m 服务就绪');
  } else {
    console.log('⚠️ \x1b[33mWebSocket (Socket.io) 实时通讯:\x1b[0m 未初始化');
  }
  
  console.log('\x1b[36m--------------------------------------\x1b[0m\n');
}

// 启动服务器
const start = async () => {
  try {
    await app.listen({ port: Number(config.port) || 3001, host: config.host || '0.0.0.0' });
    
    // 初始化 WebSocket (必须在 listen 之后才能绑定 server)
    setupWebSocket(app.server);
    
    // 执行就绪检查
    await verifySystemReady();
    
    console.log(`📡 \x1b[32m后端服务已启动:\x1b[0m http://localhost:${config.port}`);
    console.log(`🌐 \x1b[32m局域网访问地址:\x1b[0m http://192.168.2.32:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { prisma };
