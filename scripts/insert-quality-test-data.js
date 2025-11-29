#!/usr/bin/env node

// 脚本用于插入质检会话测试数据
const fs = require('fs');
const path = require('path');

// 数据库配置
const configPath = path.join(__dirname, '../config/db-config.decrypted.json');
const configFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const config = configFile.database;

// MySQL连接
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  port: config.port || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function insertTestData() {
  try {
    console.log('开始插入质检会话测试数据...');

    // 读取SQL文件
    const sqlFilePath = path.join(__dirname, '../database/insert_quality_test_data.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

    // 分割SQL语句（按分号分割，但要注意可能在字符串中的分号）
    const statements = sqlScript.split(';').filter(stmt => stmt.trim() !== '');

    // 执行每个SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      if (statement.length > 1) { // 忽略空语句
        try {
          await pool.execute(statement);
          console.log(`执行语句 ${i + 1}/${statements.length} 成功`);
        } catch (err) {
          console.error(`执行语句 ${i + 1}/${statements.length} 失败:`, err.message);
          // 不中断执行，继续下一个语句
        }
      }
    }

    console.log('测试数据插入完成！');

    // 验证插入的数据
    const [rows] = await pool.execute(
      "SELECT COUNT(*) as count FROM quality_sessions WHERE platform = '京东'"
    );
    console.log(`共插入 ${rows[0].count} 条京东平台的质检会话数据`);

    // 关闭连接池
    await pool.end();

  } catch (error) {
    console.error('插入测试数据时发生错误:', error);
    process.exit(1);
  }
}

// 执行脚本
insertTestData();
