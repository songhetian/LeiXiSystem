// 员工批量操作 API
const bcrypt = require('bcryptjs')
const { syncUserChatGroups } = require('../utils/personnelClosure')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql
  const redis = fastify.redis

  // 批量导入员工
  fastify.post('/api/employees/batch-import', async (request, reply) => {
    const { employees } = request.body

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return reply.code(400).send({
        success: false,
        message: '请提供员工数据'
      })
    }

    let successCount = 0
    let failCount = 0
    const errors = []
    const passwordHashDefault = '$2b$10$ZmQ5snpKRKE4E1uM7NDSLeYkouyYOIK1fvsZ6BOwQ0mPhsWo4HJTG'; // 默认 123456

    // 获取当前最大工号用于连续生成
    let currentMaxNumber = 0;
    try {
      const [maxEmpRows] = await pool.query('SELECT employee_no FROM employees WHERE employee_no REGEXP "^EMP[0-9]+$" ORDER BY LENGTH(employee_no) DESC, employee_no DESC LIMIT 1');
      if (maxEmpRows.length > 0) {
        currentMaxNumber = parseInt(maxEmpRows[0].employee_no.replace(/\D/g, ''));
      }
    } catch (err) {
      console.error('获取初始最大工号失败:', err);
    }

    // 缓存部门映射
    const departmentMap = {};
    try {
      const [depts] = await pool.query('SELECT id, name FROM departments WHERE status != "deleted"');
      depts.forEach(d => departmentMap[d.name] = d.id);
    } catch (err) {
      console.error('读取部门列表失败:', err);
    }

    for (const emp of employees) {
      try {
        // 验证必填字段 (不再要求从导入文件提供 employee_no)
        if (!emp.real_name || !emp.department_name || !emp.hire_date) {
          errors.push(`${emp.real_name || '未知'}: 缺少姓名/部门/入职日期`);
          failCount++
          continue
        }

        // 查找部门 ID
        const department_id = departmentMap[emp.department_name];
        if (!department_id) {
          errors.push(`${emp.real_name}: 部门 "${emp.department_name}" 不存在`);
          failCount++
          continue
        }

        // 自动生成连续工号
        currentMaxNumber++;
        const finalEmployeeNo = `EMP${String(currentMaxNumber).padStart(4, '0')}`;

        // 确定用户名：提供则用，否则用姓名
        const username = emp.username || emp.real_name;

        // 检查用户名是否已存在
        const [existingUser] = await pool.query(
          'SELECT id FROM users WHERE username = ?',
          [username]
        )

        if (existingUser.length > 0) {
          errors.push(`${emp.real_name}: 用户名(账号) "${username}" 已存在`);
          failCount++
          // 回退工号计数器，因为这次导入失败了
          currentMaxNumber--;
          continue
        }

        // 处理密码：如果导入提供了则加密，否则用默认
        let hashedPassword = passwordHashDefault;
        if (emp.password) {
          hashedPassword = await bcrypt.hash(emp.password, 10);
        }

        // 处理日期
        let formattedHireDate = emp.hire_date;
        if (emp.hire_date && typeof emp.hire_date === 'string' && emp.hire_date.includes('T')) {
          formattedHireDate = emp.hire_date.split('T')[0];
        }

        const empStatus = emp.status || 'active';

        // 创建用户
        const [userResult] = await pool.query(
          `INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            username,
            hashedPassword,
            emp.real_name,
            emp.email,
            emp.phone,
            department_id,
            empStatus
          ]
        )

        const userId = userResult.insertId

        // 根据导入的职位名称查找或创建职位ID
        let positionId = null;
        if (emp.position) {
          const [existingPos] = await pool.query(
            'SELECT id FROM positions WHERE name = ?',
            [emp.position]
          );

          if (existingPos.length > 0) {
            positionId = existingPos[0].id;
          } else {
            // 创建新职位
            const [newPosResult] = await pool.query(
              'INSERT INTO positions (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
              [emp.position, 'active']
            );
            positionId = newPosResult.insertId;
          }
        }

        // 创建员工记录
        const [employeeResult] = await pool.query(
          `INSERT INTO employees
           (user_id, employee_no, position_id, hire_date, rating, status,
            emergency_contact, emergency_phone, address, education, skills, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            finalEmployeeNo,
            positionId,
            formattedHireDate,
            emp.rating || 3,
            empStatus,
            emp.emergency_contact,
            emp.emergency_phone,
            emp.address,
            emp.education,
            emp.skills,
            emp.remark
          ]
        )

        // 自动化聊天群组同步 (闭环)
        try {
          if (empStatus === 'active') {
            await syncUserChatGroups(pool, userId, department_id, true, redis, fastify.io);
          }
        } catch (chatErr) {
          console.error(`批量导入员工 ${emp.real_name} 自动加群失败:`, chatErr);
        }

        // 记录入职变动
        try {
          await pool.query(
            `INSERT INTO employee_changes
            (employee_id, user_id, change_type, change_date, old_department_id, new_department_id, old_position_id, new_position_id, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              employeeResult.insertId,
              userId,
              'hire',
              formattedHireDate,
              null,
              department_id,
              null,
              positionId,
              '批量导入入职'
            ]
          );
        } catch (e) {
          console.error('批量导入创建变动记录失败:', e);
        }

        successCount++
      } catch (error) {
        console.error(`导入员工失败 (${emp.real_name}):`, error)
        errors.push(`${emp.real_name}: ${error.message}`)
        failCount++
        // 如果是已经在分配工号阶段出的错，回退
        currentMaxNumber--;
      }
    }

    // 清理缓存
    if (redis) {
      const keys = await redis.keys('list:employees:default:*');
      if (keys.length > 0) await redis.del(...keys);
    }

    return {
      success: true,
      message: `导入完成：成功 ${successCount} 名，失败 ${failCount} 名`,
      successCount,
      failCount,
      errors: errors.slice(0, 10) // 只返回前10个错误
    }
  })
}

