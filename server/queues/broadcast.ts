import { Job } from 'bullmq';
import { prisma } from '../app';
import { registerWorker, QueueNames } from './base';
import { connection as redis } from '../lib/redis';

/**
 * 大规模广播异步分发 Worker
 */
export const broadcastWorker = registerWorker(QueueNames.BATCH_NOTIFY, async (job: Job) => {
  const { broadcastId, targetType, targetDepartments, targetRoles, targetUsers } = job.data;

  // 1. 物理还原目标用户计算逻辑
  let targetUserIds: number[] = [];

  if (targetType === 'all') {
    const users = await prisma.users.findMany({ where: { status: 'active' }, select: { id: true } });
    targetUserIds = users.map(u => u.id);
  } else if (targetType === 'department') {
    const depts = typeof targetDepartments === 'string' ? JSON.parse(targetDepartments) : targetDepartments;
    const users = await prisma.users.findMany({ 
      where: { department_id: { in: depts }, status: 'active' }, 
      select: { id: true } 
    });
    targetUserIds = users.map(u => u.id);
  } else if (targetType === 'role') {
    const roleNames = typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles;
    const users = await prisma.users.findMany({
      where: { 
        user_roles: { some: { roles: { name: { in: roleNames } } } },
        status: 'active'
      },
      select: { id: true }
    });
    targetUserIds = users.map(u => u.id);
  } else if (targetType === 'individual') {
    targetUserIds = typeof targetUsers === 'string' ? JSON.parse(targetUsers) : targetUsers;
  }

  if (targetUserIds.length === 0) return { recipientCount: 0 };

  // 2. 分批处理物理持久化 (Chunking) 以防止内存溢出
  const chunkSize = 1000;
  for (let i = 0; i < targetUserIds.length; i += chunkSize) {
    const chunk = targetUserIds.slice(i, i + chunkSize);
    
    // 物理还原：批量插入接收表
    await prisma.broadcast_recipients.createMany({
      data: chunk.map(uid => ({
        broadcast_id: broadcastId,
        user_id: uid,
        is_read: false
      })),
      skipDuplicates: true
    });

    // 实时推送通知 (利用 Redis Pub/Sub)
    for (const uid of chunk) {
      await redis.publish('system_notifications', JSON.stringify({
        userId: String(uid),
        category: 'broadcast',
        broadcastId
      }));
    }

    await job.updateProgress(Math.floor(((i + chunk.length) / targetUserIds.length) * 100));
  }

  return { recipientCount: targetUserIds.length };
});
