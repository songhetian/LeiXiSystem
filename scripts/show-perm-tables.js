const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306
};

async function getTableStructures() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const tables = ['roles', 'permissions', 'role_permissions', 'user_roles'];

    for (const table of tables) {
      try {
        const [rows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
        console.log(`\n--- ${table} ---`);
        console.log(rows[0]['Create Table']);
      } catch (e) {
        console.log(`\n--- ${table} ---`);
        console.log('Table not found or error:', e.message);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) await connection.end();
  }
}

getTableStructures();
