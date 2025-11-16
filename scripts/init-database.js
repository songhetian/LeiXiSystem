// 使用 Node.js 初始化数据库
require('dotenv').config()
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
}

async function initDatabase() {
  console.log('========================================')
  console.log('  初始化数据库')
  console.log('========================================')
  console.log('')

  let connection

  try {
    // 连接数据库（不指定数据库）
    console.log('[1/3] 连接 MySQL 服务器...')
    connection = await mysql.createConnection(dbConfig)
    console.log('✅ 连接成功')
    console.log('')

    // 读取 SQL 文件
    console.log('[2/3] 读取初始化脚本...')
    const sqlFile = path.join(__dirname, '../database/init.sql')
    const sql = fs.readFileSync(sqlFile, 'utf8')
    console.log('✅ 文件读取成功')
    console.log('')

    // 执行 SQL
    console.log('[3/3] 创建数据库和表结构...')
    await connection.query(sql)
    console.log('✅ 数据库初始化成功')
    console.log('')

    console.log('========================================')
    console.log('  ✅ 初始化完成！')
    console.log('========================================')
    console.log('')
    console.log('数据库名称：leixin_customer_service')
    console.log('')
    console.log('下一步：')
    console.log('1. 运行 npm run import:data 导入测试数据')
    console.log('2. 或运行 npm run dev 启动应用')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('========================================')
    console.error('  ❌ 初始化失败')
    console.error('========================================')
    console.error('')
    console.error('错误信息：', error.message)
    console.error('')
    console.error('可能的原因：')
    console.error('1. MySQL 服务未启动')
    console.error('2. 数据库配置错误（检查 .env 文件）')
    console.error('3. 权限不足')
    console.error('')
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

initDatabase()
