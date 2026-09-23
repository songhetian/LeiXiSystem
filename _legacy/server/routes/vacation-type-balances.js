// 假期类型余额管理 API (新表设计)
const { getBeijingNow } = require('../utils/time');
const { extractUserPermissions, applyDepartmentFilter } = require('../middleware/checkPermission');

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql;



  // 获取或创建员工某年某类型的假期余额
  async function getOrCreateTypeBalance(employeeId, userId, year, vacationTypeId) {
    // 1. 先计算该类型在该年度的法定天数总和 (从 holidays 表)
    let statutoryTotalDays = 0;
    const [holidayStats] = await pool.query(
      'SELECT SUM(days) as total FROM holidays WHERE year = ? AND vacation_type_id = ?',
      [year, vacationTypeId]
    );
    if (holidayStats[0].total) {
      statutoryTotalDays = parseFloat(holidayStats[0].total);
    }

    // 2. 查询现有余额记录
    const [balances] = await pool.query(
      `SELECT * FROM vacation_type_balances
       WHERE employee_id = ? AND year = ? AND vacation_type_id = ?`,
      [employeeId, year, vacationTypeId]
    );

    if (balances.length > 0) {
      const balance = balances[0];
      // 检查是否需要更新总额 (当计算出的法定天数与当前记录不一致时)
      // 不管statutoryTotalDays是否为0，都应该更新到最新的值
      if (parseFloat(balance.total_days) !== statutoryTotalDays) {
        await pool.query(
          'UPDATE vacation_type_balances SET total_days = ?, conversion_date = CURDATE() WHERE id = ?',
          [statutoryTotalDays, balance.id]
        );
        balance.total_days = statutoryTotalDays; // 更新返回对象
        balance.conversion_date = new Date().toISOString().split('T')[0]; // 更新返回对象
      }
      return balance;
    }

    // 3. 如果不存在, 创建新记录
    // 默认天数: 如果 holidays 表有数据则用 holidays 数据, 否则为 0
    const defaultDays = statutoryTotalDays;

    const [result] = await pool.query(
      `INSERT INTO vacation_type_balances
       (employee_id, user_id, year, vacation_type_id, total_days, used_days, conversion_date)
       VALUES (?, ?, ?, ?, ?, 0, CURDATE())`,
      [employeeId, userId, year, vacationTypeId, defaultDays]
    );

    const [newBalance] = await pool.query(
      'SELECT * FROM vacation_type_balances WHERE id = ?',
      [result.insertId]
    );

    return newBalance[0];
  }

  // 获取员工所有假期类型余额
  fastify.get('/api/vacation/type-balances/:employee_id', async (request, reply) => {
    const { employee_id } = request.params;
    const { year = parseInt(getBeijingNow().substring(0, 4)) } = request.query;

    try {
      // 获取用户ID
      const [employees] = await pool.query(
        'SELECT user_id FROM employees WHERE id = ?',
        [employee_id]
      );

      if (employees.length === 0) {
        return reply.code(404).send({ success: false, message: '员工不存在' });
      }

      const userId = employees[0].user_id;

      // 获取所有启用的假期类型
      const [vacationTypes] = await pool.query(
        'SELECT * FROM vacation_types WHERE enabled = TRUE ORDER BY code'
      );

      // 为每种类型获取或创建余额记录
      const balances = [];
      for (const type of vacationTypes) {
        const balance = await getOrCreateTypeBalance(employee_id, userId, year, type.id);
        balances.push({
          type_id: type.id,
          type_code: type.code,
          type_name: type.name,
          total: parseFloat(balance.total_days),
          used: parseFloat(balance.used_days),
          remaining: parseFloat(balance.total_days) - parseFloat(balance.used_days),
          conversion_date: balance.conversion_date,
          remaining_carryover_days: parseFloat(balance.remaining_carryover_days || 0)
        });
      }

      return {
        success: true,
        data: {
          employee_id: parseInt(employee_id),
          year: parseInt(year),
          balances
        }
      };
    } catch (error) {
      console.error('❌ 获取假期类型余额失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 获取所有员工的假期余额汇总
  fastify.get('/api/vacation/type-balances/all', async (request, reply) => {
    const { year = parseInt(getBeijingNow().substring(0, 4)), page = 1, limit = 20, department_id, search } = request.query;

    try {
      // 获取用户权限
      const permissions = await extractUserPermissions(request, pool);

      // 构建查询
      let query = `
        SELECT DISTINCT e.id as employee_id, e.employee_no, u.real_name as employee_name,
               d.name as department_name, u.department_id
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE e.status = 'active'
      `;
      const params = [];

      // 应用权限过滤
      const filtered = applyDepartmentFilter(permissions, query, params);
      query = filtered.query;
      // params are modified in place by applyDepartmentFilter, but let's be safe
      // Actually applyDepartmentFilter returns {query, params}, but params array is passed by reference?
      // Looking at checkPermission.js: params.push(...) so it modifies the array.
      // But it also returns it.
      // Let's use the returned query. The params array passed in is modified.

      if (department_id) {
        query += ' AND u.department_id = ?';
        params.push(department_id);
      }

      if (search) {
        query += ' AND (u.real_name LIKE ? OR e.employee_no LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY e.employee_no LIMIT ? OFFSET ?';
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const [employees] = await pool.query(query, params);

      // 获取所有启用的假期类型
      const [vacationTypes] = await pool.query(
        'SELECT * FROM vacation_types WHERE enabled = TRUE ORDER BY code'
      );

      // 为每个员工获取所有类型的余额
      const result = [];
      for (const emp of employees) {
        const balances = [];
        for (const type of vacationTypes) {
          const balance = await getOrCreateTypeBalance(emp.employee_id, emp.employee_id, year, type.id);
          balances.push({
            type_id: type.id,
            type_code: type.code,
            type_name: type.name,
            total: parseFloat(balance.total_days),
            used: parseFloat(balance.used_days),
            remaining: parseFloat(balance.total_days) - parseFloat(balance.used_days),
            conversion_date: balance.conversion_date,
            remaining_carryover_days: parseFloat(balance.remaining_carryover_days || 0)
          });
        }

        result.push({
          employee_id: emp.employee_id,
          employee_no: emp.employee_no,
          employee_name: emp.employee_name,
          department_name: emp.department_name,
          vacation_balances: balances
        });
      }

      // 获取总数
      let countQuery = 'SELECT COUNT(DISTINCT e.id) as total FROM employees e LEFT JOIN users u ON e.user_id = u.id WHERE e.status = \'active\'';
      const countParams = [];

      // 应用权限过滤到总数查询
      const countFiltered = applyDepartmentFilter(permissions, countQuery, countParams);
      countQuery = countFiltered.query;

      if (department_id) {
        countQuery += ' AND u.department_id = ?';
        countParams.push(department_id);
      }
      if (search) {
        countQuery += ' AND (u.real_name LIKE ? OR e.employee_no LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }
      const [countResult] = await pool.query(countQuery, countParams);

      return {
        success: true,
        data: result,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total
        }
      };
    } catch (error) {
      console.error('❌ 获取全员假期余额失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 加班转换为假期
  fastify.post('/api/vacation/overtime/convert', async (request, reply) => {
    const { employee_id, overtime_hours, target_type_id, conversion_rule_id } = request.body;
    const operatorId = request.user?.id || null;

    if (!employee_id || !overtime_hours || !target_type_id) {
      return reply.code(400).send({ success: false, message: '缺少必填参数' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 获取用户ID
      const [employees] = await connection.query(
        'SELECT user_id FROM employees WHERE id = ?',
        [employee_id]
      );

      if (employees.length === 0) {
        await connection.rollback();
        connection.release();
        return reply.code(404).send({ success: false, message: '员工不存在' });
      }

      const userId = employees[0].user_id;
      const year = parseInt(getBeijingNow().substring(0, 4));

      // 获取转换规则
      let conversionRatio = 1.0; // 默认比例
      if (conversion_rule_id) {
        const [rules] = await connection.query(
          'SELECT ratio FROM conversion_rules WHERE id = ? AND enabled = TRUE',
          [conversion_rule_id]
        );
        if (rules.length > 0) {
          conversionRatio = parseFloat(rules[0].ratio);
        }
      } else {
        // 尝试查找默认规则
        const [defaultRules] = await connection.query(
          `SELECT ratio FROM conversion_rules
           WHERE source_type = 'overtime' AND target_type = (
             SELECT code FROM vacation_types WHERE id = ?
           ) AND enabled = TRUE
           LIMIT 1`,
          [target_type_id]
        );
        if (defaultRules.length > 0) {
          conversionRatio = parseFloat(defaultRules[0].ratio);
        }
      }

      // 计算转换天数 (例如: 8小时 * 1.0比例 / 8 = 1天)
      const convertedDays = (parseFloat(overtime_hours) * conversionRatio) / 8;

      // 获取或创建目标假期类型余额
      const balance = await getOrCreateTypeBalance(employee_id, userId, year, target_type_id);

      // 更新余额
      await connection.query(
        `UPDATE vacation_type_balances
         SET total_days = total_days + ?, updated_at = NOW()
         WHERE id = ?`,
        [convertedDays, balance.id]
      );

      // 记录转换历史
      await connection.query(
        `INSERT INTO overtime_conversions
         (employee_id, user_id, overtime_hours, target_vacation_type_id,
          converted_days, conversion_rule_id, conversion_ratio, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, userId, overtime_hours, target_type_id,
          convertedDays, conversion_rule_id, conversionRatio, operatorId]
      );

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: '转换成功',
        data: {
          overtime_hours: parseFloat(overtime_hours),
          converted_days: convertedDays,
          conversion_ratio: conversionRatio
        }
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('❌ 加班转换失败:', error);
      return reply.code(500).send({ success: false, message: '转换失败: ' + error.message });
    }
  });

  // 获取加班转换历史
  fastify.get('/api/vacation/overtime/conversions', async (request, reply) => {
    const { employee_id, page = 1, limit = 20 } = request.query;

    try {
      let query = `
        SELECT oc.*, vt.name as vacation_type_name, vt.code as vacation_type_code,
               u.real_name as created_by_name
        FROM overtime_conversions oc
        LEFT JOIN vacation_types vt ON oc.target_vacation_type_id = vt.id
        LEFT JOIN users u ON oc.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (employee_id) {
        query += ' AND oc.employee_id = ?';
        params.push(employee_id);
      }

      query += ' ORDER BY oc.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const [records] = await pool.query(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM overtime_conversions WHERE 1=1';
      const countParams = [];
      if (employee_id) {
        countQuery += ' AND employee_id = ?';
        countParams.push(employee_id);
      }
      const [countResult] = await pool.query(countQuery, countParams);

      return {
        success: true,
        data: records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total
        }
      };
    } catch (error) {
      console.error('❌ 获取转换历史失败:', error);
      return reply.code(500).send({ success: false, message: '获取失败' });
    }
  });

  // 装饰 fastify 实例,供其他路由使用
  fastify.decorate('getOrCreateTypeBalance', getOrCreateTypeBalance);
};
