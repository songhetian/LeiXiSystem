module.exports = async function (fastify, options) {
  const { mysql } = options;

  // GET /api/chat/conversations/:id/messages - 获取消息列表（分页）
  fastify.get('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params; // Conversation ID
    const { limit = 50, offset = 0 } = request.query; // Pagination parameters

    try {
      const [rows] = await mysql.query(
        `SELECT m.*, u.real_name as sender_name, u.avatar as sender_avatar
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = ?
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [id, parseInt(limit), parseInt(offset)]
      );

      // Reverse the order to display oldest messages first in UI
      const messages = rows.reverse();

      return { success: true, data: messages };
    } catch (error) {
      console.error('Error fetching messages:', error);
      reply.code(500).send({ success: false, message: 'Failed to fetch messages' });
    }
  });

  // POST /api/chat/messages - 发送消息
  fastify.post('/messages', async (request, reply) => {
    // Implementation for sending a message
    return { message: 'Send message' };
  });

  // PUT /api/chat/messages/:id/recall - 撤回消息
  fastify.put('/messages/:id/recall', async (request, reply) => {
    const { id } = request.params;
    // Implementation for recalling a message
    return { message: `Recall message ${id}` };
  });

  // DELETE /api/chat/messages/:id - 删除消息
  fastify.delete('/messages/:id', async (request, reply) => {
    const { id } = request.params;
    // Implementation for deleting a message
    return { message: `Delete message ${id}` };
  });

  // POST /api/chat/messages/:id/collect - 收藏消息
  fastify.post('/messages/:id/collect', async (request, reply) => {
    const { id } = request.params; // Message ID
    const { userId } = request.body; // User collecting the message

    try {
      // Check if already collected
      const [existing] = await mysql.query(
        `SELECT id FROM collected_messages WHERE user_id = ? AND message_id = ?`,
        [userId, id]
      );
      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: 'Message already collected' });
      }

      await mysql.query(
        `INSERT INTO collected_messages (user_id, message_id) VALUES (?, ?)`,
        [userId, id]
      );
      return { success: true, message: 'Message collected successfully' };
    } catch (error) {
      console.error('Error collecting message:', error);
      reply.code(500).send({ success: false, message: 'Failed to collect message' });
    }
  });

  // DELETE /api/chat/messages/:id/uncollect - 取消收藏消息
  fastify.delete('/messages/:id/uncollect', async (request, reply) => {
    const { id } = request.params; // Message ID
    const { userId } = request.body; // User uncollecting the message

    try {
      await mysql.query(
        `DELETE FROM collected_messages WHERE user_id = ? AND message_id = ?`,
        [userId, id]
      );
      return { success: true, message: 'Message uncollected successfully' };
    } catch (error) {
      console.error('Error uncollecting message:', error);
      reply.code(500).send({ success: false, message: 'Failed to uncollect message' });
    }
  });

  // GET /api/chat/collected-messages - 获取收藏消息列表
  fastify.get('/collected-messages', async (request, reply) => {
    const { userId } = request.query; // User ID to fetch collected messages for

    try {
      const [rows] = await mysql.query(
        `SELECT cm.*, m.content, m.message_type, m.file_url, m.file_name, m.file_size, m.created_at as message_created_at, u.real_name as sender_name
         FROM collected_messages cm
         JOIN messages m ON cm.message_id = m.id
         JOIN users u ON m.sender_id = u.id
         WHERE cm.user_id = ?
         ORDER BY cm.created_at DESC`,
        [userId]
      );
      return { success: true, data: rows };
    } catch (error) {
      console.error('Error fetching collected messages:', error);
      reply.code(500).send({ success: false, message: 'Failed to fetch collected messages' });
    }
  });

  // POST /api/chat/messages/:id/forward - 转发消息
  fastify.post('/messages/:id/forward', async (request, reply) => {
    const { id } = request.params; // Original message ID
    const { targetConversationIds, senderId } = request.body; // Array of target conversation IDs

    if (!targetConversationIds || targetConversationIds.length === 0) {
      return reply.code(400).send({ success: false, message: 'No target conversations specified' });
    }

    try {
      // Fetch the original message content
      const [originalMessageRows] = await mysql.query(
        `SELECT * FROM messages WHERE id = ?`,
        [id]
      );

      if (originalMessageRows.length === 0) {
        return reply.code(404).send({ success: false, message: 'Original message not found' });
      }

      const originalMessage = originalMessageRows[0];
      const forwardedMessages = [];

      for (const targetConvId of targetConversationIds) {
        // Insert a new message for each target conversation
        const [result] = await mysql.query(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            targetConvId,
            senderId, // The user who is forwarding the message
            originalMessage.content,
            originalMessage.message_type,
            originalMessage.file_url,
            originalMessage.file_name,
            originalMessage.file_size
          ]
        );
        forwardedMessages.push({ id: result.insertId, conversation_id: targetConvId });

        // TODO: Emit WebSocket event to notify participants of the target conversation
        // This would involve fetching members of targetConvId and sending 'message:receive'
      }

      return { success: true, message: 'Messages forwarded successfully', forwardedMessages };
    } catch (error) {
      console.error('Error forwarding message:', error);
      reply.code(500).send({ success: false, message: 'Failed to forward message' });
    }
  });

  // PUT /api/chat/messages/:id/read - 标记已读
  fastify.put('/messages/:id/read', async (request, reply) => {
    const { id } = request.params;
    // Implementation for marking message as read
    return { message: `Mark message ${id} as read` };
  });

  // DELETE /api/chat/conversations/:id/messages - 清空会话消息
  fastify.delete('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params; // Conversation ID
    // In a real application, you might want to implement soft delete or archive
    try {
      await mysql.query(`DELETE FROM messages WHERE conversation_id = ?`, [id]);
      return { success: true, message: 'Chat history cleared successfully' };
    } catch (error) {
      console.error('Error clearing chat history:', error);
      reply.code(500).send({ success: false, message: 'Failed to clear chat history' });
    }
  });

  // GET /api/chat/messages/search - 搜索消息
  fastify.get('/messages/search', async (request, reply) => {
    const { conversationId, query, userId } = request.query; // userId for global search context
    let sql = `
      SELECT m.*, u.real_name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.content LIKE ?
    `;
    const params = [`%${query}%`];

    if (conversationId) {
      sql += ` AND m.conversation_id = ?`;
      params.push(conversationId);
    }
    // For global search, might need to filter by conversations the user is a part of
    // This would involve joining with conversation_members table

    sql += ` ORDER BY m.created_at DESC LIMIT 100`; // Limit results for performance

    try {
      const [rows] = await mysql.query(sql, params);
      return { success: true, data: rows };
    } catch (error) {
      console.error('Error searching messages:', error);
      reply.code(500).send({ success: false, message: 'Failed to search messages' });
    }
  });
};
