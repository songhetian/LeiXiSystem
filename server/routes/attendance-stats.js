// 考勤统计 API - 雷犀旗舰版 (V13 终极业务对齐版)
const dayjs = require('dayjs');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  /**
   * 1. 个人每日考勤明细 (逻辑修正 V13：全量切换至 work_shifts)
   */
  fastify.get('/api/attendance/daily-details', async (request, reply) => {
    const { employee_id, year, month } = request.query;
    try {
      if (!employee_id) return reply.code(400).send({ success: false, message: '缺少参数' });

      const startDate = dayjs(`${year}-${month}-01`).format('YYYY-MM-DD');
      const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

      const [userRows] = await pool.query('SELECT user_id FROM employees WHERE id = ?', [employee_id]);
      if (userRows.length === 0) return { success: true, data: [] };
      const userId = userRows[0].user_id;

      // 核心 SQL：联表查询真实班次定义表 work_shifts
      const [rows] = await pool.query(
        `SELECT 
          CAST(d_seq.d AS CHAR) as record_date,
          sch.id as schedule_id,
          sch.is_rest_day,
          COALESCE(ws.name, CASE WHEN sch.id IS NOT NULL THEN '已排班(未关联班次)' ELSE NULL END) as shift_name,
          ar.status as attendance_status,
          ar.clock_in_time,
          ar.clock_out_time,
          ar.work_hours,
          (SELECT hours FROM overtime_records otr 
           WHERE otr.employee_id = ? AND otr.overtime_date = d_seq.d AND otr.status = 'approved' LIMIT 1) as overtime_hours,
          (SELECT leave_type FROM leave_records lr 
           WHERE lr.employee_id = ? AND d_seq.d BETWEEN lr.start_date AND lr.end_date AND lr.status = 'approved' LIMIT 1) as leave_type
         FROM (
            SELECT CAST(DATE_ADD(?, INTERVAL (t4.n*10 + t1.n) DAY) AS DATE) as d
            FROM (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t1,
                 (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3) t4
            WHERE DATE_ADD(?, INTERVAL (t4.n*10 + t1.n) DAY) <= ?
         ) d_seq
         LEFT JOIN shift_schedules sch ON sch.employee_id = ? AND CAST(sch.schedule_date AS DATE) = d_seq.d
         LEFT JOIN work_shifts ws ON sch.shift_id = ws.id
         LEFT JOIN attendance_records ar ON ar.employee_id = ? AND CAST(ar.record_date AS DATE) = d_seq.d
         ORDER BY record_date ASC`,
        [employee_id, employee_id, startDate, startDate, endDate, employee_id, employee_id]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.error('获取每日明细流水失败 (V13):', error);
      return reply.code(500).send({ success: false });
    }
  });

  /**
   * 2. 个人月报统计 (对齐)
   */
  fastify.get('/api/attendance/personal-monthly-report', async (request, reply) => {
    const { employee_id, year, month } = request.query;
    try {
      const startDate = dayjs(`${year}-${month}-01`).format('YYYY-MM-DD');
      const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
      const [attendanceStats] = await pool.query(`SELECT SUM(CASE WHEN clock_in_time IS NOT NULL THEN 1 ELSE 0 END) as clock_in_days, COALESCE(SUM(work_hours), 0) as total_work_hours FROM attendance_records WHERE employee_id = ? AND record_date BETWEEN ? AND ?`, [employee_id, startDate, endDate]);
      const [overtimeStats] = await pool.query(`SELECT COALESCE(SUM(hours), 0) as total_hours FROM overtime_records WHERE employee_id = ? AND status = 'approved' AND overtime_date BETWEEN ? AND ?`, [employee_id, startDate, endDate]);
      const [makeupStats] = await pool.query(`SELECT COUNT(*) as count FROM makeup_records WHERE employee_id = ? AND status = 'approved' AND record_date BETWEEN ? AND ?`, [employee_id, startDate, endDate]);
      return { success: true, data: { attendance: { clock_in_days: Number(attendanceStats[0]?.clock_in_days || 0), total_work_hours: parseFloat(attendanceStats[0]?.total_work_hours || 0), makeup_count: Number(makeupStats[0]?.count || 0) }, overtime: { total_hours: parseFloat(overtimeStats[0]?.total_hours || 0) } } };
    } catch (error) { return reply.code(500).send({ success: false }); }
  });

  /**
   * 3. 部门看板聚合 (对齐)
   */
  fastify.get('/api/attendance/dashboard-summary', async (request, reply) => {
    const { department_id, year, month } = request.query;
    try {
      const startDate = dayjs(`${year}-${month}-01`).format('YYYY-MM-DD');
      const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
      const [deptStats] = await pool.query(`SELECT COUNT(DISTINCT e.id) as total_employees, SUM(CASE WHEN ar.status = 'normal' THEN 1 ELSE 0 END) as normal_days, SUM(CASE WHEN ar.status IN ('late', 'early') THEN 1 ELSE 0 END) as abnormal_days, COALESCE(SUM(ar.work_hours), 0) as total_work_hours FROM employees e JOIN users u ON e.user_id = u.id LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.record_date BETWEEN ? AND ? WHERE u.department_id = ? AND e.status = 'active'`, [startDate, endDate, department_id]);
      const [employeeDetails] = await pool.query(`SELECT e.id, u.real_name, u.avatar, COUNT(CASE WHEN ar.status = 'normal' THEN 1 END) as normal_days, COUNT(CASE WHEN ar.status IN ('late', 'early') THEN 1 END) as abnormal_days, (SELECT COALESCE(SUM(days), 0) FROM leave_records lr WHERE lr.employee_id = e.id AND lr.status = 'approved' AND lr.start_date BETWEEN ? AND ?) as leave_days FROM employees e JOIN users u ON e.user_id = u.id LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.record_date BETWEEN ? AND ? WHERE u.department_id = ? AND e.status = 'active' GROUP BY e.id, u.real_name, u.avatar`, [startDate, endDate, startDate, endDate, department_id]);
      return { success: true, data: { summary: deptStats[0], employeeDetails } };
    } catch (error) { return reply.code(500).send({ success: false }); }
  });
};
