const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306
};

async function generateTestData() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 连接到数据库');

    // 1. 创建部门
    console.log('\n📦 创建部门...');
    const departments = [
      { name: '客服部', description: '负责客户服务和支持' },
      { name: '技术部', description: '负责技术开发和维护' },
      { name: '市场部', description: '负责市场推广和营销' },
      { name: '人力资源部', description: '负责人事管理和招聘' }
    ];

    const deptIds = {};
    for (const dept of departments) {
      const [result] = await connection.query(
        'INSERT INTO departments (name, description, status) VALUES (?, ?, ?)',
        [dept.name, dept.description, 'active']
      );
      deptIds[dept.name] = result.insertId;
      console.log(`  ✓ ${dept.name} (ID: ${result.insertId})`);
    }

    // 2. 创建测试员工
    console.log('\n👥 创建员工...');
    const employees = [
      { name: '张三', dept: '客服部', position: '客服专员', phone: '13800138001' },
      { name: '李四', dept: '客服部', position: '高级客服专员', phone: '13800138002' },
      { name: '王五', dept: '客服部', position: '客服主管', phone: '13800138003' },
      { name: '赵六', dept: '技术部', position: '开发工程师', phone: '13800138004' },
      { name: '钱七', dept: '技术部', position: '高级开发工程师', phone: '13800138005' },
      { name: '孙八', dept: '技术部', position: '技术经理', phone: '13800138006' },
      { name: '周九', dept: '市场部', position: '市场专员', phone: '13800138007' },
      { name: '吴十', dept: '市场部', position: '市场经理', phone: '13800138008' },
      { name: '郑一', dept: '人力资源部', position: 'HR专员', phone: '13800138009' },
      { name: '陈二', dept: '人力资源部', position: 'HR经理', phone: '13800138010' }
    ];

    const defaultPassword = await bcrypt.hash('123456', 10);

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const username = `user${i + 1}`;

      // 创建用户
      const [userResult] = await connection.query(
        `INSERT INTO users (username, password_hash, real_name, email, phone, department_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, defaultPassword, emp.name, `${username}@example.com`, emp.phone, deptIds[emp.dept], 'active']
      );

      const userId = userResult.insertId;

      // 获取下一个工号（自动生成）
      const [maxEmpNo] = await connection.query(
        'SELECT employee_no FROM employees ORDER BY id DESC LIMIT 1'
      );

      let nextEmpNo;
      if (maxEmpNo.length > 0 && maxEmpNo[0].employee_no) {
        // 提取数字部分并加1
        const lastNo = parseInt(maxEmpNo[0].employee_no.replace(/\D/g, ''));
        nextEmpNo = `EMP${String(lastNo + 1).padStart(4, '0')}`;
      } else {
        // 第一个员工从 EMP0001 开始（admin 是 ADMIN001）
        nextEmpNo = 'EMP0001';
      }

      // 创建员工记录
      await connection.query(
        `INSERT INTO employees (user_id, employee_no, position, hire_date, status)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, nextEmpNo, emp.position, new Date(), 'active']
      );

      console.log(`  ✓ ${emp.name} (${nextEmpNo}) - ${emp.dept} - ${emp.position}`);
    }

    console.log('\n✅ 测试数据生成成功！');
    console.log('\n📋 登录信息：');
    console.log('  管理员: admin / admin123');
    console.log('  测试员工: user1~user10 / 123456');

  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

generateTestData();
