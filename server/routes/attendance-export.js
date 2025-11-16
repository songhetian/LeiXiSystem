// 考勤数据导出 API

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

  // 导出个人考勤报表
  fastify.get('/api/attendance/export/personal', async (request, reply) => {
    const { employee_id, year, month } = request.query

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]

      // 获取打卡记录
      const [records] = await pool.query(
        `SELECT
          ar.*,
          e.employee_no,
          u.real_name
        FROM attendance_records ar
        LEFT JOIN employees e ON ar.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        WHERE ar.employee_id = ? AND ar.record_date BETWEEN ? AND ?
        ORDER BY ar.record_date`,
        [employee_id, startDate, endDate]
      )

      // 获取请假记录
      const [leaveRecords] = await pool.query(
        `SELECT * FROM leave_records
        WHERE employee_id = ? AND status = 'approved'
        AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))`,
        [employee_id, startDate, endDate, startDate, endDate]
      )

      // 获取加班记录
      const [overtimeRecords] = await pool.query(
        `SELECT * FROM overtime_records
        WHERE employee_id = ? AND status = 'approved'
        AND overtime_date BETWEEN ? AND ?`,
        [employee_id, startDate, endDate]
      )

      // 构建Excel数据
      const excelData = {
        employee: records[0] ? {
          employee_no: records[0].employee_no,
          real_name: records[0].real_name
        } : {},
        period: { year, month, start_date: startDate, end_date: endDate },
        attendance: records,
        leave: leaveRecords,
        overtime: overtimeRecords
      }

      return {
        success: true,
        data: excelData
      }
    } catch (error) {
      console.error('导出个人报表失败:', error)
      return reply.code(500).send({ success: false, message: '导出失败' })
    }
  })

  // 导出部门考勤报表
  fastify.get('/api/attendance/export/department', async (request, reply) => {
    const { department_id, year, month } = request.query

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]

      const [stats] = await pool.query(
        `SELECT
          u.id as user_id,
          u.real_name,
          e.employee_no,
          COUNT(DISTINCT ar.record_date) as attendance_days,
          SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN ar.status = 'early' THEN 1 ELSE 0 END) as early_count,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          COALESCE(SUM(ar.work_hours), 0) as total_work_hours,
          (SELECT COALESCE(SUM(days), 0) FROM leave_records lr
           WHERE lr.employee_id = e.id AND lr.status = 'approved'
           AND lr.start_date BETWEEN ? AND ?) as leave_days,
          (SELECT COALESCE(SUM(hours), 0) FROM overtime_records ot
           WHERE ot.employee_id = e.id AND ot.status = 'approved'
           AND ot.overtime_date BETWEEN ? AND ?) as overtime_hours
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN attendance_records ar ON e.id = ar.employee_id
          AND ar.record_date BETWEEN ? AND ?
        WHERE u.department_id = ? AND e.status = 'active'
        GROUP BY e.id, u.id, u.real_name, e.employee_no
        ORDER BY u.real_name`,
        [startDate, endDate, startDate, endDate, startDate, endDate, department_id]
      )

      return {
        success: true,
        data: {
          period: { year, month, start_date: startDate, end_date: endDate },
          employees: stats
        }
      }
    } catch (error) {
      console.error('导出部门报表失败:', error)
      return reply.code(500).send({ success: false, message: '导出失败' })
    }
  })

  // 导出排班表
  fastify.get('/api/schedules/export', async (request, reply) => {
    const { department_id, year, month } = request.query

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]

      const [schedules] = await pool.query(
        `SELECT
          ss.*,
          ws.name as shift_name,
          ws.start_time,
          ws.end_time,
          e.employee_no,
          u.real_name as employee_name
        FROM shift_schedules ss
        LEFT JOIN work_shifts ws ON ss.shift_id = ws.id
        LEFT JOIN employees e ON ss.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        WHERE u.department_id = ? AND ss.schedule_date BETWEEN ? AND ?
        ORDER BY u.real_name, ss.schedule_date`,
        [department_id, startDate, endDate]
      )

      return {
        success: true,
        data: {
          period: { year, month, start_date: startDate, end_date: endDate },
          schedules
        }
      }
    } catch (error) {
      console.error('导出排班表失败:', error)
      return reply.code(500).send({ success: false, message: '导出失败' })
    }
  })
}
