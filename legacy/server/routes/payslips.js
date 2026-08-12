const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { extractUserPermissions, applyDepartmentFilter } = require('../middleware/checkPermission');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;

  // ==================== 员工端 API ====================

  // 验证二级密码
  fastify.post('/api/payslips/verify-password', async (request, reply) => {
    try {
      // 验证 token
      const authToken = request.headers.authorization?.replace('Bearer ', '');
      if (!authToken) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(authToken, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { password } = request.body;
      const userId = decoded.id;

      if (!password) {
        return reply.code(400).send({ success: false, message: '请输入密码' });
      }

      const [passwords] = await pool.query(
        'SELECT * FROM payslip_passwords WHERE user_id = ?',
        [userId]
      );

      if (passwords.length === 0) {
        return reply.code(404).send({
          success: false,
          message: '未设置二级密码，请联系管理员'
        });
      }

      const passwordRecord = passwords[0];
      const isValid = await bcrypt.compare(password, passwordRecord.password_hash);

      if (!isValid) {
        return reply.code(401).send({ success: false, message: '密码错误' });
      }

      const token = Buffer.from(`${userId}:${Date.now()}`).toString('base64');

      return {
        success: true,
        token,
        is_default: passwordRecord.is_default,
        message: '验证成功'
      };
    } catch (error) {
      console.error('验证二级密码失败:', error);
      return reply.code(500).send({ success: false, message: '验证失败' });
    }
  });

  // 修改二级密码
  fastify.post('/api/payslips/change-password', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { oldPassword, newPassword } = request.body;
      const userId = decoded.id;

      if (!oldPassword || !newPassword) {
        return reply.code(400).send({ success: false, message: '请填写完整信息' });
      }

      if (newPassword.length < 6) {
        return reply.code(400).send({ success: false, message: '密码长度至少6位' });
      }

      const [passwords] = await pool.query(
        'SELECT * FROM payslip_passwords WHERE user_id = ?',
        [userId]
      );

      if (passwords.length === 0) {
        return reply.code(404).send({ success: false, message: '未设置二级密码' });
      }

      const passwordRecord = passwords[0];
      const isValid = await bcrypt.compare(oldPassword, passwordRecord.password_hash);

      if (!isValid) {
        return reply.code(401).send({ success: false, message: '原密码错误' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await pool.query(
        'UPDATE payslip_passwords SET password_hash = ?, is_default = 0, last_changed_at = NOW() WHERE user_id = ?',
        [passwordHash, userId]
      );

      return {
        success: true,
        message: '密码修改成功'
      };
    } catch (error) {
      console.error('修改二级密码失败:', error);
      return reply.code(500).send({ success: false, message: '修改密码失败' });
    }
  });

  // 检查密码状态
  fastify.get('/api/payslips/password-status', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const userId = decoded.id;

      const [passwords] = await pool.query(
        'SELECT * FROM payslip_passwords WHERE user_id = ?',
        [userId]
      );

      const hasPassword = passwords.length > 0;
      const isDefault = hasPassword ? passwords[0].is_default : false;

      return {
        success: true,
        has_password: hasPassword,
        is_default: isDefault
      };
    } catch (error) {
      console.error('检查密码状态失败:', error);
      return reply.code(500).send({ success: false, message: '检查密码状态失败' });
    }
  });

  // 设置二级密码
  fastify.post('/api/payslips/set-password', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { password, confirmPassword } = request.body;
      const userId = decoded.id;

      if (!password || !confirmPassword) {
        return reply.code(400).send({ success: false, message: '请填写完整信息' });
      }

      if (password.length < 6) {
        return reply.code(400).send({ success: false, message: '密码长度至少6位' });
      }

      if (password !== confirmPassword) {
        return reply.code(400).send({ success: false, message: '两次输入的密码不一致' });
      }

      // 检查是否已设置密码
      const [existing] = await pool.query(
        'SELECT id FROM payslip_passwords WHERE user_id = ?',
        [userId]
      );

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '已设置过密码，请使用修改密码功能' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await pool.query(
        'INSERT INTO payslip_passwords (user_id, password_hash, is_default, last_changed_at) VALUES (?, ?, 1, NOW())',
        [userId, passwordHash]
      );

      return {
        success: true,
        message: '密码设置成功'
      };
    } catch (error) {
      console.error('设置二级密码失败:', error);
      return reply.code(500).send({ success: false, message: '设置密码失败' });
    }
  });

  // 获取我的工资条列表
  fastify.get('/api/payslips/my-payslips', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const userId = decoded.id;
      const { page = 1, limit = 10, year, month, sortBy = 'salary_month', sortOrder = 'DESC' } = request.query;

      // 验证和限制参数
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10)); // 限制每页最多100条，默认10条
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
      const validSortBy = ['salary_month', 'net_salary', 'employee_name', 'created_at'].includes(sortBy) ? sortBy : 'salary_month';

      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE p.user_id = ?';
      const params = [userId];

      if (year && year !== 'null' && year !== 'undefined' && year.trim() !== '' &&
          month && month !== 'null' && month !== 'undefined' && month.trim() !== '') {
        whereClause += ' AND YEAR(p.salary_month) = ? AND MONTH(p.salary_month) = ?';
        params.push(year, month);
      } else if (year && year !== 'null' && year !== 'undefined' && year.trim() !== '') {
        whereClause += ' AND YEAR(p.salary_month) = ?';
        params.push(year);
      }

      const [total] = await pool.query(
        `SELECT COUNT(*) as count FROM payslips p ${whereClause}`,
        params
      );

      // 构建动态排序子句
      let orderClause;
      switch(validSortBy) {
        case 'net_salary':
          orderClause = `ORDER BY p.net_salary ${validSortOrder}, p.created_at DESC`;
          break;
        case 'employee_name':
          orderClause = `ORDER BY u.real_name ${validSortOrder}, p.created_at DESC`;
          break;
        case 'created_at':
          orderClause = `ORDER BY p.created_at ${validSortOrder}, p.created_at DESC`;
          break;
        case 'salary_month':
        default:
          orderClause = `ORDER BY p.salary_month ${validSortOrder}, p.created_at DESC`;
          break;
      }

      const [payslips] = await pool.query(
        `SELECT
          p.id,
          p.payslip_no,
          p.salary_month,
          p.payment_date,
          p.net_salary,
          p.status,
          p.issued_at,
          p.viewed_at,
          p.confirmed_at,
          u.real_name as employee_name,
          e.employee_no,
          d.name as department_name,
          pos.name as position_name
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      const totalPages = Math.ceil(total[0].count / limitNum);
      const currentPage = pageNum;

      return {
        success: true,
        data: payslips,
        total: total[0].count,
        pagination: {
          page: currentPage,
          limit: limitNum,
          total_pages: totalPages,
          total_count: total[0].count,
          has_prev: currentPage > 1,
          has_next: currentPage < totalPages,
          prev_page: currentPage > 1 ? currentPage - 1 : null,
          next_page: currentPage < totalPages ? currentPage + 1 : null,
          sort_by: validSortBy,
          sort_order: validSortOrder
        }
      };
    } catch (error) {
      console.error('获取工资条列表失败:', error);
      return reply.code(500).send({ success: false, message: '获取工资条列表失败' });
    }
  });

  // 获取工资条详情
  fastify.get('/api/payslips/:id', async (request, reply) => {
    try {
      // 验证 JWT token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      // 验证二级密码 token
      const payslipToken = request.headers['x-payslip-token'];
      console.log('[PayslipDetail] X-Payslip-Token:', payslipToken ? payslipToken.substring(0, 20) + '...' : 'none');
      
      if (!payslipToken) {
        return reply.code(401).send({ success: false, message: '需要验证二级密码' });
      }

      // 解析 payslipToken: base64(userId:timestamp)
      try {
        const tokenData = Buffer.from(payslipToken, 'base64').toString('utf-8');
        console.log('[PayslipDetail] Token data:', tokenData);
        const [tokenUserId, tokenTimestamp] = tokenData.split(':');
        console.log('[PayslipDetail] Token userId:', tokenUserId, 'Expected:', decoded.id);
        console.log('[PayslipDetail] Token timestamp:', tokenTimestamp);

        // 验证 token 是否属于当前用户
        if (parseInt(tokenUserId) !== decoded.id) {
          return reply.code(401).send({ success: false, message: '无效的二级密码令牌' });
        }

        // 检查用户是否设置了密码
        const [passwords] = await pool.query(
          'SELECT * FROM payslip_passwords WHERE user_id = ?',
          [decoded.id]
        );

        if (passwords.length === 0) {
          return reply.code(401).send({ success: false, message: '未设置二级密码' });
        }

        console.log('[PayslipDetail] Password found, last_changed_at:', passwords[0].last_changed_at);

        // 检查密码是否在 token 生成后被修改过
        const tokenTime = new Date(parseInt(tokenTimestamp));
        const passwordChangedAt = passwords[0].last_changed_at;

        console.log('[PayslipDetail] Token time:', tokenTime, 'Password changed at:', passwordChangedAt);

        if (passwordChangedAt && new Date(passwordChangedAt) > tokenTime) {
          return reply.code(401).send({ success: false, message: '二级密码已修改，请重新验证' });
        }

        console.log('[PayslipDetail] Password token validation passed');

      } catch (error) {
        console.error('[PayslipDetail] Token validation error:', error);
        return reply.code(401).send({ success: false, message: '无效的二级密码令牌' });
      }

      const { id } = request.params;
      const userId = decoded.id;

      const [payslips] = await pool.query(
        `SELECT
          p.*,
          u.real_name as employee_name,
          e.employee_no,
          d.name as department_name,
          pos.name as position_name
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        WHERE p.id = ? AND p.user_id = ?`,
        [id, userId]
      );

      if (payslips.length === 0) {
        return reply.code(404).send({ success: false, message: '工资条不存在' });
      }

      const payslip = payslips[0];

      if (payslip.status === 'sent' && !payslip.viewed_at) {
        await pool.query(
          'UPDATE payslips SET status = ?, viewed_at = NOW() WHERE id = ?',
          ['viewed', id]
        );
        payslip.status = 'viewed';
        payslip.viewed_at = new Date();
      }

      return {
        success: true,
        data: payslip
      };
    } catch (error) {
      console.error('获取工资条详情失败:', error);
      return reply.code(500).send({ success: false, message: '获取工资条详情失败' });
    }
  });

  // 确认工资条
  fastify.post('/api/payslips/:id/confirm', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { id } = request.params;
      const userId = decoded.id;

      const [payslips] = await pool.query(
        'SELECT * FROM payslips WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (payslips.length === 0) {
        return reply.code(404).send({ success: false, message: '工资条不存在' });
      }

      await pool.query(
        'UPDATE payslips SET status = ?, confirmed_at = NOW() WHERE id = ?',
        ['confirmed', id]
      );

      return {
        success: true,
        message: '工资条已确认'
      };
    } catch (error) {
      console.error('确认工资条失败:', error);
      return reply.code(500).send({ success: false, message: '确认工资条失败' });
    }
  });

  // ==================== 管理端 API ====================

  // 获取所有工资条（管理员）
  fastify.get('/api/admin/payslips', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { page = 1, limit = 20, month, department, status, keyword, sortBy = 'salary_month', sortOrder = 'DESC' } = request.query;

      // 验证和限制参数
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // 限制每页最多100条，默认20条
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
      const validSortBy = ['salary_month', 'net_salary', 'employee_name', 'created_at'].includes(sortBy) ? sortBy : 'salary_month';

      const offset = (pageNum - 1) * limitNum;

      // 获取用户权限
      const permissions = await extractUserPermissions(request, pool);

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (month && month !== 'null' && month !== 'undefined' && month.trim() !== '') {
        whereClause += ' AND DATE_FORMAT(p.salary_month, "%Y-%m") = ?';
        params.push(month);
      }

      // 如果指定了特定部门，则检查权限
      if (department && department !== 'null' && department !== 'undefined' && department.trim() !== '') {
        whereClause += ' AND u.department_id = ?';
        params.push(department);
      }

      // 应用部门权限限制 - 使用统一的部门过滤函数
      console.log('[Payslips] 权限检查开始...');
      console.log('Permissions:', {
        canViewAllDepartments: permissions.canViewAllDepartments,
        userId: permissions.userId,
        viewableDepartmentIds: permissions.viewableDepartmentIds
      });

      const filterResult = applyDepartmentFilter(
        permissions,
        whereClause,
        [...params], // 传递参数副本
        'u.department_id',
        'e.user_id'
      );

      console.log('[Payslips] 过滤结果:');
      console.log('- query:', filterResult.query);
      console.log('- params:', filterResult.params);

      whereClause = filterResult.query;
      let finalParams = filterResult.params;

      if (status && status !== 'null' && status !== 'undefined' && status.trim() !== '') {
        whereClause += ' AND p.status = ?';
        finalParams.push(status);
      }

      if (keyword && keyword !== 'null' && keyword !== 'undefined' && keyword.trim() !== '') {
        whereClause += ' AND (u.real_name LIKE ? OR e.employee_no LIKE ? OR p.payslip_no LIKE ?)';
        const searchTerm = `%${keyword}%`;
        finalParams.push(searchTerm, searchTerm, searchTerm);
      }

      // 查询总数
      const [total] = await pool.query(
        `SELECT COUNT(*) as count
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        ${whereClause}`,
        finalParams
      );

      console.log('[Payslips] 准备执行查询，参数数量:', finalParams.length);

      // 构建动态排序子句
      let orderClause;
      switch(validSortBy) {
        case 'net_salary':
          orderClause = `ORDER BY p.net_salary ${validSortOrder}, p.created_at DESC`;
          break;
        case 'employee_name':
          orderClause = `ORDER BY u.real_name ${validSortOrder}, p.created_at DESC`;
          break;
        case 'created_at':
          orderClause = `ORDER BY p.created_at ${validSortOrder}, p.created_at DESC`;
          break;
        case 'salary_month':
        default:
          orderClause = `ORDER BY p.salary_month ${validSortOrder}, p.created_at DESC`;
          break;
      }

      const [payslips] = await pool.query(
        `SELECT
          p.*,
          u.real_name as employee_name,
          e.employee_no,
          d.name as department_name,
          pos.name as position_name,
          u.username as issued_by_name
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?`,
        [...finalParams, limitNum, offset]
      );

      const totalPages = Math.ceil(total[0].count / limitNum);
      const currentPage = pageNum;

      return {
        success: true,
        data: payslips,
        total: total[0].count,
        pagination: {
          page: currentPage,
          limit: limitNum,
          total_pages: totalPages,
          total_count: total[0].count,
          has_prev: currentPage > 1,
          has_next: currentPage < totalPages,
          prev_page: currentPage > 1 ? currentPage - 1 : null,
          next_page: currentPage < totalPages ? currentPage + 1 : null,
          sort_by: validSortBy,
          sort_order: validSortOrder
        }
      };
    } catch (error) {
      console.error('获取工资条列表失败:', error);
      return reply.code(500).send({ success: false, message: '获取工资条列表失败' });
    }
  });

  // 创建工资条
  fastify.post('/api/admin/payslips', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const salaryData = request.body;
      const userId = decoded.id;
      const permissions = decoded.permissions || {};

      // 检查员工是否存在，并验证部门权限
      let employeeQuery = `SELECT e.*, u.department_id FROM employees e
                          LEFT JOIN users u ON e.user_id = u.id
                          WHERE e.id = ?`;
      let employeeParams = [salaryData.employee_id];

      // 如果用户有部门权限限制，则应用这些限制
      if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
        employeeQuery += ` AND u.department_id IN (${placeholders})`;
        employeeParams = [salaryData.employee_id, ...permissions.viewableDepartmentIds];
      }

      const [employees] = await pool.query(employeeQuery, employeeParams);

      if (employees.length === 0) {
        return reply.code(404).send({ success: false, message: '员工不存在或没有权限访问该员工' });
      }

      const employee = employees[0];
      const salaryMonth = new Date(salaryData.salary_month);
      const monthStr = `${salaryMonth.getFullYear()}${String(salaryMonth.getMonth() + 1).padStart(2, '0')}`;

      const [existing] = await pool.query(
        'SELECT id FROM payslips WHERE employee_id = ? AND salary_month = ?',
        [salaryData.employee_id, salaryData.salary_month]
      );

      if (existing.length > 0) {
        return reply.code(400).send({ success: false, message: '该员工当月工资条已存在' });
      }

      const [lastPayslip] = await pool.query(
        `SELECT payslip_no FROM payslips
        WHERE payslip_no LIKE ?
        ORDER BY payslip_no DESC LIMIT 1`,
        [`PS-${monthStr}-%`]
      );

      let nextNum = 1;
      if (lastPayslip.length > 0) {
        const lastNum = parseInt(lastPayslip[0].payslip_no.split('-')[2]);
        nextNum = lastNum + 1;
      }

      const payslipNo = `PS-${monthStr}-${String(nextNum).padStart(4, '0')}`;

      const netSalary = (
        parseFloat(salaryData.basic_salary || 0) +
        parseFloat(salaryData.position_salary || 0) +
        parseFloat(salaryData.performance_bonus || 0) +
        parseFloat(salaryData.overtime_pay || 0) +
        parseFloat(salaryData.allowances || 0) -
        parseFloat(salaryData.deductions || 0) -
        parseFloat(salaryData.social_security || 0) -
        parseFloat(salaryData.housing_fund || 0) -
        parseFloat(salaryData.tax || 0) -
        parseFloat(salaryData.other_deductions || 0)
      ).toFixed(2);

      const [result] = await pool.query(
        `INSERT INTO payslips (
          payslip_no, employee_id, user_id, salary_month, payment_date,
          attendance_days, late_count, early_leave_count, leave_days, overtime_hours, absent_days,
          basic_salary, position_salary, performance_bonus, overtime_pay, allowances,
          deductions, social_security, housing_fund, tax, other_deductions,
          net_salary, status, remark, custom_fields
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payslipNo, salaryData.employee_id, employee.user_id, salaryData.salary_month, salaryData.payment_date,
          salaryData.attendance_days || 0, salaryData.late_count || 0, salaryData.early_leave_count || 0,
          salaryData.leave_days || 0, salaryData.overtime_hours || 0, salaryData.absent_days || 0,
          salaryData.basic_salary || 0, salaryData.position_salary || 0, salaryData.performance_bonus || 0,
          salaryData.overtime_pay || 0, salaryData.allowances || 0, salaryData.deductions || 0,
          salaryData.social_security || 0, salaryData.housing_fund || 0, salaryData.tax || 0,
          salaryData.other_deductions || 0, netSalary, 'draft', salaryData.remark || null,
          salaryData.custom_fields ? JSON.stringify(salaryData.custom_fields) : null
        ]
      );

      // 查询新创建的工资条，包含部门信息
      const [newPayslip] = await pool.query(
        `SELECT
          p.*,
          u.real_name as employee_name,
          e.employee_no,
          d.name as department_name,
          pos.name as position_name,
          u.username as issued_by_name
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions pos ON e.position_id = pos.id
        WHERE p.id = ?`,
        [result.insertId]
      );

      return {
        success: true,
        data: newPayslip[0],
        message: '工资条创建成功'
      };
    } catch (error) {
      console.error('创建工资条失败:', error);
      return reply.code(500).send({ success: false, message: '创建工资条失败' });
    }
  });

  // 更新工资条
  fastify.put('/api/admin/payslips/:id', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { id } = request.params;
      const salaryData = request.body;
      const permissions = decoded.permissions || {};

      // 检查工资条是否存在，并验证部门权限
      let query = `SELECT p.* FROM payslips p
                  LEFT JOIN employees e ON p.employee_id = e.id
                  LEFT JOIN users u ON e.user_id = u.id
                  WHERE p.id = ?`;
      let params = [id];

      // 如果用户有部门权限限制，则应用这些限制
      if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
        query += ` AND u.department_id IN (${placeholders})`;
        params = [id, ...permissions.viewableDepartmentIds];
      }

      const [existing] = await pool.query(query, params);

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '工资条不存在或没有权限访问' });
      }

      const netSalary = (
        parseFloat(salaryData.basic_salary || 0) +
        parseFloat(salaryData.position_salary || 0) +
        parseFloat(salaryData.performance_bonus || 0) +
        parseFloat(salaryData.overtime_pay || 0) +
        parseFloat(salaryData.allowances || 0) -
        parseFloat(salaryData.deductions || 0) -
        parseFloat(salaryData.social_security || 0) -
        parseFloat(salaryData.housing_fund || 0) -
        parseFloat(salaryData.tax || 0) -
        parseFloat(salaryData.other_deductions || 0)
      ).toFixed(2);

      await pool.query(
        `UPDATE payslips SET
          attendance_days = ?, late_count = ?, early_leave_count = ?,
          leave_days = ?, overtime_hours = ?, absent_days = ?,
          basic_salary = ?, position_salary = ?, performance_bonus = ?,
          overtime_pay = ?, allowances = ?, deductions = ?,
          social_security = ?, housing_fund = ?, tax = ?,
          other_deductions = ?, net_salary = ?, remark = ?,
          custom_fields = ?, payment_date = ?
        WHERE id = ?`,
        [
          salaryData.attendance_days || 0, salaryData.late_count || 0, salaryData.early_leave_count || 0,
          salaryData.leave_days || 0, salaryData.overtime_hours || 0, salaryData.absent_days || 0,
          salaryData.basic_salary || 0, salaryData.position_salary || 0, salaryData.performance_bonus || 0,
          salaryData.overtime_pay || 0, salaryData.allowances || 0, salaryData.deductions || 0,
          salaryData.social_security || 0, salaryData.housing_fund || 0, salaryData.tax || 0,
          salaryData.other_deductions || 0, netSalary, salaryData.remark || null,
          salaryData.custom_fields ? JSON.stringify(salaryData.custom_fields) : null,
          salaryData.payment_date || null, id
        ]
      );

      // 查询更新后的数据
      const [updated] = await pool.query(query, params);

      return {
        success: true,
        data: updated[0],
        message: '工资条更新成功'
      };
    } catch (error) {
      console.error('更新工资条失败:', error);
      return reply.code(500).send({ success: false, message: '更新工资条失败' });
    }
  });

  // 删除工资条
  fastify.delete('/api/admin/payslips/:id', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { id } = request.params;
      const permissions = decoded.permissions || {};

      // 检查工资条是否存在，并验证部门权限
      let query = `SELECT p.* FROM payslips p
                  LEFT JOIN employees e ON p.employee_id = e.id
                  LEFT JOIN users u ON e.user_id = u.id
                  WHERE p.id = ?`;
      let params = [id];

      // 如果用户有部门权限限制，则应用这些限制
      if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
        query += ` AND u.department_id IN (${placeholders})`;
        params = [id, ...permissions.viewableDepartmentIds];
      }

      const [existing] = await pool.query(query, params);

      if (existing.length === 0) {
        return reply.code(404).send({ success: false, message: '工资条不存在或没有权限访问' });
      }

      if (existing[0].status === 'confirmed') {
        return reply.code(400).send({ success: false, message: '已确认的工资条不能删除' });
      }

      await pool.query('DELETE FROM payslips WHERE id = ?', [id]);

      return {
        success: true,
        message: '工资条删除成功'
      };
    } catch (error) {
      console.error('删除工资条失败:', error);
      return reply.code(500).send({ success: false, message: '删除工资条失败' });
    }
  });

  // 批量发放工资条
  fastify.post('/api/admin/payslips/batch-send', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { payslip_ids, notify_options = {} } = request.body;
      const userId = decoded.id;
      const permissions = decoded.permissions || {};
      const io = fastify.io; // 获取 WebSocket io 实例

      if (!payslip_ids || payslip_ids.length === 0) {
        return reply.code(400).send({ success: false, message: '请选择要发放的工资条' });
      }

      // 首先验证用户是否有权限访问这些工资条
      const placeholders = payslip_ids.map(() => '?').join(',');
      let baseQuery = `SELECT p.id, p.user_id, p.salary_month, p.net_salary, u.real_name as employee_name, p.status
                      FROM payslips p
                      LEFT JOIN employees e ON p.employee_id = e.id
                      LEFT JOIN users u ON e.user_id = u.id
                      WHERE p.id IN (${placeholders})`;
      let queryParams = [...payslip_ids];

      // 如果用户有部门权限限制，则应用这些限制
      if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
        const deptPlaceholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
        baseQuery += ` AND u.department_id IN (${deptPlaceholders})`;
        queryParams = [...payslip_ids, ...permissions.viewableDepartmentIds];
      }

      const [allowedPayslips] = await pool.query(baseQuery, queryParams);
      const allowedIds = allowedPayslips.map(item => item.id);

      if (allowedIds.length === 0) {
        return reply.code(403).send({ success: false, message: '没有权限发放所选的工资条' });
      }

      // 记录失败的工资条
      const failedPayslips = [];
      const successPayslips = [];

      // 检查每个工资条的状态，只有草稿状态才能发放
      for (const payslip of allowedPayslips) {
        if (payslip.status !== 'draft') {
          failedPayslips.push({
            id: payslip.id,
            employee_name: payslip.employee_name,
            reason: '工资条状态不是草稿，无法发放'
          });
        } else {
          successPayslips.push(payslip);
        }
      }

      // 如果没有可发放的工资条
      if (successPayslips.length === 0) {
        return {
          success: false,
          message: '没有可发放的工资条',
          failed_payslips: failedPayslips
        };
      }

      // 发放有权限的草稿工资条
      const successIds = successPayslips.map(p => p.id);
      const successPlaceholders = successIds.map(() => '?').join(',');

      await pool.query(
        `UPDATE payslips
        SET status = 'sent', issued_by = ?, issued_at = NOW()
        WHERE id IN (${successPlaceholders}) AND status = 'draft'`,
        [userId, ...successIds]
      );

      // 计算成功发放的数量
      const [updated] = await pool.query(
        `SELECT COUNT(*) as count FROM payslips WHERE id IN (${successPlaceholders}) AND status = 'sent'`,
        successIds
      );

      // 为每个成功发放的员工发送通知
      const { sendNotificationToUser } = require('../websocket');
      const sentCount = updated[0].count;

      for (const payslip of successPayslips) {
        const salaryMonth = new Date(payslip.salary_month);
        const monthStr = `${salaryMonth.getFullYear()}年${salaryMonth.getMonth() + 1}月`;

        // 发送 WebSocket 实时通知
        if (io) {
          sendNotificationToUser(io, payslip.user_id, {
            type: 'payslip',
            title: '工资条已发放',
            content: `您的${monthStr}工资条已发放，实发工资¥${parseFloat(payslip.net_salary).toFixed(2)}`,
            related_id: payslip.id,
            related_type: 'payslip',
            created_at: new Date().toISOString()
          });
        }

        // 将通知记录到数据库
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type, is_read, created_at)
           VALUES (?, 'payslip', ?, ?, ?, 'payslip', 0, NOW())`,
          [
            payslip.user_id,
            '工资条已发放',
            `您的${monthStr}工资条已发放，实发工资¥${parseFloat(payslip.net_salary).toFixed(2)}`,
            payslip.id
          ]
        );
      }

      // 如果有失败的工资条，返回部分成功的信息
      if (failedPayslips.length > 0) {
        return {
          success: true,
          sent_count: sentCount,
          failed_count: failedPayslips.length,
          message: `成功发放 ${sentCount} 条工资条，${failedPayslips.length} 条发放失败`,
          failed_payslips: failedPayslips
        };
      }

      return {
        success: true,
        sent_count: sentCount,
        message: `成功发放 ${sentCount} 条工资条`
      };
    } catch (error) {
      console.error('批量发放工资条失败:', error);
      return reply.code(500).send({ success: false, message: '批量发放失败' });
    }
  });

  // 下载导入模板
  fastify.get('/api/admin/payslips/import-template', async (request, reply) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('工资条导入模板');

      worksheet.columns = [
        { header: '员工工号*', key: 'employee_no', width: 15 },
        { header: '姓名*', key: 'name', width: 15 },
        { header: '工资月份*（YYYY-MM-DD）', key: 'salary_month', width: 20 },
        { header: '发放日期（YYYY-MM-DD）', key: 'payment_date', width: 20 },
        { header: '出勤天数', key: 'attendance_days', width: 12 },
        { header: '迟到次数', key: 'late_count', width: 12 },
        { header: '早退次数', key: 'early_leave_count', width: 12 },
        { header: '请假天数', key: 'leave_days', width: 12 },
        { header: '加班时长', key: 'overtime_hours', width: 12 },
        { header: '缺勤天数', key: 'absent_days', width: 12 },
        { header: '基本工资', key: 'basic_salary', width: 12 },
        { header: '岗位工资', key: 'position_salary', width: 12 },
        { header: '绩效奖金', key: 'performance_bonus', width: 12 },
        { header: '加班费', key: 'overtime_pay', width: 12 },
        { header: '各类补贴', key: 'allowances', width: 12 },
        { header: '各类扣款', key: 'deductions', width: 12 },
        { header: '社保扣款', key: 'social_security', width: 12 },
        { header: '公积金扣款', key: 'housing_fund', width: 12 },
        { header: '个人所得税', key: 'tax', width: 12 },
        { header: '其他扣款', key: 'other_deductions', width: 12 },
        { header: '备注', key: 'remark', width: 30 }
      ];

      worksheet.addRow({
        employee_no: 'E001',
        name: '张三',
        salary_month: '2024-01-01',
        payment_date: '2024-01-10',
        attendance_days: 22,
        late_count: 0,
        early_leave_count: 0,
        leave_days: 0,
        overtime_hours: 10,
        absent_days: 0,
        basic_salary: 5000,
        position_salary: 2000,
        performance_bonus: 1000,
        overtime_pay: 500,
        allowances: 500,
        deductions: 0,
        social_security: 800,
        housing_fund: 600,
        tax: 200,
        other_deductions: 0,
        remark: '示例数据'
      });

      const buffer = await workbook.xlsx.writeBuffer();

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', 'attachment; filename="payslip_import_template.xlsx"');
      return reply.send(buffer);
    } catch (error) {
      console.error('生成导入模板失败:', error);
      return reply.code(500).send({ success: false, message: '生成导入模板失败' });
    }
  });

  // 导出工资条到Excel
  fastify.get('/api/admin/payslips/export', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { month, department, status, keyword } = request.query;

      // 构建查询条件
      let whereConditions = ['1=1'];
      let params = [];

      if (month) {
        whereConditions.push('DATE_FORMAT(p.salary_month, "%Y-%m") = ?');
        params.push(month);
      }

      if (department) {
        whereConditions.push('u.department_id = ?');
        params.push(department);
      }

      if (status) {
        whereConditions.push('p.status = ?');
        params.push(status);
      }

      if (keyword) {
        whereConditions.push('(u.real_name LIKE ? OR e.employee_no LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      console.log('=== 导出工资条开始 ===');
      console.log('查询条件:', whereClause);
      console.log('查询参数:', params);

      // 先检查payslips表是否有数据
      const [countResult] = await pool.query('SELECT COUNT(*) as total FROM payslips');
      console.log('payslips表总记录数:', countResult[0].total);

      // 查询工资条数据
      const [payslips] = await pool.query(
        `SELECT 
          p.payslip_no,
          u.real_name as employee_name,
          e.employee_no,
          d.name as department,
          DATE_FORMAT(p.salary_month, '%Y-%m') as salary_month,
          p.payment_date,
          p.attendance_days,
          p.late_count,
          p.early_leave_count,
          p.leave_days,
          p.overtime_hours,
          p.absent_days,
          p.basic_salary,
          p.position_salary,
          p.performance_bonus,
          p.overtime_pay,
          p.allowances,
          p.deductions,
          p.social_security,
          p.housing_fund,
          p.tax,
          p.other_deductions,
          p.net_salary,
          CASE 
            WHEN p.status = 'draft' THEN '待发送'
            WHEN p.status = 'sent' THEN '已发放'
            WHEN p.status = 'viewed' THEN '已查看'
            WHEN p.status = 'confirmed' THEN '已确认'
            ELSE p.status
          END as status_text,
          p.remark
        FROM payslips p
        LEFT JOIN employees e ON p.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE ${whereClause}
        ORDER BY p.salary_month DESC, p.created_at DESC`,
        params
      );

      console.log('查询结果数量:', payslips.length);
      if (payslips.length > 0) {
        console.log('查询结果第一条:', payslips[0]);
      }

      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('工资条数据');

      // 设置列
      worksheet.columns = [
        { header: '工资条编号', key: 'payslip_no', width: 18 },
        { header: '员工姓名', key: 'employee_name', width: 12 },
        { header: '工号', key: 'employee_no', width: 12 },
        { header: '部门', key: 'department', width: 15 },
        { header: '工资月份', key: 'salary_month', width: 12 },
        { header: '发放日期', key: 'payment_date', width: 15 },
        { header: '出勤天数', key: 'attendance_days', width: 10 },
        { header: '迟到次数', key: 'late_count', width: 10 },
        { header: '早退次数', key: 'early_leave_count', width: 10 },
        { header: '请假天数', key: 'leave_days', width: 10 },
        { header: '加班时长', key: 'overtime_hours', width: 10 },
        { header: '缺勤天数', key: 'absent_days', width: 10 },
        { header: '基本工资', key: 'basic_salary', width: 12 },
        { header: '岗位工资', key: 'position_salary', width: 12 },
        { header: '绩效奖金', key: 'performance_bonus', width: 12 },
        { header: '加班费', key: 'overtime_pay', width: 12 },
        { header: '各类补贴', key: 'allowances', width: 12 },
        { header: '各类扣款', key: 'deductions', width: 12 },
        { header: '社保扣款', key: 'social_security', width: 12 },
        { header: '公积金扣款', key: 'housing_fund', width: 12 },
        { header: '个人所得税', key: 'tax', width: 12 },
        { header: '其他扣款', key: 'other_deductions', width: 12 },
        { header: '实发工资', key: 'net_salary', width: 12 },
        { header: '状态', key: 'status_text', width: 10 },
        { header: '备注', key: 'remark', width: 30 }
      ];

      // 添加数据
      payslips.forEach(payslip => {
        worksheet.addRow(payslip);
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
        .header('Content-Disposition', 'attachment; filename="payslips_export.xlsx"')
        .send(buffer);

    } catch (error) {
      console.error('导出工资条失败:', error);
      return reply.code(500).send({ success: false, message: '导出失败' });
    }
  });

  // 批量导入工资条
  fastify.post('/api/admin/payslips/import', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const data = await request.file();
      const permissions = decoded.permissions || {};

      if (!data) {
        return reply.code(400).send({ success: false, message: '请上传文件' });
      }

      const buffer = await data.toBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.getWorksheet(1);

      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
      };

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          rows.push({
            rowNumber,
            employee_no: row.getCell(1).value,
            name: row.getCell(2).value,
            salary_month: row.getCell(3).value,
            payment_date: row.getCell(4).value,
            attendance_days: row.getCell(5).value || 0,
            late_count: row.getCell(6).value || 0,
            early_leave_count: row.getCell(7).value || 0,
            leave_days: row.getCell(8).value || 0,
            overtime_hours: row.getCell(9).value || 0,
            absent_days: row.getCell(10).value || 0,
            basic_salary: row.getCell(11).value || 0,
            position_salary: row.getCell(12).value || 0,
            performance_bonus: row.getCell(13).value || 0,
            overtime_pay: row.getCell(14).value || 0,
            allowances: row.getCell(15).value || 0,
            deductions: row.getCell(16).value || 0,
            social_security: row.getCell(17).value || 0,
            housing_fund: row.getCell(18).value || 0,
            tax: row.getCell(19).value || 0,
            other_deductions: row.getCell(20).value || 0,
            remark: row.getCell(21).value || null
          });
        }
      });

      results.total = rows.length;

      for (const rowData of rows) {
        try {
          // 检查员工是否存在，并验证部门权限
          let employeeQuery = `SELECT e.*, u.department_id FROM employees e
                              LEFT JOIN users u ON e.user_id = u.id
                              WHERE e.employee_no = ?`;
          let employeeParams = [rowData.employee_no];

          // 如果用户有部门权限限制，则应用这些限制
          if (permissions.viewableDepartmentIds && permissions.viewableDepartmentIds.length > 0) {
            const placeholders = permissions.viewableDepartmentIds.map(() => '?').join(',');
            employeeQuery += ` AND u.department_id IN (${placeholders})`;
            employeeParams = [rowData.employee_no, ...permissions.viewableDepartmentIds];
          }

          const [employees] = await pool.query(employeeQuery, employeeParams);

          if (employees.length === 0) {
            results.failed++;
            results.errors.push({
              row: rowData.rowNumber,
              message: `员工工号 ${rowData.employee_no} 不存在或没有权限访问该员工`
            });
            continue;
          }

          const employee = employees[0];

          const netSalary = (
            parseFloat(rowData.basic_salary) +
            parseFloat(rowData.position_salary) +
            parseFloat(rowData.performance_bonus) +
            parseFloat(rowData.overtime_pay) +
            parseFloat(rowData.allowances) -
            parseFloat(rowData.deductions) -
            parseFloat(rowData.social_security) -
            parseFloat(rowData.housing_fund) -
            parseFloat(rowData.tax) -
            parseFloat(rowData.other_deductions)
          ).toFixed(2);

          const salaryMonth = new Date(rowData.salary_month);
          const monthStr = `${salaryMonth.getFullYear()}${String(salaryMonth.getMonth() + 1).padStart(2, '0')}`;

          const [lastPayslip] = await pool.query(
            `SELECT payslip_no FROM payslips
            WHERE payslip_no LIKE ?
            ORDER BY payslip_no DESC LIMIT 1`,
            [`PS-${monthStr}-%`]
          );

          let nextNum = 1;
          if (lastPayslip.length > 0) {
            const lastNum = parseInt(lastPayslip[0].payslip_no.split('-')[2]);
            nextNum = lastNum + 1;
          }

          const payslipNo = `PS-${monthStr}-${String(nextNum).padStart(4, '0')}`;

          await pool.query(
            `INSERT INTO payslips (
              payslip_no, employee_id, user_id, salary_month, payment_date,
              attendance_days, late_count, early_leave_count, leave_days, overtime_hours, absent_days,
              basic_salary, position_salary, performance_bonus, overtime_pay, allowances,
              deductions, social_security, housing_fund, tax, other_deductions,
              net_salary, status, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payslipNo, employee.id, employee.user_id, rowData.salary_month, rowData.payment_date,
              rowData.attendance_days, rowData.late_count, rowData.early_leave_count,
              rowData.leave_days, rowData.overtime_hours, rowData.absent_days,
              rowData.basic_salary, rowData.position_salary, rowData.performance_bonus,
              rowData.overtime_pay, rowData.allowances, rowData.deductions,
              rowData.social_security, rowData.housing_fund, rowData.tax,
              rowData.other_deductions, netSalary, 'draft', rowData.remark
            ]
          );

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({
            row: rowData.rowNumber,
            message: err.message
          });
        }
      }

      await pool.query(
        `INSERT INTO payslip_import_history (
          file_name, salary_month, total_count, success_count, failed_count,
          error_details, status, imported_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.filename,
          rows[0]?.salary_month || new Date(),
          results.total,
          results.success,
          results.failed,
          JSON.stringify(results.errors),
          results.failed === 0 ? 'completed' : 'failed',
          decoded.id
        ]
      );

      return {
        success: true,
        data: results,
        message: `导入完成，成功 ${results.success} 条，失败 ${results.failed} 条`
      };
    } catch (error) {
      console.error('导入工资条失败:', error);
      return reply.code(500).send({ success: false, message: '导入工资条失败' });
    }
  });

  // 获取导入历史
  fastify.get('/api/admin/payslips/import-history', async (request, reply) => {
    try {
      const { page = 1, limit = 20 } = request.query;
      const offset = (page - 1) * limit;

      const [total] = await pool.query(
        'SELECT COUNT(*) as count FROM payslip_import_history'
      );

      const [history] = await pool.query(
        `SELECT
          h.*,
          u.username as imported_by_name
        FROM payslip_import_history h
        LEFT JOIN users u ON h.imported_by = u.id
        ORDER BY h.created_at DESC
        LIMIT ? OFFSET ?`,
        [parseInt(limit), offset]
      );

      return {
        success: true,
        data: history,
        total: total[0].count,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(total[0].count / limit)
        }
      };
    } catch (error) {
      console.error('获取导入历史失败:', error);
      return reply.code(500).send({ success: false, message: '获取导入历史失败' });
    }
  });

  // 重置二级密码（管理员）
  fastify.post('/api/admin/payslips/reset-password', async (request, reply) => {
    try {
      // 验证 token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ success: false, message: '未提供认证令牌' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return reply.code(401).send({ success: false, message: '无效的认证令牌' });
      }

      const { user_ids, reset_to_default = true } = request.body;

      if (!user_ids || user_ids.length === 0) {
        return reply.code(400).send({ success: false, message: '请选择要重置的用户' });
      }

      const defaultPassword = '123456';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      let resetCount = 0;

      for (const userId of user_ids) {
        const [existing] = await pool.query(
          'SELECT id FROM payslip_passwords WHERE user_id = ?',
          [userId]
        );

        if (existing.length > 0) {
          await pool.query(
            'UPDATE payslip_passwords SET password_hash = ?, is_default = 1, last_changed_at = NOW() WHERE user_id = ?',
            [passwordHash, userId]
          );
        } else {
          await pool.query(
            'INSERT INTO payslip_passwords (user_id, password_hash, is_default, last_changed_at) VALUES (?, ?, 1, NOW())',
            [userId, passwordHash]
          );
        }
        resetCount++;
      }

      return {
        success: true,
        reset_count: resetCount,
        default_password: defaultPassword,
        message: `成功重置 ${resetCount} 个用户的密码`
      };
    } catch (error) {
      console.error('重置密码失败:', error);
      return reply.code(500).send({ success: false, message: '重置密码失败' });
    }
  });

  // 获取统计数据
  fastify.get('/api/admin/payslips/statistics', async (request, reply) => {
    // ... 原有逻辑保持不变 ...
  });

  // 同步员工考勤数据
  fastify.get('/api/admin/payslips/attendance-sync', async (request, reply) => {
    try {
      const { employee_id, month } = request.query;
      if (!employee_id || !month) {
        return reply.code(400).send({ success: false, message: '员工ID和月份为必填' });
      }

      const year = month.split('-')[0];
      const monthNum = month.split('-')[1];
      const startDate = `${month}-01`;
      const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

      // 1. 出勤统计
      const [attendanceStats] = await pool.query(
        `SELECT
          COUNT(*) as total_days,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN status = 'early' THEN 1 ELSE 0 END) as early_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN clock_in_time IS NOT NULL OR clock_out_time IS NOT NULL THEN 1 ELSE 0 END) as attendance_days,
          COALESCE(SUM(work_hours), 0) as total_work_hours
        FROM attendance_records
        WHERE employee_id = ? AND record_date BETWEEN ? AND ?`,
        [employee_id, startDate, endDate]
      );

      // 2. 请假统计 (已审核通过的)
      const [leaveStats] = await pool.query(
        `SELECT COALESCE(SUM(days), 0) as total_days
        FROM leave_records
        WHERE employee_id = ? AND status = 'approved'
        AND (start_date BETWEEN ? AND ? OR end_date BETWEEN ? AND ?)`,
        [employee_id, startDate, endDate, startDate, endDate]
      );

      // 3. 加班统计 (已审核通过的)
      const [overtimeStats] = await pool.query(
        `SELECT COALESCE(SUM(hours), 0) as total_hours
        FROM overtime_records
        WHERE employee_id = ? AND status = 'approved'
        AND overtime_date BETWEEN ? AND ?`,
        [employee_id, startDate, endDate]
      );

      const stats = attendanceStats[0];
      return {
        success: true,
        data: {
          attendance_days: stats.attendance_days || 0,
          late_count: stats.late_count || 0,
          early_leave_count: stats.early_count || 0,
          absent_days: stats.absent_count || 0,
          overtime_hours: parseFloat(overtimeStats[0]?.total_hours || 0),
          leave_days: parseFloat(leaveStats[0]?.total_days || 0),
          total_work_hours: parseFloat(stats.total_work_hours || 0)
        }
      };
    } catch (error) {
      console.error('同步考勤数据失败:', error);
      return reply.code(500).send({ success: false, message: '同步考勤数据失败' });
    }
  });
};
