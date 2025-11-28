const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306
};

const permissions = [
  // 用户管理
  { code: 'user:view', name: '查看用户', resource: 'user', action: 'view', module: 'system', description: '查看用户列表和详情' },
  { code: 'user:create', name: '创建用户', resource: 'user', action: 'create', module: 'system', description: '创建新用户' },
  { code: 'user:edit', name: '编辑用户', resource: 'user', action: 'edit', module: 'system', description: '编辑用户信息' },
  { code: 'user:delete', name: '删除用户', resource: 'user', action: 'delete', module: 'system', description: '删除用户' },

  // 角色管理
  { code: 'role:view', name: '查看角色', resource: 'role', action: 'view', module: 'system', description: '查看角色列表' },
  { code: 'role:create', name: '创建角色', resource: 'role', action: 'create', module: 'system', description: '创建新角色' },
  { code: 'role:edit', name: '编辑角色', resource: 'role', action: 'edit', module: 'system', description: '编辑角色信息' },
  { code: 'role:delete', name: '删除角色', resource: 'role', action: 'delete', module: 'system', description: '删除角色' },
  { code: 'role:assign', name: '分配角色', resource: 'role', action: 'assign', module: 'system', description: '给用户分配角色' },

  // 员工管理
  { code: 'employee:view', name: '查看员工', resource: 'employee', action: 'view', module: 'employee', description: '查看员工档案' },
  { code: 'employee:create', name: '创建员工', resource: 'employee', action: 'create', module: 'employee', description: '创建员工档案' },
  { code: 'employee:edit', name: '编辑员工', resource: 'employee', action: 'edit', module: 'employee', description: '编辑员工档案' },
  { code: 'employee:delete', name: '删除员工', resource: 'employee', action: 'delete', module: 'employee', description: '删除员工档案' },

  // 考勤管理
  { code: 'attendance:view', name: '查看考勤', resource: 'attendance', action: 'view', module: 'attendance', description: '查看考勤记录' },
  { code: 'attendance:edit', name: '编辑考勤', resource: 'attendance', action: 'edit', module: 'attendance', description: '补卡/修改考勤' },
  { code: 'attendance:approve', name: '审批考勤', resource: 'attendance', action: 'approve', module: 'attendance', description: '审批考勤申请' },
  { code: 'schedule:manage', name: '排班管理', resource: 'schedule', action: 'manage', module: 'attendance', description: '管理排班' },

  // 知识库
  { code: 'knowledge:view', name: '查看知识库', resource: 'knowledge', action: 'view', module: 'knowledge', description: '查看知识库文章' },
  { code: 'knowledge:create', name: '创建文章', resource: 'knowledge', action: 'create', module: 'knowledge', description: '发布新文章' },
  { code: 'knowledge:edit', name: '编辑文章', resource: 'knowledge', action: 'edit', module: 'knowledge', description: '编辑文章' },
  { code: 'knowledge:delete', name: '删除文章', resource: 'knowledge', action: 'delete', module: 'knowledge', description: '删除文章' },
  { code: 'knowledge:audit', name: '审核文章', resource: 'knowledge', action: 'audit', module: 'knowledge', description: '审核文章发布' },

  // 培训考核
  { code: 'exam:view', name: '查看考试', resource: 'exam', action: 'view', module: 'training', description: '查看考试列表' },
  { code: 'exam:create', name: '创建考试', resource: 'exam', action: 'create', module: 'training', description: '创建新考试' },
  { code: 'exam:grade', name: '阅卷', resource: 'exam', action: 'grade', module: 'training', description: '批改试卷' },
];

const roles = [
  { name: '超级管理员', description: '系统最高权限', level: 1 },
  { name: '部门经理', description: '管理本部门事务', level: 2 },
  { name: '普通员工', description: '普通员工权限', level: 3 }
];

async function initPermissions() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 连接到数据库');

    // 1. 初始化权限
    console.log('\n🔒 初始化权限...');
    for (const perm of permissions) {
      const [existing] = await connection.query('SELECT id FROM permissions WHERE code = ?', [perm.code]);
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO permissions (code, name, resource, action, module, description, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [perm.code, perm.name, perm.resource, perm.action, perm.module, perm.description]
        );
        console.log(`  + 添加权限: ${perm.name} (${perm.code})`);
      } else {
        // console.log(`  = 权限已存在: ${perm.code}`);
      }
    }

    // 2. 初始化角色
    console.log('\nbusts 初始化角色...');
    const roleIds = {};
    for (const role of roles) {
      const [existing] = await connection.query('SELECT id FROM roles WHERE name = ?', [role.name]);
      let roleId;
      if (existing.length === 0) {
        const [result] = await connection.query(
          'INSERT INTO roles (name, description, level, created_at) VALUES (?, ?, ?, NOW())',
          [role.name, role.description, role.level]
        );
        roleId = result.insertId;
        console.log(`  + 添加角色: ${role.name}`);
      } else {
        roleId = existing[0].id;
        // console.log(`  = 角色已存在: ${role.name}`);
      }
      roleIds[role.name] = roleId;
    }

    // 3. 分配权限给角色
    console.log('\n🔗 分配权限...');

    // 获取所有权限ID
    const [allPerms] = await connection.query('SELECT id, code FROM permissions');
    const permMap = {};
    allPerms.forEach(p => permMap[p.code] = p.id);

    // 超级管理员：所有权限
    const adminRoleId = roleIds['超级管理员'];
    if (adminRoleId) {
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [adminRoleId]);
      for (const p of allPerms) {
        await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [adminRoleId, p.id]);
      }
      console.log('  ✓ 超级管理员: 已分配所有权限');
    }

    // 部门经理：查看/编辑/审批
    const managerRoleId = roleIds['部门经理'];
    if (managerRoleId) {
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [managerRoleId]);
      const managerPermCodes = [
        'employee:view', 'attendance:view', 'attendance:approve', 'schedule:manage',
        'knowledge:view', 'knowledge:create', 'exam:view', 'exam:grade'
      ];
      for (const code of managerPermCodes) {
        if (permMap[code]) {
          await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [managerRoleId, permMap[code]]);
        }
      }
      console.log('  ✓ 部门经理: 已分配管理权限');
    }

    // 普通员工：基本查看权限
    const employeeRoleId = roleIds['普通员工'];
    if (employeeRoleId) {
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [employeeRoleId]);
      const empPermCodes = [
        'knowledge:view', 'exam:view'
      ];
      for (const code of empPermCodes) {
        if (permMap[code]) {
          await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [employeeRoleId, permMap[code]]);
        }
      }
      console.log('  ✓ 普通员工: 已分配基础权限');
    }

    // 4. 给 admin 用户分配超级管理员角色
    console.log('\n👤 分配角色给用户...');
    const [adminUser] = await connection.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (adminUser.length > 0) {
      const adminUserId = adminUser[0].id;
      // 检查是否已分配
      const [hasRole] = await connection.query('SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?', [adminUserId, adminRoleId]);
      if (hasRole.length === 0) {
        await connection.query('INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES (?, ?, NOW())', [adminUserId, adminRoleId]);
        console.log('  ✓ 用户 admin 已分配 超级管理员 角色');
      } else {
        console.log('  = 用户 admin 已拥有 超级管理员 角色');
      }
    }

    console.log('\n✅ 权限初始化完成！');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

initPermissions();
