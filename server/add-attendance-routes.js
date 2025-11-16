// 将以下代码添加到 server/index.js 文件中
// 在 "const start = async () => {" 这一行之前添加

// ==================== 考勤管理路由 ====================
fastify.register(require('./routes/attendance-clock'))
fastify.register(require('./routes/leave'))
fastify.register(require('./routes/overtime'))
fastify.register(require('./routes/makeup'))
fastify.register(require('./routes/attendance-stats'))

//console.log('✅ 考勤管理路由已注册')
