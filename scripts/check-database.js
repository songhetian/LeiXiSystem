const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306
};

async function checkDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    console.log(`📊 数据库: ${dbConfig.database}`);

    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📋 当前表数量: ${tables.length}`);

    if (tables.length > 0) {
      console.log('\n表列表:');
      tables.forEach((table, index) => {
        console.log(`${index + 1}. ${Object.values(table)[0]}`);
      });
    } else {
      console.log('\n⚠️  数据库中没有表！');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDatabase();
