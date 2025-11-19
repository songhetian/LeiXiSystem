// 注册假期管理相关路由
const path = require('path')

module.exports = async function registerVacationRoutes(fastify) {
  // 假期余额管理
  await fastify.register(require('./routes/vacation-balance'))
  console.error('✅ 假期余额路由已注册')

  // 调休申请管理
  await fastify.register(require('./routes/compensatory-leave'))
  console.error('✅ 调休申请路由已注册')

  // 假期统计与导出
  await fastify.register(require('./routes/vacation-stats'))
  console.error('✅ 假期统计路由已注册')
}
