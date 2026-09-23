/**
 * 管理员专属看板 API
 */
const dayjs = require('dayjs');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  fastify.get('/api/admin/dashboard/stats', async (request, reply) => {
    const redis = fastify.redis;
    const cacheKey = 'stats:admin_dashboard';
    try {
      const { extractUserPermissions } = require('../middleware/checkPermission');
      const permissions = await extractUserPermissions(request, pool);
      if (!permissions || !permissions.canViewAllDepartments) {
        return reply.code(403).send({ success: false, message: '权限不足' });
      }
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return { success: true, data: JSON.parse(cached) };
      }
      const today = dayjs().format('YYYY-MM-DD');
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');

      // --- 性能优化：合并概览统计查询 (Single Query Optimization) ---
      const [[overviewRaw]] = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE status != 'deleted') as totalUsers,
          (SELECT COUNT(*) FROM users WHERE status = 'pending') as pendingUsers,
          (SELECT COUNT(DISTINCT user_id) FROM attendance_records WHERE attendance_date = ?) as todayClocks,
          (SELECT COUNT(*) FROM operation_logs WHERE created_at >= ?) as todayLogs
      `, [today, today + ' 00:00:00']);

      const [[{ total: monthReimbursement }]] = await pool.query('SELECT SUM(total_amount) as total FROM reimbursements WHERE created_at >= ? AND status = "approved"', [startOfMonth + ' 00:00:00']);
      
      const [deptDistribution] = await pool.query(`
        SELECT d.name, COUNT(u.id) as value 
        FROM departments d 
        LEFT JOIN users u ON d.id = u.department_id AND u.status != 'deleted'
        WHERE d.status = 'active'
        GROUP BY d.id
      `);

      const [reimbursementByTypeRaw] = await pool.query(`SELECT type as name, SUM(total_amount) as value FROM reimbursements WHERE created_at >= ? AND status = "approved" GROUP BY type`, [startOfMonth + ' 00:00:00']);
      
      // --- 性能优化：增加近七日出勤趋势统计 ---
      const [trendRaw] = await pool.query(`
        SELECT 
          DATE_FORMAT(attendance_date, '%m-%d') as name,
          COUNT(DISTINCT user_id) as value
        FROM attendance_records
        WHERE attendance_date >= DATE_SUB(?, INTERVAL 6 DAY)
        GROUP BY attendance_date
        ORDER BY attendance_date ASC
      `, [today]);

      const typeLabels = { travel: '差旅费', office: '办公费', entertainment: '招待费', training: '培训费', other: '其他' };
      const reimbursementByType = reimbursementByTypeRaw.map(item => ({ name: typeLabels[item.name] || item.name, value: parseFloat(item.value || 0) }));

      const finalData = {
        overview: { 
          totalUsers: overviewRaw.totalUsers, 
          pendingUsers: overviewRaw.pendingUsers, 
          todayClocks: overviewRaw.todayClocks, 
          monthReimbursement: parseFloat(monthReimbursement || 0), 
          todayLogs: overviewRaw.todayLogs 
        },
        charts: { 
          deptDistribution: deptDistribution.map(d => ({ name: d.name, value: parseInt(d.value) })), 
          reimbursementByType: reimbursementByType.length > 0 ? reimbursementByType : [],
          attendanceTrend: trendRaw // 返回真实趋势数据
        }
      };

      // 优化缓存策略：动态数据缓存 2 分钟，确保实时感
      if (redis) await redis.set(cacheKey, JSON.stringify(finalData), 'EX', 120);
      return { success: true, data: finalData };
    } catch (error) {
      console.error('Admin Dashboard Error:', error);
      return reply.code(500).send({ success: false });
    }
  });

  // ============================================================
  // 部门实时考勤统计 - 深度加固版
  // ============================================================
  fastify.get('/api/admin/realtime-attendance', async (request, reply) => {
    const redis = fastify.redis;
    const io = fastify.io;
    
    try {
      const today = dayjs().format('YYYY-MM-DD');
      
      // 1. 获取在线用户集合 (双重来源：Redis + Socket.io 内存)
      const onlineUserIds = new Set();
      
      // 来源 A: Redis
      if (redis) {
        try {
          const ids = await redis.smembers('online_users');
          ids.forEach(id => onlineUserIds.add(String(id)));
        } catch (e) { console.error('Redis在线查询失败:', e); }
      }

      // 来源 B: Socket.io 本地内存 (兜底，防止 Redis 同步延迟)
      if (io && io.sockets) {
        const sockets = await io.fetchSockets();
        sockets.forEach(s => {
          if (s.userId) onlineUserIds.add(String(s.userId));
        });
      }

      // 2. 获取部门和排班
      const [departments] = await pool.query('SELECT id, name FROM departments WHERE status = "active"');
      const [employeeRows] = await pool.query(`
        SELECT 
          u.id as user_id, u.real_name, u.avatar, u.department_id, u.status as user_status,
          ss.is_rest_day, ws.name as shift_name, ws.start_time, ws.end_time
        FROM users u
        LEFT JOIN employees e ON u.id = e.user_id
        LEFT JOIN shift_schedules ss ON e.id = ss.employee_id AND ss.schedule_date = ?
        LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
        WHERE u.status != 'deleted'
      `, [today]);

      const deptMap = {};
      departments.forEach(d => {
        deptMap[d.id] = { id: d.id, name: d.name, totalCount: 0, onlineCount: 0, onDutyCount: 0, absentCount: 0, hasSchedulePlan: false, employees: [] };
      });

      employeeRows.forEach(row => {
        const deptId = row.department_id;
        if (!deptMap[deptId]) return;

        const dept = deptMap[deptId];
        const isOnline = onlineUserIds.has(String(row.user_id));
        const hasSchedule = row.is_rest_day === 0 && row.shift_name;
        
        if (row.is_rest_day !== null) dept.hasSchedulePlan = true;

        let status = 'offline';
        let reason = '';

        if (isOnline) {
          status = hasSchedule ? 'on_duty' : 'resting_online';
          if (status === 'on_duty') dept.onDutyCount++;
          dept.onlineCount++;
        } else {
          if (hasSchedule) {
            status = 'absent';
            dept.absentCount++;
            reason = '当前处于排班时间但未上线';
          } else {
            status = 'off_duty';
          }
        }

        dept.totalCount++;
        dept.employees.push({
          id: row.user_id,
          name: row.real_name,
          avatar: row.avatar,
          shift: hasSchedule ? `${row.shift_name} (${row.start_time}-${row.end_time})` : (row.is_rest_day === 1 ? '休息' : '未排班'),
          isOnline,
          status,
          reason
        });
      });

      return { success: true, data: Object.values(deptMap).sort((a, b) => b.onlineCount - a.onlineCount) };
    } catch (error) {
      return reply.code(500).send({ success: false, message: error.message });
    }
  });
};
