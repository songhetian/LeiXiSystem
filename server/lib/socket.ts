import { Server, Socket } from 'socket.io';
import { prisma } from '../app';
import { connection as redis } from './redis';

export let io: Server | null = null;

export function setupWebSocket(server: any) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    if (!userId) return socket.disconnect();

    // 状态闭环：HSET 存证
    await redis.hset('online_status', userId, JSON.stringify({
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    }));

    socket.join(`user_${userId}`);

    // --- 核心修复：带权限校验的消息发送 ---
    socket.on('send_message', async (data: { targetId: number, content: string, type?: string }) => {
      try {
        const { targetId, content, type = 'text' } = data;

        // 1. 规约执行：物理权限校验闭环 (O(1) 性能)
        const isMember = await redis.sismember(`chat:group:${targetId}:members`, userId);
        if (!isMember) {
          return socket.emit('error', { message: '逻辑拒绝：您不属于该群组成员，无法发送消息' });
        }

        // 2. 事务原子性闭环
        const message = await prisma.chat_messages.create({
          data: {
            sender_id: Number(userId),
            group_id: targetId,
            content,
            msg_type: type as any,
          }
        });

        // 3. 物理分发
        await redis.publish('chat_messages', JSON.stringify({
          ...message,
          sender_name: (socket as any).username,
        }));

        // 4. 维护未读计数闭环
        const members = await redis.smembers(`chat:group:${targetId}:members`);
        const pipeline = redis.pipeline();
        members.forEach(mid => {
          if (mid !== userId) {
            pipeline.hincrby(`chat:unread:${mid}`, String(targetId), 1);
          }
        });
        await pipeline.exec();

      } catch (e) {
        console.error('Message Send Error:', e);
      }
    });

    socket.on('disconnect', async () => {
      await redis.hdel('online_status', userId);
    });
  });
}
