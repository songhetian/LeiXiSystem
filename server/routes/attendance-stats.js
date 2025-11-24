// 考勤统计 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 个人考勤月报
  fastify.get('/api/attendance/monthly-report', async (request, reply) => {
    const { employee_id, year, month } = request.query

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]

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

      // 请假统计
      const [leaveStats] = await pool.query(
        `SELECT
          leave_type,
          COALESCE(SUM(days), 0) as total_days
        FROM leave_records
        WHERE employee_id = ? AND status = 'approved'
        AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))
        GROUP BY leave_type`,
        [employee_id, startDate, endDate, startDate, endDate]
      )

      // 加班统计
      const [overtimeStats] = await pool.query(
        `SELECT
          COUNT(*) as overtime_count,
          COALESCE(SUM(hours), 0) as total_hours
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved'
        AND overtime_date BETWEEN ? AND ?`,
        [employee_id, startDate, endDate]
      )

      // 组织请假数据
      const leaveData = {}
      leaveStats.forEach(item => {
        leaveData[item.leave_type] = parseFloat(item.total_days)
      })

      return {
        success: true,
        data: {
          period: { year, month, start_date: startDate, end_date: endDate },
          attendance: {
            total_days: attendanceStats[0].total_days,
            normal_days: attendanceStats[0].normal_days,
            late_days: attendanceStats[0].late_days,
            early_days: attendanceStats[0].early_days,
            absent_days: attendanceStats[0].absent_days,
            clock_in_days: attendanceStats[0].clock_in_days,
            total_work_hours: parseFloat(attendanceStats[0].total_work_hours)
          },
          leave: leaveData,
          overtime: {
            count: overtimeStats[0].overtime_count,
            total_hours: parseFloat(overtimeStats[0].total_hours)
          }
        }
      }
    } catch (error) {
      console.error('获取月度报表失败:', error)
      return reply.code(500).send({ success: false, message: '获取失败' })
    }
  })

  // 部门考勤统计
  fastify.get('/api/attendance/department-stats', async (request, reply) => {
  const { department_id, year, month, start_date, end_date, keyword, page = 1, limit = 10 } = request.query;

  try {
    // Determine date range
    let startDate, endDate;
    if (start_date && end_date) {
      startDate = start_date;
      endDate = end_date;
    } else {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
    }

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
        u.id AS user_id,
        u.real_name,
        e.employee_no,
        COUNT(DISTINCT ar.record_date) AS attendance_days,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN ar.status = 'early' THEN 1 ELSE 0 END) AS early_count,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
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
    const totalLateCount = allStats.reduce((sum, item) => sum + item.late_count, 0);
    const totalEarlyCount = allStats.reduce((sum, item) => sum + item.early_count, 0);
    const totalAbsentCount = allStats.reduce((sum, item) => sum + item.absent_count, 0);

    // Estimate work days in the period
    let workDays = 22;
    if (start_date && end_date) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let weekdays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) weekdays++;
      }
      workDays = weekdays;
    }

    // Pagination
    const offset = (page - 1) * limit;
    const paginatedStats = allStats.slice(offset, offset + parseInt(limit));

    return {
      success: true,
      data: {
        period: { year, month, start_date: startDate, end_date: endDate },
        summary: {
          total_employees: totalEmployees,
          work_days: workDays,
          attendance_rate: totalEmployees > 0 ? ((totalAttendanceDays / (totalEmployees * workDays)) * 100).toFixed(2) : 0,
          total_late_count: totalLateCount,
          total_early_count: totalEarlyCount,
          total_absent_count: totalAbsentCount,
        },
        employees: paginatedStats.map(item => ({
          ...item,
          total_work_hours: parseFloat(item.total_work_hours),
          leave_days: parseFloat(item.leave_days),
          attendance_rate: workDays > 0 ? ((item.attendance_days / workDays) * 100).toFixed(2) : 0,
        })),
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
