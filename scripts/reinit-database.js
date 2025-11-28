const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function reinitializeDatabase() {
  let connection;
  try {
    // 首先连接到 MySQL（不指定数据库）
    const baseConfig = { ...dbConfig };
    delete baseConfig.database;

    connection = await mysql.createConnection(baseConfig);
    console.log('✅ 连接到 MySQL 服务器');

    // 删除并重建数据库
    console.log('🗑️  删除旧数据库...');
    await connection.query(`DROP DATABASE IF EXISTS ${dbConfig.database}`);

    console.log('📦 创建新数据库...');
    await connection.query(`CREATE DATABASE ${dbConfig.database} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    console.log('🔄 切换到新数据库...');
    await connection.query(`USE ${dbConfig.database}`);

    // 读取并执行 SQL 文件
    const sqlFile = path.join(__dirname, '../database/migrations/001_init_clean_database.sql');
    console.log('📄 读取 SQL 文件...');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 移除 CREATE DATABASE 和 USE 语句（因为我们已经手动处理了）
    const cleanedSql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS.*?;/gi, '')
      .replace(/USE\s+\w+\s*;/gi, '')
      .replace(/DROP DATABASE IF EXISTS.*?;/gi, '');

    console.log('⚙️  执行 SQL 脚本...');
    await connection.query(cleanedSql);

    console.log('✅ 数据库初始化成功！');

    // 验证表数量
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📊 创建了 ${tables.length} 个表`);

  } catch (error) {
    console.error('❌ 初始化失败:');
    console.error('错误:', error.message);
    if (error.sql) {
      console.error('SQL 片段:', error.sql.substring(0, 200));
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

reinitializeDatabase();
