/**
 * 工作台首页统计 API
 */
const dayjs = require('dayjs');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  fastify.get('/api/dashboard/stats', async (request, reply) => {
    const { user_id } = request.query;
    if (!user_id) return reply.code(400).send({ success: false, message: 'Missing user_id' });

    const redis = fastify.redis;
    const cacheKey = `stats:dashboard:${user_id}`;

    try {
      const { extractUserPermissions } = require('../middleware/checkPermission');
      const permissions = await extractUserPermissions(request, pool);
      if (!permissions) return reply.code(401).send({ success: false });

      // 1. 尝试从 Redis 获取
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return { success: true, data: JSON.parse(cached) };
        }
      }

      const today = dayjs().format('YYYY-MM-DD');
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');

      // --- 1. 基础信息 (通用) ---
      const [userRows] = await pool.query('SELECT real_name, username, department_id FROM users WHERE id = ?', [user_id]);
      const user = userRows[0];

      // --- 2. 待办事项总数 (性能优化) ---
      const [[{ pendingCount }]] = await pool.query(`
        SELECT (
          SELECT COUNT(*) FROM reimbursements WHERE status IN ('pending', 'approving')
        ) + (
          SELECT COUNT(*) FROM users WHERE status = 'pending'
        ) as pendingCount
      `);

      // --- 3. 角色特定数据 ---
      let adminStats = null;
      let personalStats = {};

      if (permissions.canViewAllDepartments) {
        // 管理员数据：合并查询提升性能
        const [[adminOverview]] = await pool.query(`
          SELECT 
            (SELECT COUNT(*) FROM employees WHERE status != "deleted") as totalEmployees,
            (SELECT COUNT(DISTINCT user_id) FROM attendance_records WHERE attendance_date = ?) as todayClockIn
        `, [today]);

        adminStats = {
          totalEmployees: adminOverview.totalEmployees,
          todayClockIn: adminOverview.todayClockIn
        };
      }

      // 个人数据 (员工/主管通用)
      // 性能优化：合并个人统计查询
      const [[personalOverview]] = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM attendance_records WHERE user_id = ? AND attendance_date >= ? AND (status = "absent" OR status = "late")) as absents,
          (SELECT clock_in_time FROM attendance_records WHERE user_id = ? AND attendance_date = ?) as clock_in,
          (SELECT clock_out_time FROM attendance_records WHERE user_id = ? AND attendance_date = ?) as clock_out
      `, [user_id, startOfMonth, user_id, today, user_id, today]);

      personalStats = {
        todayClock: personalOverview.clock_in ? { clock_in: personalOverview.clock_in, clock_out: personalOverview.clock_out } : null,
        monthAbsents: personalOverview.absents
      };

      const finalData = {
        user,
        pendingCount,
        adminStats,
        personalStats,
        serverTime: new Date()
      };

      // 优化：缓存 2 分钟，平衡实时性与压力
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(finalData), 'EX', 120);
      }

      return {
        success: true,
        data: finalData
      };
    } catch (error) {
      console.error('❌ [Dashboard] Stats Error:', error);
      return reply.code(500).send({
        success: false,
        message: '获取仪表盘统计失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      });
    }
  });
};
