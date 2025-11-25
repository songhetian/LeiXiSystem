const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'tian',
  password: 'root',
  database: 'leixin_customer_service',
  port: 3306
};

async function checkStatusColumn() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('--- assessment_results 表结构 ---');
    const [desc] = await connection.query('DESCRIBE assessment_results');
    console.log(JSON.stringify(desc, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkStatusColumn();
