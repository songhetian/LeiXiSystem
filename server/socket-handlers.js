const { containsSensitiveWords } = require('./utils/sensitiveWords');

module.exports = function (io, fastify) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User connection events
    socket.on('user:online', async (userId) => {
      console.log(`User ${userId} is online. Socket ID: ${socket.id}`);
      // Store user-socket mapping in Redis
      await fastify.redis.set(`user:${userId}:socketId`, socket.id);
      // Also store socketId-userId mapping for easy lookup on disconnect
      await fastify.redis.set(`socket:${socket.id}:userId`, userId);
      socket.join(`user-${userId}`); // Join the user-specific room
      io.emit('user:status', { userId, status: 'online' }); // Notify all clients about online status
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      // Retrieve userId from socketId
      const userId = await fastify.redis.get(`socket:${socket.id}:userId`);
      if (userId) {
        socket.leave(`user-${userId}`); // Leave the user-specific room
        await fastify.redis.del(`user:${userId}:socketId`);
        await fastify.redis.del(`socket:${socket.id}:userId`);
        io.emit('user:status', { userId, status: 'offline' }); // Notify all clients about offline status
      }
    });

    // Message events
    socket.on('message:send', async (messageData) => {
      console.log('Message received:', messageData);
      const { conversation_id, sender_id, content, message_type, recipient_id } = messageData;

      // Check for sensitive words
      if (containsSensitiveWords(content)) {
        socket.emit('message:error', { originalMessage: messageData, error: 'Message contains sensitive words.' });
        return;
      }

      try {
        // 1. Save message to DB
        const { reply_to_message_id } = messageData;
        const [result] = await fastify.mysql.query(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type, reply_to_message_id)
           VALUES (?, ?, ?, ?, ?)`,
          [conversation_id, sender_id, content, message_type, reply_to_message_id || null]
        );
        const messageId = result.insertId;

        const newMessage = { id: messageId, ...messageData, created_at: new Date() };

        // 2. Emit message to recipient(s)
        // Determine conversation type and send message accordingly
        const [conversationRows] = await fastify.mysql.query(
          `SELECT type FROM conversations WHERE id = ?`,
          [conversation_id]
        );

        if (conversationRows.length === 0) {
          throw new Error('Conversation not found');
        }

        const conversationType = conversationRows[0].type;

        if (conversationType === 'single') {
          // For single chat, recipient_id is provided
          if (recipient_id) {
            const recipientSocketId = await fastify.redis.get(`user:${recipient_id}:socketId`);
            if (recipientSocketId) {
              io.to(recipientSocketId).emit('message:receive', newMessage);
              console.log(`Message sent to recipient ${recipient_id} via socket ${recipientSocketId}`);
            } else {
              console.log(`Recipient ${recipient_id} is offline. Store for offline delivery.`);
              // TODO: Store message for offline delivery
            }
          } else {
            console.warn('Single chat message received without recipient_id.');
          }
        } else if (conversationType === 'group' || conversationType === 'room') {
          // For group/room chat, get all members of the conversation
          const [memberRows] = await fastify.mysql.query(
            `SELECT user_id FROM conversation_members WHERE conversation_id = ?`,
            [conversation_id]
          );

          for (const member of memberRows) {
            // Don't send back to sender if they are already connected
            if (member.user_id === sender_id) {
                // Optionally, send a confirmation to the sender's socket if needed
                // socket.emit('message:sent', newMessage);
                continue;
            }

            const memberSocketId = await fastify.redis.get(`user:${member.user_id}:socketId`);
            if (memberSocketId) {
              io.to(memberSocketId).emit('message:receive', newMessage);
              console.log(`Message sent to member ${member.user_id} of conversation ${conversation_id} via socket ${memberSocketId}`);
            } else {
              console.log(`Member ${member.user_id} of conversation ${conversation_id} is offline. Store for offline delivery.`);
              // TODO: Store message for offline delivery
            }
          }
        }

        // Also emit to sender's other devices if any
        // This requires more sophisticated user-socket management (e.g., multiple sockets per user)
        // For now, we assume one socket per user.

      } catch (error) {
        console.error('Error sending message:', error);
        // Emit an error back to the sender
        socket.emit('message:error', { originalMessage: messageData, error: error.message });
      }
    });

    socket.on('message:recall', (data) => {
      console.log('Message recall:', data);
      // Update message status in DB
      // Emit recall event to conversation members
    });

    socket.on('message:read', async ({ conversationId, readerId, messageIds }) => {
      console.log(`Messages ${messageIds} in conversation ${conversationId} read by user ${readerId}`);
      try {
        // Update message_status in DB
        if (messageIds && messageIds.length > 0) {
          const placeholders = messageIds.map(() => '?').join(',');
          await fastify.mysql.query(
            `INSERT INTO message_status (message_id, user_id, status, read_at)
             VALUES ${messageIds.map(msgId => `(?, ?, 'read', NOW())`).join(', ')}
             ON DUPLICATE KEY UPDATE status = 'read', read_at = NOW()`,
            messageIds.flatMap(msgId => [msgId, readerId])
          );
        }

        // Emit read receipt to sender (if sender is online)
        // This requires knowing the sender of each message, which is not in the current data.
        // For simplicity, let's assume we emit to all members of the conversation for now.
        const [memberRows] = await fastify.mysql.query(
          `SELECT user_id FROM conversation_members WHERE conversation_id = ?`,
          [conversationId]
        );

        for (const member of memberRows) {
          if (member.user_id !== readerId) { // Don't send read receipt to the reader themselves
            const memberSocketId = await fastify.redis.get(`user:${member.user_id}:socketId`);
            if (memberSocketId) {
              io.to(memberSocketId).emit('message:read:receipt', { conversationId, readerId, messageIds });
            }
          }
        }

      } catch (error) {
        console.error('Error handling message:read event:', error);
      }
    });

    socket.on('message:typing', async ({ conversationId, userId, isTyping }) => {
      console.log(`User ${userId} in conversation ${conversationId} is typing: ${isTyping}`);
      try {
        // Get all members of the conversation
        const [memberRows] = await fastify.mysql.query(
          `SELECT user_id FROM conversation_members WHERE conversation_id = ?`,
          [conversationId]
        );

        for (const member of memberRows) {
          if (member.user_id !== userId) { // Don't send typing indicator back to the sender
            const memberSocketId = await fastify.redis.get(`user:${member.user_id}:socketId`);
            if (memberSocketId) {
              io.to(memberSocketId).emit('message:typing', { conversationId, userId, isTyping });
            }
          }
        }
      } catch (error) {
        console.error('Error handling message:typing event:', error);
      }
    });

    // Conversation events
    socket.on('conversation:create', (data) => {
      console.log('Conversation create:', data);
      // Create conversation in DB
      // Emit new conversation to participants
    });

    socket.on('conversation:update', (data) => {
      console.log('Conversation update:', data);
      // Update conversation in DB
      // Emit update to participants
    });

    socket.on('conversation:delete', (data) => {
      console.log('Conversation delete:', data);
      // Delete conversation in DB
      // Emit delete event to participants
    });

    // Group events
    socket.on('group:create', (data) => {
      console.log('Group create:', data);
      // Create group in DB
      // Emit new group to members
    });

    socket.on('group:member:join', (data) => {
      console.log('Group member join:', data);
      // Add member to group in DB
      // Emit join event to group members
    });

    socket.on('group:member:leave', (data) => {
      console.log('Group member leave:', data);
      // Remove member from group in DB
      // Emit leave event to group members
    });

    socket.on('group:update', (data) => {
      console.log('Group update:', data);
      // Update group in DB
      // Emit update to group members
    });

    // Chat room events
    socket.on('room:join', (data) => {
      console.log('Room join:', data);
      // Add member to room in DB
      // Join socket to room
      // socket.join(data.roomId);
      // Emit join event to room members
    });

    socket.on('room:leave', (data) => {
      console.log('Room leave:', data);
      // Remove member from room in DB
      // Leave socket from room
      // socket.leave(data.roomId);
      // Emit leave event to room members
    });

    socket.on('room:message', (data) => {
      console.log('Room message:', data);
      // Save message to DB
      // Emit message to room members
      // io.to(data.roomId).emit('room:message', data);
    });
  });
};