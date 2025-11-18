module.exports = function registerChatRoutes(fastify, pool) {
  // 会话相关 API
  fastify.register(require('./routes/chat/conversations'), { prefix: '/api/chat', mysql: pool });
  // 消息相关 API
  fastify.register(require('./routes/chat/messages'), { prefix: '/api/chat', mysql: pool });
  // 群组相关 API
  fastify.register(require('./routes/chat/groups'), { prefix: '/api/chat', mysql: pool });
  // 聊天室相关 API
  fastify.register(require('./routes/chat/rooms'), { prefix: '/api/chat', mysql: pool });
  // 好友相关 API
  fastify.register(require('./routes/chat/contacts'), { prefix: '/api/chat', mysql: pool });
  // 文件上传 API (chat specific, if needed, otherwise use existing /api/upload)
  // fastify.register(require('./routes/chat/uploads'), { prefix: '/api/chat', mysql: pool });
}