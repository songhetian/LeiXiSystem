module.exports = async function (fastify, options) {
  const { mysql } = options;

  // GET /api/chat/conversations - 获取会话列表
  fastify.get('/conversations', async (request, reply) => {
    const { userId } = request.query; // Assuming userId is passed for personalized conversation lists

    if (!userId) {
      return reply.code(400).send({ success: false, message: 'User ID is required' });
    }

    const cacheKey = `conversations:user:${userId}`;
    const cachedConversations = await fastify.redis.get(cacheKey);

    if (cachedConversations) {
      console.log('Serving conversations from cache for user:', userId);
      return { success: true, data: JSON.parse(cachedConversations) };
    }

    try {
      // Fetch conversations for the user from the database
      const [rows] = await mysql.query(
        `SELECT c.id, c.type, c.name, c.avatar, c.description,
                (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
                (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessageTime,
                (SELECT COUNT(*) FROM message_status ms WHERE ms.message_id IN (SELECT id FROM messages WHERE conversation_id = c.id) AND ms.user_id = ? AND ms.status != 'read') as unreadCount
         FROM conversations c
         JOIN conversation_members cm ON c.id = cm.conversation_id
         WHERE cm.user_id = ?
         ORDER BY lastMessageTime DESC`,
        [userId, userId]
      );

      // Cache the result
      await fastify.redis.set(cacheKey, JSON.stringify(rows), 'EX', 60); // Cache for 60 seconds

      return { success: true, data: rows };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      reply.code(500).send({ success: false, message: 'Failed to fetch conversations' });
    }
  });

  // GET /api/chat/conversations/:id - 获取会话详情
  fastify.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params;
    // Implementation for fetching conversation details
    return { message: `Get conversation details for ${id}` };
  });

  // POST /api/chat/conversations - 创建会话
  fastify.post('/conversations', async (request, reply) => {
    // Implementation for creating a conversation
    return { message: 'Create conversation' };
  });

  // PUT /api/chat/conversations/:id - 更新会话信息
  fastify.put('/conversations/:id', async (request, reply) => {
    const { id } = request.params;
    // Implementation for updating conversation info
    return { message: `Update conversation info for ${id}` };
  });

  // DELETE /api/chat/conversations/:id - 删除会话
  fastify.delete('/conversations/:id', async (request, reply) => {
    const { id } = request.params;
    // Implementation for deleting a conversation
    return { message: `Delete conversation ${id}` };
  });

  // PUT /api/chat/conversations/:id/pin - 置顶会话
  fastify.put('/conversations/:id/pin', async (request, reply) => {
    const { id } = request.params;
    // Implementation for pinning a conversation
    return { message: `Pin conversation ${id}` };
  });

  // PUT /api/chat/conversations/:id/mute - 免打扰设置
  fastify.put('/conversations/:id/mute', async (request, reply) => {
    const { id } = request.params;
    // Implementation for muting a conversation
    return { message: `Mute conversation ${id}` };
  });
};