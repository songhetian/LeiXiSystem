// 注册考勤管理路由的辅助脚本
// 在 server/index.js 中添加以下代码来注册这些路由：

/*
// 注册考勤管理路由
fastify.register(require('./routes/attendance-clock'))
fastify.register(require('./routes/leave'))
fastify.register(require('./routes/overtime'))
fastify.register(require('./routes/makeup'))
fastify.register(require('./routes/attendance-stats'))
*/

// 或者使用 fastify-autoload 自动加载所有路由
/*
const autoload = require('@fastify/autoload')
const path = require('path')

fastify.register(autoload, {
  dir: path.join(__dirname, 'routes')
})
*/

console.log('考勤管理路由注册说明：')
console.log('1. 打卡管理: routes/attendance-clock.js')
console.log('2. 请假管理: routes/leave.js')
console.log('3. 加班管理: routes/overtime.js')
console.log('4. 补卡管理: routes/makeup.js')
console.log('5. 考勤统计: routes/attendance-stats.js')
console.log('')
console.log('请在 server/index.js 文件末尾（start() 函数之前）添加路由注册代码')
