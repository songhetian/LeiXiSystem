// 员工批量操作 API
const bcrypt = require('bcrypt')

module.exports = async function (fastify, opts) {
  const pool = fastify.mysql

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

    for (const emp of employees) {
      try {
        // 验证必填字段
        if (!emp.employee_no || !emp.real_name || !emp.username || !emp.password || !emp.department_id || !emp.hire_date) {
          errors.push(`${emp.employee_no || '未知'}: 缺少必填字段`)
          failCount++
          continue
        }

        // 检查工号是否已存在
        const [existingEmp] = await pool.query(
          'SELECT id FROM employees WHERE employee_no = ?',
          [emp.employee_no]
        )

        if (existingEmp.length > 0) {
          errors.push(`${emp.employee_no}: 工号已存在`)
          failCount++
          continue
        }

        // 检查用户名是否已存在
        const [existingUser] = await pool.query(
          'SELECT id FROM users WHERE username = ?',
          [emp.username]
        )

        if (existingUser.length > 0) {
          errors.push(`${emp.username}: 用户名已存在`)
          failCount++
          continue
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(emp.password, 10)

        // 创建用户
        const [userResult] = await pool.query(
          `INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            emp.username,
            hashedPassword,
            emp.real_name,
            emp.email,
            emp.phone,
            emp.department_id,
            emp.status || 'active'
          ]
        )

        const userId = userResult.insertId

        // 创建员工记录
        await pool.query(
          `INSERT INTO employees
           (user_id, employee_no, position, hire_date, rating, status,
            emergency_contact, emergency_phone, address, education, skills, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            emp.employee_no,
            emp.position,
            emp.hire_date,
            emp.rating || 3,
            emp.status || 'active',
            emp.emergency_contact,
            emp.emergency_phone,
            emp.address,
            emp.education,
            emp.skills,
            emp.remark
          ]
        )

        successCount++
      } catch (error) {
        console.error(`导入员工失败 (${emp.employee_no}):`, error)
        errors.push(`${emp.employee_no}: ${error.message}`)
        failCount++
      }
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
