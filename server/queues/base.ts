import { Queue, Worker, Job } from 'bullmq';
import { connection } from '../lib/redis';
import { prisma } from '../app';

export enum QueueNames {
  IMPORT_QUALITY = 'import-quality',
  EXPORT_REPORT = 'export-report',
  BATCH_NOTIFY = 'batch-notify',
  SYSTEM_LOG = 'system-log',
}

const queues: Record<string, Queue> = {};

export const getQueue = (name: QueueNames) => {
  if (!queues[name]) {
    queues[name] = new Queue(name, { 
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }
    });
  }
  return queues[name];
};

// 3. 巅峰规约加固：任务全生命周期审计与实时通知 Worker
export const registerWorker = (name: QueueNames, processor: (job: Job) => Promise<any>) => {
  const worker = new Worker(name, async (job) => {
    // 1. 任务开始存证
    await prisma.async_task_logs.create({
      data: {
        job_id: job.id!,
        queue_name: name,
        task_type: job.name,
        status: 'active',
        payload: job.data as any,
        operator_id: job.data.operatorId || null,
        started_at: new Date()
      }
    });

    try {
      const result = await processor(job);
      
      // 2. 任务成功闭环
      await prisma.async_task_logs.updateMany({
        where: { job_id: job.id! },
        data: {
          status: 'completed',
          progress: 100,
          result: result as any,
          completed_at: new Date()
        }
      });

      // 物理分发：发送实时通知信号 (规约：通知闭环)
      if (job.data.operatorId) {
        await connection.publish('system_signals', JSON.stringify({
          action: 'TASK_COMPLETED',
          userId: job.data.operatorId,
          title: '后台任务已完成',
          message: `您提交的 [${name}] 任务处理成功`,
          jobId: job.id
        }));
      }

      return result;
    } catch (err: any) {
      // 3. 任务失败闭环
      await prisma.async_task_logs.updateMany({
        where: { job_id: job.id! },
        data: {
          status: 'failed',
          error_msg: err.message,
          completed_at: new Date()
        }
      });

      if (job.data.operatorId) {
        await connection.publish('system_signals', JSON.stringify({
          action: 'TASK_FAILED',
          userId: job.data.operatorId,
          title: '后台任务执行失败',
          message: `错误详情: ${err.message}`,
          jobId: job.id
        }));
      }
      throw err;
    }
  }, { connection });
  
  return worker;
};
