const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

async function runMigration() {
  let connection

  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'leixin_customer_service',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    })


    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, 'add_search_indexes.sql')
    const sql = fs.readFileSync(sqlFile, 'utf8')


    // 执行 SQL
    const [results] = await connection.query(sql)


    // 显示结果
    if (Array.isArray(results)) {
      results.forEach((result, index) => {
        if (result && result.length > 0) {
          console.log(`\n结果集 ${index + 1}:`)
          console.table(result)
        }
      })
    }


    // 验证索引是否创建成功
    const [indexes] = await connection.query(`
      SELECT
        index_name,
        GROUP_CONCAT(column_name ORDER BY seq_in_index) as columns,
        index_type,
        non_unique
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'knowledge_articles'
        AND index_name IN (
          'ft_articles_search',
          'idx_category_status',
          'idx_type_status',
          'idx_created_at',
          'idx_updated_at',
          'idx_created_by',
          'idx_view_count',
          'idx_like_count',
          'idx_status'
        )
      GROUP BY index_name, index_type, non_unique
      ORDER BY index_name
    `)

    if (indexes.length > 0) {
      console.log('\n✅ 已创建的索引:')
      console.table(indexes)
    } else {
      console.log('\n⚠️  未找到新创建的索引，可能索引已存在')
    }

    console.log('\n🎉 搜索性能优化完成！')
    console.log('💡 提示: 这些索引将显著提升多维度搜索的性能')

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message)
    console.error('详细错误:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
      console.log('\n🔌 数据库连接已关闭')
    }
  }
}

// 运行迁移
runMigration()
