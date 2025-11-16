// 注册所有考勤管理路由
// 在 server/index.js 文件末尾添加以下代码：

/*
// ==================== 考勤管理路由 ====================
fastify.register(require('./routes/attendance-clock'), { mysql: pool })
fastify.register(require('./routes/leave'), { mysql: pool })
fastify.register(require('./routes/overtime'), { mysql: pool })
fastify.register(require('./routes/makeup'), { mysql: pool })
fastify.register(require('./routes/attendance-stats'), { mysql: pool })
*/

// 或者使用以下方式注册（如果使用 fastify-plugin）:
/*
const attendanceClock = require('./routes/attendance-clock')
const leave = require('./routes/leave')
const overtime = require('./routes/overtime')
const makeup = require('./routes/makeup')
const attendanceStats = require('./routes/attendance-stats')

fastify.register(attendanceClock)
fastify.register(leave)
fastify.register(overtime)
fastify.register(makeup)
fastify.register(attendanceStats)
*/

module.exports = function registerAttendanceRoutes(fastify, pool) {
  // 打卡管理
  fastify.register(require('./routes/attendance-clock'))
  // 请假管理
  fastify.register(require('./routes/leave'))
  // 加班管理
  fastify.register(require('./routes/overtime'))
  // 补卡管理
  fastify.register(require('./routes/makeup'))
  // 考勤统计
  fastify.register(require('./routes/attendance-stats'))
  // 考勤设置
  fastify.register(require('./routes/attendance-settings'))
}
