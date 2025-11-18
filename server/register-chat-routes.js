module.exports = async function registerChatRoutes(fastify, opts) {
  // 使用 fastify 插件约定，opts 可选携带 mysql，但优先使用 fastify.mysql
  const pool = fastify.mysql || opts?.mysql

  fastify.register(require('./routes/chat/conversations'), { prefix: '/api/chat', mysql: pool })
  fastify.register(require('./routes/chat/messages'), { prefix: '/api/chat', mysql: pool })
  fastify.register(require('./routes/chat/groups'), { prefix: '/api/chat', mysql: pool })
  fastify.register(require('./routes/chat/rooms'), { prefix: '/api/chat', mysql: pool })
  // fastify.register(require('./routes/chat/contacts'), { prefix: '/api/chat', mysql: pool })
  // fastify.register(require('./routes/chat/uploads'), { prefix: '/api/chat', mysql: pool })
}