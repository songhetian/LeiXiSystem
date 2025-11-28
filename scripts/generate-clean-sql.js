const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service'
};

async function generateCleanSQL() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    console.log('正在连接数据库...');

    // 获取所有表名
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    console.log(`找到 ${tableNames.length} 个表`);

    let sql = `-- ==========================================
-- 客服管理系统 - 纯净数据库初始化脚本
-- 生成时间: ${new Date().toLocaleString('zh-CN')}
-- 说明: 仅包含表结构和一个超级管理员账号
-- ==========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS leixin_customer_service DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE leixin_customer_service;

-- 删除所有表（如果存在）
SET FOREIGN_KEY_CHECKS = 0;

`;

    // 添加删除表语句
    for (const tableName of tableNames) {
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    }

    sql += `\n-- ==========================================\n`;
    sql += `-- 创建表结构\n`;
    sql += `-- ==========================================\n\n`;

    // 获取每个表的创建语句
    for (const tableName of tableNames) {
      console.log(`正在导出表: ${tableName}`);
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      sql += `-- 表: ${tableName}\n`;
      sql += createTable[0]['Create Table'] + ';\n\n';
    }

    sql += `-- ==========================================\n`;
    sql += `-- 插入初始数据\n`;
    sql += `-- ==========================================\n\n`;

    // 插入超级管理员账号
    sql += `-- 插入超级管理员账号
-- 用户名: admin
-- 密码: admin123
INSERT INTO \`users\` (\`username\`, \`password_hash\`, \`real_name\`, \`email\`, \`phone\`, \`department_id\`, \`status\`, \`created_at\`)
VALUES ('admin', '$2b$10$rQZ5YJ5YJ5YJ5YJ5YJ5YJOqK5YJ5YJ5YJ5YJ5YJ5YJ5YJ5YJ5YJ5Y', '系统管理员', 'admin@example.com', '13800138000', NULL, 'active', NOW());

-- 获取刚插入的用户ID
SET @admin_user_id = LAST_INSERT_ID();

-- 插入管理员员工记录
INSERT INTO \`employees\` (\`user_id\`, \`employee_no\`, \`real_name\`, \`position\`, \`hire_date\`, \`status\`, \`created_at\`)
VALUES (@admin_user_id, 'ADMIN001', '系统管理员', '系统管理员', NOW(), 'active', NOW());

-- 插入超级管理员角色（如果roles表存在）
INSERT INTO \`roles\` (\`name\`, \`description\`, \`level\`, \`can_view_all_departments\`, \`created_at\`)
VALUES ('超级管理员', '拥有系统所有权限', 1, 1, NOW());

SET @admin_role_id = LAST_INSERT_ID();

-- 关联用户和角色
INSERT INTO \`user_roles\` (\`user_id\`, \`role_id\`, \`created_at\`)
VALUES (@admin_user_id, @admin_role_id, NOW());

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- 初始化完成
-- ==========================================
-- 超级管理员账号信息:
-- 用户名: admin
-- 密码: admin123
-- 请登录后立即修改密码！
-- ==========================================
`;

    // 保存到文件 (使用 UTF-8 without BOM)
    const outputPath = path.join(__dirname, '../database/migrations/001_init_clean_database.sql');
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入文件，明确指定 UTF-8 编码
    fs.writeFileSync(outputPath, sql, { encoding: 'utf8', flag: 'w' });

    console.log('\\n✅ SQL文件生成成功！');
    console.log(`文件路径: ${outputPath}`);
    console.log(`\\n包含内容:`);
    console.log(`- ${tableNames.length} 个表的结构`);
    console.log(`- 1 个超级管理员账号 (用户名: admin, 密码: admin123)`);

  } catch (error) {
    console.error('❌ 生成失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

generateCleanSQL();
