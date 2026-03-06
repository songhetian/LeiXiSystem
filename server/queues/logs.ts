import { Job } from 'bullmq';
import { prisma } from '../app';
import { registerWorker, QueueNames } from './base';

/**
 * 工业级操作日志异步写入 Worker
 */
export const systemLogWorker = registerWorker(QueueNames.SYSTEM_LOG, async (job: Job) => {
  const data = job.data;

  // 物理还原旧版 operation_logs 结构
  await prisma.operation_logs.create({
    data: {
      user_id: data.userId,
      username: data.username,
      real_name: data.realName,
      module: data.module,
      action: data.action,
      method: data.method,
      url: data.url,
      params: data.params ? JSON.stringify(data.params) : null,
      ip: data.ip,
      user_agent: data.userAgent,
      status: data.status ?? true,
      error_msg: data.errorMsg,
      created_at: new Date()
    }
  });

  return { success: true };
});
