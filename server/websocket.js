const socketIO = require('socket.io')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('./config')

// 存储用户连接 userId -> Set of socket ids
const userConnections = new Map()

/**
 * 设置WebSocket服务器
 */
function setupWebSocket(server, redis, getPool) {
  const io = socketIO(server, {
    cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
    // 强制优先使用 websocket，减少长轮询(Polling)带来的内存损耗
    transports: ['websocket', 'polling'],
    allowEIO3: true
  })

  io.redis = redis;

  // --- Redis Pub/Sub Integration ---
  if (redis) {
    console.log('🔌 [WebSocket] 正在初始化 Redis 订阅客户端...');
    // 关键修复：直接复制主实例的配置选项，确保 100% 继承账号密码和保活设置
    const subClient = redis.duplicate();
    
    subClient.on('connect', () => {
      console.log('✅ [Redis Pub/Sub] 订阅客户端已建立连接');
    });

    subClient.on('ready', () => {
      console.log('🔌 [Redis Pub/Sub] 订阅客户端就绪，开始订阅频道...');
      subClient.subscribe('chat_messages', 'system_notifications', (err, count) => {
          if (err) console.error('❌ [Redis Pub/Sub] 订阅失败:', err);
          else console.log(`🚀 [Redis Pub/Sub] 订阅成功，当前监听频道: ${count}`);
      });
    });

    subClient.on('error', (err) => {
      console.error('❌ [Redis Pub/Sub] 客户端异常:', err.message);
    });

    subClient.on('message', (channel, message) => {
        try {
            const data = JSON.parse(message);
            if (channel === 'chat_messages') {
                if (data.group_id) io.to(`group_${data.group_id}`).emit('chat_message', data);
                else if (data.receiver_id) io.to(`user_${data.receiver_id}`).emit('chat_message', data);
            } else if (channel === 'system_notifications') {
                if (data.category === 'kicked_out') {
                    // 处理单设备登录踢人逻辑
                    console.log(`🚨 [WebSocket] 捕获踢人指令，目标用户: ${data.userId}`);
                    io.to(`user_${data.userId}`).emit('kicked_out', data);
                    
                    // 强制清理该用户的本地连接映射
                    setTimeout(() => {
                        const userIdStr = String(data.userId);
                        const socketIds = userConnections.get(userIdStr);
                        if (socketIds) {
                            socketIds.forEach(sid => {
                                const s = io.sockets.sockets.get(sid);
                                if (s) {
                                    s.emit('force_logout'); // 二次通知确认
                                    s.disconnect(true);
                                }
                            });
                            userConnections.delete(userIdStr);
                        }
                    }, 1500);
                    return;
                }
                const event = data.category === 'broadcast' ? 'new_broadcast' : (data.category === 'memo' ? 'new_memo' : 'new_notification');
                if (data.userId) {
                    io.to(`user_${data.userId}`).emit(event, data);
                } else {
                    // 如果没有 userId，广播给所有人
                    io.emit(event, data);
                }
            }
        } catch (e) { console.error('Redis 消息解析失败:', e); }
    });
  }

  if (redis) {
    redis.del('online_users').catch(err => console.error('Redis 清理在线列表失败:', err));
  }

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      // 关键修复：从 config 模块安全获取 SECRET，并增加格式校验
      const config = require('./config');
      const secret = config.JWT_SECRET;
      
      const decoded = jwt.verify(token, secret);
      socket.userId = String(decoded.id); 
      socket.username = decoded.username || decoded.real_name;
      next();
    } catch (err) { 
      console.error(`❌ [WebSocket Auth] 认证失败: ${err.message}`);
      // 返回明确的认证错误，不要让服务器 500
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.userId
    console.log(`✅ [WebSocket] 用户 ${socket.username} (ID: ${userId}) 已连接`)

    if (!userConnections.has(userId)) userConnections.set(userId, new Set())
    userConnections.get(userId).add(socket.id)

    // 记录在线状态
    if (redis) {
      await redis.sadd('online_users', userId);
      console.log(`📡 [Redis] 上线登记成功: ${userId}`);
      
      // 强制触发一次全局统计广播
      const count = await redis.scard('online_users');
      io.emit('online_users_count', { count });
    }

    socket.join(`user_${userId}`)
    socket.emit('connected', { message: '已连接', userId: userId, timestamp: new Date() })

    // --- 关键增强：上线自动推送全量未读数 ---
    const pushTotalUnreadCount = async () => {
        try {
            const pool = getPool ? getPool() : null;
            if (!pool) return;
            
            // 统计普通通知
            const [[notifResult]] = await pool.query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
                [userId]
            );
            
            // 统计系统广播
            const [[broadcastResult]] = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM broadcast_recipients br
                 INNER JOIN broadcasts b ON br.broadcast_id = b.id
                 WHERE br.user_id = ? AND br.is_read = FALSE
                 AND (b.expires_at IS NULL OR b.expires_at > NOW())`,
                [userId]
            );

            const total = (notifResult.count || 0) + (broadcastResult.count || 0);
            socket.emit('unread_count', { count: total });
            
            // 同步更新 Redis 缓存 (如果启用)
            if (redis) {
                await redis.set(`user:unread_count:${userId}`, total, 'EX', 3600);
            }
        } catch (err) {
            console.error('Failed to push initial unread count:', err);
        }
    };

    await pushTotalUnreadCount();

    // 接收心跳时补录状态 (防止Redis意外丢失)
    socket.on('ping', async () => {
      if (redis) await redis.sadd('online_users', userId);
      socket.emit('pong', { timestamp: Date.now() })
    })

    // --- Notification Events ---
    
    // 响应未读数请求
    socket.on('request_unread_count', async () => {
        await pushTotalUnreadCount();
    });

    // --- Chat Events ---

    // 加入群组房间
    socket.on('join_group', (groupId) => {
        socket.join(`group_${groupId}`);
        console.log(`User ${userId} joined group_${groupId}`);
    });

    // 离开群组房间
    socket.on('leave_group', (groupId) => {
        socket.leave(`group_${groupId}`);
    });

    // 标记已读 (物理同步 + 缓存清理)
    socket.on('mark_read', async (groupId) => {
        try {
            // 1. 清理 Redis 实时计数
            if (redis) {
                await redis.hdel(`chat:unread:${userId}`, groupId);
            }

            // 2. 物理同步回 MySQL (持久化)
            const pool = getPool ? getPool() : null;
            if (pool) {
                // 获取最新一条消息 ID
                const [lastMsg] = await pool.query(
                    'SELECT id FROM chat_messages WHERE group_id = ? ORDER BY id DESC LIMIT 1',
                    [groupId]
                );
                const finalId = lastMsg[0]?.id || 0;

                await pool.query(
                    'UPDATE chat_group_members SET last_read_message_id = ? WHERE group_id = ? AND user_id = ?',
                    [finalId, groupId, userId]
                );
                console.log(`📌 [WebSocket] User ${userId} marked group ${groupId} as read (LastID: ${finalId})`);
            }
        } catch (err) {
            console.error('❌ [WebSocket] Mark Read Persistence Error:', err);
        }
    });

    // 发送消息
    socket.on('send_message', async (data) => {
        const pool = getPool ? getPool() : null;
        if (!pool || !redis) return;

        try {
            const { targetId, targetType, content, type = 'text', fileUrl } = data;
            
            // 使用全局队列处理 (由 index.js 初始化并挂载到 io 上)
            if (!io.messageQueue) {
                const MessageQueue = require('./utils/messageQueue');
                io.messageQueue = new MessageQueue(pool, redis);
                await io.messageQueue.initSequence();
            }

            // 1. 快速入队并获取 ID
            const { getUserProfile } = require('./utils/personnelClosure');
            let senderAvatar = socket.handshake.auth.avatar;
            
            // 如果前端没传头像，尝试从缓存/数据库补全
            if (!senderAvatar) {
                try {
                    const profile = await getUserProfile(pool, redis, userId);
                    senderAvatar = profile?.avatar;
                } catch (e) { console.error('补全头像失败:', e); }
            }

            const msgToQueue = {
                sender_id: userId,
                group_id: targetId,
                content,
                msg_type: type,
                file_url: fileUrl,
                sender_name: socket.username,
                sender_avatar: senderAvatar
            };

            const savedMsg = await io.messageQueue.enqueue(msgToQueue);

            // 补全发送者信息 (用于前端显示，无需查库)
            // 如果前端没传 avatar，可以在这里通过 socket 获取
            if (!savedMsg.sender_name) savedMsg.sender_name = socket.username;

            // 2. Redis 极速广播 (不等待写库)
            await redis.publish('chat_messages', JSON.stringify(savedMsg));
            
            // 更新最后一条消息预览
            const preview = {
                content: type === 'text' ? content : (type === 'image' ? '[图片]' : '[文件]'),
                time: savedMsg.created_at,
                sender: savedMsg.sender_name
            };
            await redis.set(`chat:group:${targetId}:last_msg`, JSON.stringify(preview), 'EX', 86400 * 7);

            // 维护最近消息历史缓存 (List)
            const historyKey = `chat:group:${targetId}:recent_messages`;
            await redis.lpush(historyKey, JSON.stringify(savedMsg));
            await redis.ltrim(historyKey, 0, 99);
            await redis.expire(historyKey, 86400 * 3);

            // --- 关键修复：发送即已读 ---
            // 立即推进发送者的已读指针，防止刷新后显示为未读
            if (pool && savedMsg.id) {
                await pool.query(
                    'UPDATE chat_group_members SET last_read_message_id = ? WHERE group_id = ? AND user_id = ?',
                    [savedMsg.id, targetId, userId]
                );
            }

            // --- 性能优化：在 Redis 中维护未读计数 ---
            // 获取群组成员列表 (排除发送者)
            const membersKey = `chat:group:${targetId}:members`;
            const members = await redis.smembers(membersKey);
            
            if (members.length > 0) {
                const pipeline = redis.pipeline();
                members.forEach(memberId => {
                    if (String(memberId) !== String(userId)) {
                        // 增加该用户在该群组的未读数
                        pipeline.hincrby(`chat:unread:${memberId}`, targetId, 1);
                    }
                });
                await pipeline.exec();
            }

        } catch (err) {
            console.error('Chat Send Error:', err);
            socket.emit('error', { message: '消息发送失败' });
        }
    });

    socket.on('disconnect', async (reason) => {
      console.log(`❌ [WebSocket] 用户 ${socket.username} 已断开: ${reason}`)
      const connections = userConnections.get(userId)
      if (connections) {
        connections.delete(socket.id)
        if (connections.size === 0) {
          userConnections.delete(userId)
          if (redis) {
            await redis.srem('online_users', userId);
            console.log(`📡 [Redis] 下线移除成功: ${userId}`);
          }
        }
      }
    })
  })

  return io
}

function sendNotificationToUser(io, userId, notification) {
  if (io.redis) {
      io.redis.publish('system_notifications', JSON.stringify({ ...notification, userId }));
  } else {
      io.to(`user_${userId}`).emit('new_notification', notification)
  }
}

function broadcastNotification(io, userIds, notification) {
  userIds.forEach(userId => sendNotificationToUser(io, userId, notification));
}

function sendBroadcast(io, userIds, broadcast) {
  // 1. 如果有 Redis，通过 Redis 发布实现跨服务器同步（这是推荐方式）
  if (io.redis) {
    if (!userIds || userIds.length === 0) {
      // 全体广播
      io.redis.publish('system_notifications', JSON.stringify({ ...broadcast, category: 'broadcast' }));
    } else {
      // 定向广播
      userIds.forEach(userId => {
        io.redis.publish('system_notifications', JSON.stringify({ ...broadcast, userId: String(userId), category: 'broadcast' }));
      });
    }
    return;
  }

  // 2. 本地 Socket.io 推送兜底
  if (!userIds || userIds.length === 0) {
    // 全体广播
    io.emit('new_broadcast', broadcast);
  } else {
    // 定向广播给在线用户
    userIds.forEach(userId => {
      io.to(`user_${String(userId)}`).emit('new_broadcast', broadcast);
    });
  }
}

function sendMemoToUser(io, userId, memo) {
  if (io.redis) {
      io.redis.publish('system_notifications', JSON.stringify({ ...memo, userId, category: 'memo' }));
  } else {
      io.to(`user_${userId}`).emit('new_memo', memo)
  }
}

/**
 * 强制断开用户的所有Socket连接
 */
function forceDisconnectUser(io, userId) {
  const socketIds = userConnections.get(String(userId));
  if (socketIds) {
    socketIds.forEach(sid => {
      const socket = io.sockets.sockets.get(sid);
      if (socket) {
        socket.emit('kicked_out', { message: '您的账号已被停用或删除' });
        socket.disconnect(true);
      }
    });
    userConnections.delete(String(userId));
    console.log(`🚨 [WebSocket] 已强制切断用户 ${userId} 的所有连接`);
  }
}

async function getOnlineUserCount(io) {
  if (io.redis) return await io.redis.scard('online_users');
  return userConnections.size;
}

module.exports = { 
  setupWebSocket, 
  sendNotificationToUser, 
  broadcastNotification, 
  sendBroadcast, 
  sendMemoToUser,
  getOnlineUserCount,
  forceDisconnectUser
}
