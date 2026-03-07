// 考勤统计 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 个人考勤月报
  fastify.get('/api/attendance/monthly-report', async (request, reply) => {
    const { employee_id, year, month } = request.query
    const redis = fastify.redis
    const cacheKey = `stats:attendance:monthly:${employee_id}:${year}:${month}`

    try {
      if (!employee_id || !year || !month) {
        return reply.code(400).send({ success: false, message: '缺少必要参数' });
      }

      // 1. 尝试从 Redis 获取
      if (redis) {
        const cached = await redis.get(cacheKey)
        if (cached) return { success: true, data: JSON.parse(cached) }
      }

      // 物理对齐日期边界：使用 dayjs 确保时区一致性
      const dayjs = require('dayjs');
      const startDate = dayjs(`${year}-${month}-01`).format('YYYY-MM-DD');
      const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

      // 出勤统计
      const [attendanceStats] = await pool.query(
        `SELECT
          COUNT(*) as total_days,
          SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal_days,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
          SUM(CASE WHEN status = 'early' THEN 1 ELSE 0 END) as early_days,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
          SUM(CASE WHEN clock_in_time IS NOT NULL THEN 1 ELSE 0 END) as clock_in_days,
          COALESCE(SUM(work_hours), 0) as total_work_hours
        FROM attendance_records
        WHERE employee_id = ? AND record_date BETWEEN ? AND ?`,
        [employee_id, startDate, endDate]
      )

      // 如果没有任何打卡记录，SUM 会返回 null，需进行物理兜底
      const att = attendanceStats[0] || {};
      const attendance = {
        total_days: Number(att.total_days || 0),
        normal_days: Number(att.normal_days || 0),
        late_days: Number(att.late_days || 0),
        early_days: Number(att.early_days || 0),
        absent_days: Number(att.absent_days || 0),
        clock_in_days: Number(att.clock_in_days || 0),
        total_work_hours: parseFloat(att.total_work_hours || 0)
      };

      // 2. 写入 Redis (有效期 1 小时)
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(attendance), 'EX', 3600);
      }

      return {
        success: true,
        data: attendance
      }
    } catch (error) {
      console.error('获取月度报表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 部门考勤统计
  fastify.get('/api/attendance/department-stats', async (request, reply) => {
  const { department_id, year, month, start_date, end_date, keyword, page = 1, limit = 10 } = request.query;
  const redis = fastify.redis;
  
  // 仅在无关键词搜索且按年月查询时缓存
  const isCacheable = !keyword && year && month;
  const cacheKey = `stats:attendance:dept:${department_id}:${year}:${month}`;

  try {
    if (redis && isCacheable) {
      const cached = await redis.get(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };
    }

    // Determine date range
    let startDate, endDate;
    if (start_date && end_date) {
      startDate = start_date;
      endDate = end_date;
    } else {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
    }

    // ... (中间复杂的 SQL 查询逻辑保持不变)
    // Build keyword clause and parameters
    let keywordClause = '';
    const queryParams = [startDate, endDate, startDate, endDate, department_id];
    if (keyword) {
      keywordClause = ' AND (u.real_name LIKE ? OR e.employee_no LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    // Fetch employee stats for the department
    const [allStats] = await pool.query(
      `SELECT
        e.id AS employee_id,
        u.id AS user_id,
        u.real_name,
        e.employee_no,
        COUNT(DISTINCT ar.record_date) AS attendance_days,
        CAST(SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) AS UNSIGNED) AS late_count,
        CAST(SUM(CASE WHEN ar.status = 'early' THEN 1 ELSE 0 END) AS UNSIGNED) AS early_count,
        CAST(SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS UNSIGNED) AS absent_count,
        COALESCE(SUM(ar.work_hours), 0) AS total_work_hours,
        (SELECT COALESCE(SUM(days), 0) FROM leave_records lr
         WHERE lr.employee_id = e.id AND lr.status = 'approved'
         AND lr.start_date BETWEEN ? AND ?) AS leave_days
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN attendance_records ar ON e.id = ar.employee_id
        AND ar.record_date BETWEEN ? AND ?
      WHERE u.department_id = ? AND e.status = 'active'
      ${keywordClause}
      GROUP BY e.id, u.id, u.real_name, e.employee_no
      ORDER BY u.real_name`,
      queryParams
    );

    // Aggregate department summary
    const totalEmployees = allStats.length;
    const totalAttendanceDays = allStats.reduce((sum, item) => sum + item.attendance_days, 0);
    const totalLateCount = allStats.reduce((sum, item) => sum + Number(item.late_count || 0), 0);
    const totalEarlyCount = allStats.reduce((sum, item) => sum + Number(item.early_count || 0), 0);
    const totalAbsentCount = allStats.reduce((sum, item) => sum + Number(item.absent_count || 0), 0);

    // Calculate work days based on month days minus configured holidays
    let workDays = 22; // Default fallback

    if (year && month) {
      const totalDaysInMonth = new Date(year, month, 0).getDate();
      const [holidayResult] = await pool.query(
        'SELECT COALESCE(SUM(days), 0) as holiday_days FROM holidays WHERE year = ? AND month = ?',
        [year, month]
      );
      const holidayDays = parseInt(holidayResult[0]?.holiday_days) || 0;
      workDays = totalDaysInMonth - holidayDays;
    } else if (start_date && end_date) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let totalDays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        totalDays++;
      }
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      const startMonth = start.getMonth() + 1;
      const endMonth = end.getMonth() + 1;
      let holidayDays = 0;
      if (startYear === endYear) {
        const [holidayResult] = await pool.query(
          'SELECT COALESCE(SUM(days), 0) as holiday_days FROM holidays WHERE year = ? AND month >= ? AND month <= ?',
          [startYear, startMonth, endMonth]
        );
        holidayDays = parseInt(holidayResult[0]?.holiday_days) || 0;
      } else {
        const [result1] = await pool.query('SELECT COALESCE(SUM(days), 0) as holiday_days FROM holidays WHERE year = ? AND month >= ?', [startYear, startMonth]);
        const [result2] = await pool.query('SELECT COALESCE(SUM(days), 0) as holiday_days FROM holidays WHERE year = ? AND month <= ?', [endYear, endMonth]);
        holidayDays = (parseInt(result1[0]?.holiday_days) || 0) + (parseInt(result2[0]?.holiday_days) || 0);
      }
      workDays = totalDays - holidayDays;
    }

    const finalData = {
      period: { year, month, start_date: startDate, end_date: endDate },
      summary: {
        total_employees: totalEmployees,
        work_days: workDays,
        attendance_rate: totalEmployees > 0 ? ((totalAttendanceDays / (totalEmployees * workDays)) * 100).toFixed(2) : 0,
        total_late_count: totalLateCount,
        total_early_count: totalEarlyCount,
        total_absent_count: totalAbsentCount,
      },
      employees: allStats.map(item => ({
        ...item,
        late_count: Number(item.late_count) || 0,
        early_count: Number(item.early_count) || 0,
        absent_count: Number(item.absent_count) || 0,
        total_work_hours: parseFloat(item.total_work_hours),
        leave_days: parseFloat(item.leave_days),
        attendance_rate: workDays > 0 ? ((item.attendance_days / workDays) * 100).toFixed(2) : 0,
      })),
    };

    if (redis && isCacheable) {
      await redis.set(cacheKey, JSON.stringify(finalData), 'EX', 1800);
    }

    // 后置分页处理
    const offset = (page - 1) * limit;
    const paginatedEmployees = finalData.employees.slice(offset, offset + parseInt(limit));

    return {
      success: true,
      data: {
        ...finalData,
        employees: paginatedEmployees
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalEmployees,
        totalPages: Math.ceil(totalEmployees / limit),
      }
    }
  } catch (error) {
    console.error('获取部门统计失败:', error)
    return reply.code(500).send({ success: false, message: '获取失败' })
  }
})

// 考勤异常列表
fastify.get('/api/attendance/abnormal', async (request, reply) => {
    const { department_id, start_date, end_date, type } = request.query

    try {
      let query = `
        SELECT
          ar.*,
          u.real_name,
          e.employee_no,
          d.name as department_name
        FROM attendance_records ar
        LEFT JOIN employees e ON ar.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE ar.record_date BETWEEN ? AND ?
      `
      const params = [start_date, end_date]

      if (department_id) {
        query += ' AND u.department_id = ?'
        params.push(department_id)
      }

      if (type && type !== 'all') {
        query += ' AND ar.status = ?'
        params.push(type)
      } else {
        query += ' AND ar.status IN (\'late\', \'early\', \'absent\')'
      }

      query += ' ORDER BY ar.record_date DESC, u.real_name'

      const [records] = await pool.query(query, params)

      return {
        success: true,
        data: records
      }
    } catch (error) {
      console.error('获取异常记录失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })
}
