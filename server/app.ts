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

import assetRoutes from './routes/assets';
import reimbursementRoutes from './routes/reimbursement';
import qualityRoutes from './routes/quality';
import attendanceRoutes from './routes/attendance';
import shiftRoutes from './routes/attendance-shifts';
import broadcastRoutes from './routes/broadcasts';
import hrChangeRoutes from './routes/hr-changes';
import chatRoutes from './routes/chat';
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
  secret: process.env.JWT_SECRET || 'leixi-secret-v2',
});

// 注册业务路由
app.register(assetRoutes);
app.register(reimbursementRoutes);
app.register(qualityRoutes);
app.register(attendanceRoutes);
app.register(shiftRoutes);
app.register(broadcastRoutes);
app.register(hrChangeRoutes);
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
app.register(knowledgeRoutes);

// 规约执行：全局错误闭环加固
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);

  // Zod 校验错误
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      code: 'VALIDATION_ERROR',
      message: '数据校验失败',
      details: error.validation
    });
  }

  // 默认错误响应
  reply.status(error.statusCode || 500).send({
    success: false,
    code: (error as any).code || 'INTERNAL_SERVER_ERROR',
    message: error.message || '系统繁忙，请稍后再试',
  });
});

// 健康检查示例 (包含 Schema 序列化)
app.get('/health', {
  schema: {
    response: {
      200: z.object({
        status: z.string(),
        database: z.string(),
        timestamp: z.string(),
      }),
    },
  },
}, async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return {
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
});

// 启动服务器
const start = async () => {
  try {
    const port = Number(process.env.SERVER_PORT) || 3002; // v2 后端使用 3002，避免冲突
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 v2 后端已启动: http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { prisma };
