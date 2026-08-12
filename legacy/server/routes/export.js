const ExcelJS = require('exceljs');

module.exports = async function (fastify, opts) {
  // 导出个人考勤报表
  fastify.get('/api/export/attendance/:employeeId', async (request, reply) => {
    const { employeeId } = request.params;
    const { startDate, endDate } = request.query;

    try {
      // 查询考勤记录（使用正确的表结构）
      const [records] = await fastify.mysql.query(
        `SELECT ar.*, u.real_name as employee_name, e.employee_no
         FROM attendance_records ar
         LEFT JOIN employees e ON ar.employee_id = e.id
         LEFT JOIN users u ON e.user_id = u.id
         WHERE ar.employee_id = ? AND ar.record_date BETWEEN ? AND ?
         ORDER BY ar.record_date DESC`,
        [employeeId, startDate, endDate]
      );

      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('考勤记录');

      // 设置列
      worksheet.columns = [
        { header: '日期', key: 'record_date', width: 15 },
        { header: '员工姓名', key: 'employee_name', width: 15 },
        { header: '工号', key: 'employee_number', width: 15 },
        { header: '上班打卡', key: 'clock_in_time', width: 20 },
        { header: '下班打卡', key: 'clock_out_time', width: 20 },
        { header: '工作时长', key: 'work_hours', width: 12 },
        { header: '状态', key: 'status', width: 12 },
        { header: '备注', key: 'remark', width: 30 }
      ];

      // 添加数据
      records.forEach(record => {
        worksheet.addRow({
          record_date: record.record_date,
          employee_name: record.employee_name,
          employee_number: record.employee_no,
          clock_in_time: record.clock_in_time || '未打卡',
          clock_out_time: record.clock_out_time || '未打卡',
          work_hours: record.work_hours || 0,
          status: getStatusText(record.status),
          remark: record.remark || ''
        });
      });

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // 生成文件
      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename=attendance_${employeeId}_${startDate}_${endDate}.xlsx`)
        .send(buffer);

    } catch (error) {
      console.error('导出考勤记录失败:', error);
      reply.status(500).send({ error: '导出失败' });
    }
  });

  // 导出部门考勤统计
  fastify.get('/api/export/department/:departmentId', async (request, reply) => {
    const { departmentId } = request.params;
    const { month, start_date, end_date } = request.query;

    try {
      let startDate, endDate;
      if (month) {
        const [year, monthNum] = month.split('-');
        startDate = `${year}-${monthNum}-01`;
        endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
      } else {
        startDate = start_date;
        endDate = end_date;
      }

      if (!startDate || !endDate) {
        return reply.status(400).send({ error: '请提供月份或起止日期' });
      }

      // 查询部门员工考勤统计
      const [stats] = await fastify.mysql.query(
        `SELECT
          u.id,
          u.real_name as name,
          u.username as employee_number,
          e.employee_no,
          COUNT(DISTINCT ar.record_date) as work_days,
          SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN ar.status = 'early' THEN 1 ELSE 0 END) as early_count,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          COALESCE(SUM(ar.work_hours), 0) as total_hours,
          (SELECT COALESCE(SUM(days), 0) FROM leave_records lr
           WHERE lr.employee_id = e.id AND lr.status = 'approved'
           AND lr.start_date <= ? AND lr.end_date >= ?) as leave_days,
          (SELECT COALESCE(SUM(hours), 0) FROM overtime_records ot
           WHERE ot.employee_id = e.id AND ot.status = 'approved'
           AND ot.overtime_date BETWEEN ? AND ?) as overtime_hours
         FROM users u
         LEFT JOIN employees e ON u.id = e.user_id
         LEFT JOIN attendance_records ar ON e.id = ar.employee_id
           AND ar.record_date BETWEEN ? AND ?
         WHERE u.department_id = ? AND u.status = 'active'
         GROUP BY u.id, u.real_name, u.username, e.employee_no
         ORDER BY u.real_name`,
        [endDate, startDate, startDate, endDate, startDate, endDate, departmentId]
      );

      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('部门考勤统计');

      // 设置列
      worksheet.columns = [
        { header: '工号', key: 'employee_number', width: 15 },
        { header: '姓名', key: 'name', width: 15 },
        { header: '出勤天数', key: 'work_days', width: 12 },
        { header: '迟到次数', key: 'late_count', width: 12 },
        { header: '早退次数', key: 'early_count', width: 12 },
        { header: '缺勤次数', key: 'absent_count', width: 12 },
        { header: '工作时长', key: 'total_hours', width: 12 },
        { header: '请假天数', key: 'leave_days', width: 12 },
        { header: '加班时长', key: 'overtime_hours', width: 12 }
      ];

      // 添加数据
      stats.forEach(stat => {
        worksheet.addRow({
          employee_number: stat.employee_no,
          name: stat.name,
          work_days: stat.work_days || 0,
          late_count: stat.late_count || 0,
          early_count: stat.early_count || 0,
          absent_count: stat.absent_count || 0,
          total_hours: parseFloat(stat.total_hours || 0).toFixed(1),
          leave_days: parseFloat(stat.leave_days || 0).toFixed(1),
          overtime_hours: parseFloat(stat.overtime_hours || 0).toFixed(1)
        });
      });

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A90E2' }
      };
      worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

      // 生成文件
      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename=department_${departmentId}_${month}.xlsx`)
        .send(buffer);

    } catch (error) {
      console.error('导出部门统计失败:', error);
      reply.status(500).send({ error: '导出失败' });
    }
  });

  // 导出请假记录
  fastify.get('/api/export/leave/:employeeId', async (request, reply) => {
    const { employeeId } = request.params;
    const { startDate, endDate } = request.query;

    try {
      const [records] = await fastify.mysql.query(
        `SELECT lr.*, u.real_name as employee_name, e.employee_no,
                a.real_name as approver_name
         FROM leave_records lr
         LEFT JOIN employees e ON lr.employee_id = e.id
         LEFT JOIN users u ON e.user_id = u.id
         LEFT JOIN users a ON lr.approver_id = a.id
         WHERE lr.employee_id = ? AND lr.start_date BETWEEN ? AND ?
         ORDER BY lr.created_at DESC`,
        [employeeId, startDate, endDate]
      );

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('请假记录');

      worksheet.columns = [
        { header: '申请日期', key: 'created_at', width: 20 },
        { header: '员工姓名', key: 'employee_name', width: 15 },
        { header: '请假类型', key: 'leave_type', width: 12 },
        { header: '开始日期', key: 'start_date', width: 15 },
        { header: '结束日期', key: 'end_date', width: 15 },
        { header: '天数', key: 'days', width: 10 },
        { header: '原因', key: 'reason', width: 30 },
        { header: '状态', key: 'status', width: 12 },
        { header: '审批人', key: 'approver_name', width: 15 },
        { header: '审批时间', key: 'approved_at', width: 20 }
      ];

      records.forEach(record => {
        worksheet.addRow({
          created_at: record.created_at,
          employee_name: record.employee_name,
          leave_type: getLeaveTypeText(record.leave_type),
          start_date: record.start_date,
          end_date: record.end_date,
          days: record.days,
          reason: record.reason,
          status: getApprovalStatusText(record.status),
          approver_name: record.approver_name || '',
          approved_at: record.approved_at || ''
        });
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB3B' }
      };

      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename=leave_${employeeId}_${startDate}_${endDate}.xlsx`)
        .send(buffer);

    } catch (error) {
      console.error('导出请假记录失败:', error);
      reply.status(500).send({ error: '导出失败' });
    }
  });

  // 导出加班记录
  fastify.get('/api/export/overtime/:employeeId', async (request, reply) => {
    const { employeeId } = request.params;
    const { startDate, endDate } = request.query;

    try {
      const [records] = await fastify.mysql.query(
        `SELECT or_table.*, u.real_name as employee_name, e.employee_no,
                a.real_name as approver_name
         FROM overtime_records or_table
         LEFT JOIN employees e ON or_table.employee_id = e.id
         LEFT JOIN users u ON e.user_id = u.id
         LEFT JOIN users a ON or_table.approver_id = a.id
         WHERE or_table.employee_id = ? AND or_table.overtime_date BETWEEN ? AND ?
         ORDER BY or_table.created_at DESC`,
        [employeeId, startDate, endDate]
      );

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('加班记录');

      worksheet.columns = [
        { header: '申请日期', key: 'created_at', width: 20 },
        { header: '员工姓名', key: 'employee_name', width: 15 },
        { header: '加班日期', key: 'overtime_date', width: 15 },
        { header: '开始时间', key: 'start_time', width: 15 },
        { header: '结束时间', key: 'end_time', width: 15 },
        { header: '时长(小时)', key: 'hours', width: 12 },
        { header: '原因', key: 'reason', width: 30 },
        { header: '状态', key: 'status', width: 12 },
        { header: '审批人', key: 'approver_name', width: 15 },
        { header: '是否调休', key: 'is_compensated', width: 12 }
      ];

      records.forEach(record => {
        worksheet.addRow({
          created_at: record.created_at,
          employee_name: record.employee_name,
          overtime_date: record.overtime_date,
          start_time: record.start_time,
          end_time: record.end_time,
          hours: record.hours,
          reason: record.reason,
          status: getApprovalStatusText(record.status),
          approver_name: record.approver_name || '',
          is_compensated: record.is_compensated ? '是' : '否'
        });
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF9800' }
      };

      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename=overtime_${employeeId}_${startDate}_${endDate}.xlsx`)
        .send(buffer);

    } catch (error) {
      console.error('导出加班记录失败:', error);
      reply.status(500).send({ error: '导出失败' });
    }
  });

  // 导出员工列表
  fastify.get('/api/export/employees', async (request, reply) => {
    try {
      // 构建查询
      let query = `
        SELECT
          e.id,
          e.employee_no,
          u.real_name as name,
          u.username as login_username,
          d.name as department_name,
          pos.name as position_name,
          u.phone,
          u.email,
          u.status,
          e.hire_date,
          e.rating,
          e.emergency_contact,
          e.emergency_phone,
          e.address,
          e.education,
          e.skills,
          e.remark,
          u.is_department_manager
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        WHERE 1=1
      `;

      const queryParams = [];

      // 根据查询参数添加过滤条件
      if (request.query.status) {
        query += ` AND u.status = ?`;
        queryParams.push(request.query.status);
      }

      if (request.query.department_id) {
        query += ` AND d.id = ?`;
        queryParams.push(request.query.department_id);
      }

      if (request.query.position) {
        query += ` AND pos.name LIKE ?`;
        queryParams.push(`%${request.query.position}%`);
      }

      if (request.query.keyword) {
        query += ` AND (u.real_name LIKE ? OR e.employee_no LIKE ? OR u.phone LIKE ?)`;
        const keywordParam = `%${request.query.keyword}%`;
        queryParams.push(keywordParam, keywordParam, keywordParam);
      }

      query += ` ORDER BY e.employee_no ASC`;

      const [employees] = await fastify.mysql.query(query, queryParams);

      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('员工列表');

      // 设置列
      worksheet.columns = [
        { header: '工号', key: 'employee_no', width: 15 },
        { header: '姓名', key: 'name', width: 12 },
        { header: '登录账号', key: 'login_username', width: 15 },
        { header: '部门', key: 'department_name', width: 15 },
        { header: '职位', key: 'position_name', width: 15 },
        { header: '手机号', key: 'phone', width: 15 },
        { header: '邮箱', key: 'email', width: 25 },
        { header: '状态', key: 'status', width: 12 },
        { header: '入职日期', key: 'hire_date', width: 15 },
        { header: '评级', key: 'rating', width: 10 },
        { header: '紧急联系人', key: 'emergency_contact', width: 15 },
        { header: '紧急联系电话', key: 'emergency_phone', width: 15 },
        { header: '地址', key: 'address', width: 30 },
        { header: '学历', key: 'education', width: 15 },
        { header: '技能', key: 'skills', width: 20 },
        { header: '备注', key: 'remark', width: 30 },
        { header: '部门主管', key: 'is_department_manager', width: 12 }
      ];

      // 添加数据
      employees.forEach(emp => {
        worksheet.addRow({
          employee_no: emp.employee_no || '',
          name: emp.name || '',
          login_username: emp.login_username || '',
          department_name: emp.department_name || '',
          position_name: emp.position_name || '',
          phone: emp.phone || '',
          email: emp.email || '',
          status: emp.status === 'active' ? '在职' : emp.status === 'resigned' ? '离职' : '停用',
          hire_date: emp.hire_date || '',
          rating: emp.rating || 0,
          emergency_contact: emp.emergency_contact || '',
          emergency_phone: emp.emergency_phone || '',
          address: emp.address || '',
          education: emp.education || '',
          skills: emp.skills || '',
          remark: emp.remark || '',
          is_department_manager: emp.is_department_manager ? '是' : '否'
        });
      });

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A90E2' }
      };
      worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

      // 生成文件
      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename=employees_${new Date().toISOString().slice(0, 19)}.xlsx`)
        .send(buffer);

    } catch (error) {
      console.error('导出员工列表失败:', error);
      reply.status(500).send({ error: '导出失败' });
    }
  });

// 辅助函数
function getStatusText(status) {
  const statusMap = {
    'normal': '正常',
    'late': '迟到',
    'early': '早退',
    'absent': '缺勤',
    'leave': '请假'
  };
  return statusMap[status] || status;
}

function getLeaveTypeText(type) {
  const typeMap = {
    'sick': '病假',
    'personal': '事假',
    'annual': '年假',
    'compensatory': '调休',
    'other': '其他'
  };
  return typeMap[type] || type;
}

function getApprovalStatusText(status) {
  const statusMap = {
    'pending': '待审批',
    'approved': '已批准',
    'rejected': '已拒绝',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

}
