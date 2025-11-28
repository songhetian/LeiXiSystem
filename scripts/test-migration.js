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

async function testMigration() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    const sqlFile = path.join(__dirname, '../database/migrations/001_init_clean_database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log(`📄 SQL 文件大小: ${sql.length} 字符`);
    console.log(`📝 开始执行 SQL...`);

    await connection.query(sql);

    console.log('✅ SQL 执行成功！');

  } catch (error) {
    console.error('❌ 执行失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    console.error('SQL 状态:', error.sqlState);
    if (error.sql) {
      const lines = error.sql.split('\n');
      const errorLine = lines.slice(0, 10).join('\n');
      console.error('SQL 片段 (前10行):\n', errorLine);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testMigration();
